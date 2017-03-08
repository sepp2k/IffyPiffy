import * as ast from "./ast";
import * as st from "./string-tree";
import { SymbolTable } from "./symbol-table";
import { assertNever, filterNulls, StringMap, mergeMaps, p } from "./util";

export function generateJS(story: ast.Story) {
    type Scope = Local | Namespace | This;
    type Local = { kind: "Local" };
    type Namespace = { kind: "Namespace", namespace: st.StringTree };
    type This = { kind: "This", nesting: number};

    type EnvEntry = VarEntry | ObjectEntry;
    type VarEntry = {scope: Scope, kind: "VarEntry"};
    type ObjectEntry = {scope: Scope, kind: "ObjectEntry", members: StringMap<EnvEntry>};

    let env = new SymbolTable<EnvEntry>({
        say: {kind: "VarEntry", scope: {kind: "Namespace", namespace: "$rt.globals"}},
        str: { kind: "VarEntry", scope: { kind: "Namespace", namespace: "$rt.globals" } },
        playSound: {kind: "VarEntry", scope: {kind: "Namespace", namespace: "$rt.globals"}},
        startingRoom: {kind: "VarEntry", scope: {kind: "Namespace", namespace: "$rt.globals"}},
        story: {kind: "ObjectEntry", scope: {kind: "Namespace", namespace: "$rt.globals"}, members: {
            title: {kind: "VarEntry", scope: {kind: "This", nesting: 0}},
            description: {kind: "VarEntry", scope: {kind: "This", nesting: 0}
        }}},
        Thing: {kind: "ObjectEntry", scope: {kind: "Namespace", namespace: "$rt.globals"}, members: {
            name: {kind: "VarEntry", scope: {kind: "This", nesting: 0}},
            description: {kind: "VarEntry", scope: {kind: "This", nesting: 0}
        }}},
        Item: {kind: "ObjectEntry", scope: {kind: "Namespace", namespace: "$rt.globals"}, members: {
            name: {kind: "VarEntry", scope: {kind: "This", nesting: 0}},
            description: {kind: "VarEntry", scope: {kind: "This", nesting: 0}
        }}},
        Room: {kind: "ObjectEntry", scope: {kind: "Namespace", namespace: "$rt.globals"}, members: {
            name: {kind: "VarEntry", scope: {kind: "This", nesting: 0}},
            description: {kind: "VarEntry", scope: {kind: "This", nesting: 0}},
            items: {kind: "VarEntry", scope: {kind: "This", nesting: 0}
        }}},
        Verb: {kind: "ObjectEntry", scope: {kind: "Namespace", namespace: "$rt.globals"}, members: {
            syntax: {kind: "VarEntry", scope: {kind: "This", nesting: 0}},
            defaultAction: {kind: "VarEntry", scope: {kind: "This", nesting: 0}}
        }}
    });
    function mkQID(name: string, scope: Scope, nesting: number): st.StringTree {
        switch(scope.kind) {
            case "Local":
                return name;
            case "Namespace":
                return st.concat(scope.namespace, ".", name);
            case "This":
                let qid: st.StringTree = "this";
                for(let i = 0; i < nesting - scope.nesting; i++) {
                    qid = st.concat(qid, ".$outer");
                }
                return st.concat(qid, ".", name);
        }
    }

    function findMemberDefs(statements: ast.TopLevelStatement[], nesting: number): StringMap<EnvEntry> {
        let result: StringMap<EnvEntry> = {};
        for(let statement of statements) {
            switch(statement.kind) {
                case "VariableDefinition":
                case "FunctionDefinition":
                    result[statement.name] = { kind: "VarEntry", scope: { kind: "This", nesting: nesting } };
                    break;

                case "ObjectDefinition":
                    let parent = env.get(statement.parent);
                    if (parent === null || parent.kind !== "ObjectEntry") {
                        throw new Error("Unknown object name: " + statement.parent);
                    }
                    let members = mergeMaps(parent.members, findMemberDefs(statement.body, nesting + 1));
                    result[statement.name] = { kind: "ObjectEntry", scope: { kind: "This", nesting: nesting}, members: members };
                    break;
            }
        }
        return result;
    }

    function fillScope(statements: ast.Statement[], scope: Scope, nesting: number): void {
        for (let statement of statements) {
            switch (statement.kind) {
                case "VariableDefinition":
                case "FunctionDefinition": {
                    if(statement.kind === "FunctionDefinition" && statement.isOverride) continue;
                    env.set(statement.name, { kind: "VarEntry", scope: scope });
                    break;
                }
                case "ObjectDefinition": {
                    let parent = env.get(statement.parent);
                    if (parent === null || parent.kind !== "ObjectEntry") {
                        throw new Error("Unknown object name: " + statement.parent);
                    }
                    let members = mergeMaps(parent.members, findMemberDefs(statement.body, nesting));
                    env.set(statement.name, { kind: "ObjectEntry", scope: scope, members: members });
                }
            }
        }
    }

    function translateStatements(statements: ast.Statement[], scope: Scope, nesting: number): st.StringTree {
        env.pushFrame();
        fillScope(statements, scope, nesting);
        // Move object and functions defs to the beginning, so objects and functions
        // can be referenced before they're defined
        function isFunOrObjDef(stmnt: ast.Statement) {
            return stmnt.kind === "FunctionDefinition" || stmnt.kind === "ObjectDefinition";
        }
        let funAndObjDefs = statements.filter(isFunOrObjDef);
        let rest = statements.filter(stmnt => !isFunOrObjDef(stmnt));
        function trans(stmnt: ast.Statement) { return translateStatement(stmnt, scope, nesting); }
        let result = st.concat(...funAndObjDefs.map(trans), ...rest.map(trans));
        env.popFrame();
        return result;
    }

    function translateDef(def: ast.VariableDefinition | ast.FunctionDefinition | ast.ObjectDefinition, scope: Scope, nesting: number) {
        let qid = mkQID(def.name, scope, nesting);
        if (scope.kind === "Local") {
            if(qid !== def.name) throw new Error("Internal Error: Local variables should not be assigned a qualified ID.");
            return [qid, st.concat("let", qid, "=")];
        } else {
            return [qid, st.concat(qid, "=")];
        }
    }

    function translateStatement(statement: ast.Statement, scope: Scope, nesting: number): st.StringTree {
        switch (statement.kind) {
            case "VariableDefinition": {
                let [_qid, defHeader] = translateDef(statement, scope, nesting);
                // Don't generate any code for abstract definitions - they only matter for scope
                if (statement.body === "abstract") {
                    return st.empty();
                } else {
                    let body = translateExpression(statement.body, nesting);
                    return st.concat(defHeader, body, ";\n");
                }
            }
            case "ObjectDefinition": {
                let [qid, defHeader] = translateDef(statement, scope, nesting);

                env.pushFrame();
                let parent = env.get(statement.parent);
                if(parent === null || parent.kind !== "ObjectEntry") {
                    throw new Error("Unknown object name: " + statement.parent);
                }
                for(let member in parent.members) {
                    // The cast prevents TypeScript from worrying about undefined
                    // Since we get 'member' from the for loop, 'members[member]' can't possibly be undefined
                    let entry = parent.members[member] as EnvEntry;
                    env.set(member, Object.assign({}, entry, {scope: {kind: "This", nesting: nesting + 1}}));
                }
                let parentQID = mkQID(statement.parent, parent.scope, nesting);
                let result = st.concat(
                    defHeader, "$rt.inherit(", parentQID, ",", "\"" + statement.name + "\"", ",",
                    // Objects are initialized when they're first accessed. This way we don't need to worry about
                    // changing the order of side effects by moving around object definitions.
                    "function () {\n",
                    translateStatements(statement.body, {kind: "This", nesting: nesting + 1}, nesting + 1),
                    "});\n",
                    qid, ".$outer = this;\n"
                    );
                env.popFrame();
                return result;
            }

            case "FunctionDefinition": {
                let [qid, defHeader] = translateDef(statement, scope, nesting);
                let body;
                if(statement.body === "abstract") {
                    body = "throw new Error(\"Unimplemented abstract method: \"" + statement.name + "\")";
                } else {
                    env.pushFrame();
                    for(let param of statement.params) {
                        env.set(param, {kind: "VarEntry", scope: { kind: "Local" }});
                    }
                    body = translateStatements(statement.body, { kind: "Local" }, nesting);
                    env.popFrame();
                }
                if(statement.isOverride) {
                    defHeader = st.concat(qid, "=");
                }
                return st.concat(defHeader, "function (", st.join(statement.params, ","), ") {\n", body, "};\n");
            }

            case "Assignment":
                return st.concat(translateExpression(statement.lhs, nesting), "=", translateExpression(statement.rhs, nesting), ";\n");

            case "IfStatement":
                let condition = translateExpression(statement.condition, nesting);
                let thenCase = translateStatements(statement.thenCase, scope, nesting);
                let elseCase = translateStatements(statement.elseCase, scope, nesting);
                return st.concat("if", "(", condition, ") {\n", thenCase, "} else {\n", elseCase, "}\n");

            case "OnHandler":
                let body = translateStatements(statement.body, { kind: "Local" }, nesting);
                let nameEntry = env.get("name");
                if(nameEntry === null) {
                    throw new Error("On-handlers can only be defined on objects with a 'name' property.");
                }
                let event = translateExpression(statement.event, nesting);
                return st.concat("$rt.onHandlers.push([", event, ", this, function () {", body, "}]);\n");

            default:
                return st.concat(translateExpression(statement, nesting), ";\n");
        }
    }

    function translateExpression(expr: ast.Expression, nesting: number): st.StringTree {
        switch (expr.kind) {
            case "Variable":
                let entry = env.get(expr.name);
                if(entry === null) {
                    throw Error("Undeclared variable: " + expr.name);
                } else {
                    return mkQID(expr.name, entry.scope, nesting);
                }

            case "MemberAccess": {
                let obj = translateExpression(expr.receiver, nesting);
                return st.concat("$rt.init(", obj, ")", ".", expr.memberName);
            }
            case "ArrayAccess": {
                let obj = translateExpression(expr.receiver, nesting);
                let index = translateExpression(expr.indexExpression, nesting);
                return st.concat(obj, "[", index, "]");
            }
            case "StringLit":
                return "\"" + expr.value + "\"";

            case "ArrayLit":
                let elements = expr.elements.map(elem => translateExpression(elem, nesting));
                return st.concat("[", st.join(elements, ","), "]");

            case "BoolLit":
            case "NumberLit":
                return "" + expr.value;

            case "FunctionCall": {
                let f = translateExpression(expr.func, nesting);
                let args = expr.arguments.map(arg => translateExpression(arg, nesting));
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
    let js = st.concat(moduleHeader, translateStatements(story.statements, { kind: "Local" }, 0), moduleFooter);
    return st.toString(js);
}