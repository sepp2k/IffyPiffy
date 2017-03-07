import * as ast from "./ast";
import * as st from "./string-tree";
import { SymbolTable } from "./symbol-table";
import { assertNever, filterNulls, StringMap, mergeMaps, p } from "./util";

export function generateJS(story: ast.Story) {
    type Scope = "local" | { object: st.StringTree };
    type EnvEntry = VarEntry | ObjectEntry;
    type VarEntry = {qid: st.StringTree, kind: "VarEntry"};
    type ObjectEntry = {qid: st.StringTree, kind: "ObjectEntry", members: StringMap<EnvEntry>};
    let env = new SymbolTable<EnvEntry>({
        say: {kind: "VarEntry", qid: "$rt.globals.say"},
        playSound: {kind: "VarEntry", qid: "$rt.globals.playSound"},
        startingRoom: {kind: "VarEntry", qid: "$rt.globals.startingRoom"},
        story: {kind: "ObjectEntry", qid: "$rt.globals.story", members: {
            title: {kind: "VarEntry", qid: "title"},
            description: {kind: "VarEntry", qid: "description"}
        }},
        Item: {kind: "ObjectEntry", qid: "$rt.globals.Item", members: {
            name: {kind: "VarEntry", qid: "name"},
            description: {kind: "VarEntry", qid: "description"}
        }},
        Room: {kind: "ObjectEntry", qid: "$rt.globals.Room", members: {
            name: {kind: "VarEntry", qid: "name"},
            description: {kind: "VarEntry", qid: "description"},
            items: {kind: "VarEntry", qid: "items"}
        }},
        Verb: {kind: "ObjectEntry", qid: "$rt.globals.Verb", members: {
            syntax: {kind: "VarEntry", qid: "syntax"},
            defaultAction: {kind: "VarEntry", qid: "defaultAction"},
        }},
    });
    function mkQID(name: string, scope: Scope): st.StringTree {
        if(scope === "local") {
            return name;
        } else {
            return st.concat(scope.object, ".", name);
        }
    }

    function findMemberDefs(statements: ast.TopLevelStatement[]): StringMap<EnvEntry> {
        let result: StringMap<EnvEntry> = {};
        for(let statement of statements) {
            switch(statement.kind) {
                case "VariableDefinition":
                    result[statement.name] = { kind: "VarEntry", qid: statement.name };
                    break;
            }
        }
        return result;
    }

    function fillScope(statements: ast.Statement[], scope: Scope): void {
        for (let statement of statements) {
            switch (statement.kind) {
                case "VariableDefinition":
                case "FunctionDefinition": {
                    if(statement.kind === "FunctionDefinition" && statement.isOverride) continue;
                    let qid = mkQID(statement.name, scope);
                    env.set(statement.name, { kind: "VarEntry", qid: qid });
                    break;
                }
                case "ObjectDefinition": {
                    let qid = mkQID(statement.name, scope);
                    let parent = env.get(statement.parent);
                    if (parent === null || parent.kind !== "ObjectEntry") {
                        throw new Error("Unknown object name: " + statement.parent);
                    }
                    let members = mergeMaps(parent.members, findMemberDefs(statement.body));
                    env.set(statement.name, { kind: "ObjectEntry", qid: qid, members: members });
                }
            }
        }
    }

    function translateStatements(statements: ast.Statement[], scope: Scope): st.StringTree {
        env.pushFrame();
        fillScope(statements, scope);
        // Move object and functions defs to the beginning, so objects and functions
        // can be referenced before they're defined
        function isFunOrObjDef(stmnt: ast.Statement) {
            return stmnt.kind === "FunctionDefinition" || stmnt.kind === "ObjectDefinition";
        }
        let funAndObjDefs = statements.filter(isFunOrObjDef);
        let rest = statements.filter(stmnt => !isFunOrObjDef(stmnt));
        function trans(stmnt: ast.Statement) { return translateStatement(stmnt, scope); }
        let result = st.concat(...funAndObjDefs.map(trans), ...rest.map(trans));
        env.popFrame();
        return result;
    }

    function translateDef(def: ast.VariableDefinition | ast.FunctionDefinition | ast.ObjectDefinition, scope: Scope) {
        // fillScope should have already processed this and stored the name in the env
        let entry = env.get(def.name);
        if (entry === null) throw new Error("Internal Error: Missing env entry");
        let qid = entry.qid;
        if (scope === "local") {
            if(qid !== def.name) throw new Error("Internal Error: Local variables should not be assigned a qualified ID.");
            return [qid, st.concat("let", qid, "=")];
        } else {
            return [qid, st.concat(qid, "=")];
        }
    }

    function translateStatement(statement: ast.Statement, scope: Scope): st.StringTree {
        switch (statement.kind) {
            case "VariableDefinition": {
                let [_qid, defHeader] = translateDef(statement, scope);
                // Don't generate any code for abstract definitions - they only matter for scope
                if (statement.body === "abstract") {
                    return st.empty();
                } else {
                    let body = translateExpression(statement.body);
                    return st.concat(defHeader, body, ";\n");
                }
            }
            case "ObjectDefinition": {
                let [qid, defHeader] = translateDef(statement, scope);

                env.pushFrame();
                let parent = env.get(statement.parent);
                if(parent === null || parent.kind !== "ObjectEntry") {
                    throw new Error("Unknown object name: " + statement.parent);
                }
                for(let member in parent.members) {
                    let entry = parent.members[member] as EnvEntry;
                    let newEntry = {qid: st.concat(qid, ".", entry.qid)};
                    env.set(member, Object.assign({}, entry, newEntry));
                }
                let result = st.concat(
                    defHeader, "$rt.inherit(", parent.qid, ", {\n",
                    // Objects are initialized when they're first accessed. This way we don't need to worry about
                    // changing the order of side effects by moving around object definitions.
                    "$init: function() {\n",
                    translateStatements(statement.body, {object: qid}),
                    "this.$needsInit = false;\n",
                    "return this;\n},\n",
                    "$needsInit: true\n});\n"
                    );
                env.popFrame();
                return result;
            }

            case "FunctionDefinition": {
                let [qid, defHeader] = translateDef(statement, scope);
                let body;
                if(statement.body === "abstract") {
                    body = "throw new Error(\"Unimplemented abstract method: \"" + statement.name + "\")";
                } else {
                    env.pushFrame();
                    for(let param of statement.params) {
                        env.set(param, {kind: "VarEntry", qid: param});
                    }
                    body = translateStatements(statement.body, "local");
                    env.popFrame();
                }
                if(statement.isOverride) {
                    defHeader = st.concat(qid, "=");
                }
                return st.concat(defHeader, "function (", st.join(statement.params, ","), ") {\n", body, "};\n");
            }

            case "Assignment":
                return st.concat(translateExpression(statement.lhs), "=", translateExpression(statement.rhs), ";\n");

            case "IfStatement":
                let condition = translateExpression(statement.condition);
                let thenCase = translateStatements(statement.thenCase, scope);
                let elseCase = translateStatements(statement.elseCase, scope);
                return st.concat("if", "(", condition, ") {\n", thenCase, "} else {\n", elseCase, "}\n");

            case "OnHandler":
                let body = translateStatements(statement.body, "local");
                let nameEntry = env.get("name");
                if(nameEntry === null) {
                    throw new Error("On-handlers can only be defined on objects with a 'name' property.");
                }
                let event = translateExpression(statement.event);
                return st.concat("$rt.onHandlers.push([", event, ",", nameEntry.qid, ", function () {", body, "}]);\n");

            default:
                return st.concat(translateExpression(statement), ";\n");
        }
    }

    function translateExpression(expr: ast.Expression): st.StringTree {
        switch (expr.kind) {
            case "Variable":
                let entry = env.get(expr.name);
                if(entry === null) {
                    throw Error("Undeclared variable: " + expr.name);
                } else {
                    return entry.qid;
                }

            case "MemberAccess": {
                let obj = translateExpression(expr.receiver);
                return st.concat("$rt.init(", obj, ")", ".", expr.memberName);
            }
            case "ArrayAccess": {
                let obj = translateExpression(expr.receiver);
                let index = translateExpression(expr.indexExpression);
                return st.concat(obj, "[", index, "]");
            }
            case "StringLit":
                return "\"" + expr.value + "\"";

            case "ArrayLit":
                let elements = expr.elements.map(translateExpression);
                return st.concat("[", st.join(elements, ","), "]");

            case "BoolLit":
            case "NumberLit":
                return "" + expr.value;

            case "FunctionCall": {
                let f = translateExpression(expr.func);
                let args = expr.arguments.map(translateExpression);
                return st.concat(f, "(", st.join(args, ","), ")");
            }
        }
    }

    let moduleHeader =
        "(function (factory) {\n" +
        "    if (typeof module === \"object\" && typeof module.exports === \"object\") {\n" +
        "        module.exports = factory(require);\n" +
        "    }\n" +
        "    else if (typeof define === \"function\" && define.amd) {\n" +
        "        define([\"require\"], factory);\n" +
        "    }\n" +
        "})(function (require) {\n" +
        "    \"use strict\";\n" +
        "    return function ($rt) {\n" +
        "        return new $rt.Story( " + story.title + ", " + story.description  + "," + "function() {\n";

    let moduleFooter =
        "        });" +
        "    };\n" +
        "});\n";
    let js = st.concat(moduleHeader, translateStatements(story.statements, "local"), moduleFooter);
    return st.toString(js);
}