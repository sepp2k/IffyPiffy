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
        say: {kind: "VarEntry", qid: "$globals.say"},
        playSound: {kind: "VarEntry", qid: "$globals.playSound"},
        startingRoom: {kind: "VarEntry", qid: "$globals.startingRoom"},
        story: {kind: "ObjectEntry", qid: "$globals.story", members: {
            title: {kind: "VarEntry", qid: "title"},
            description: {kind: "VarEntry", qid: "description"}
        }},
        Item: {kind: "ObjectEntry", qid: "$globals.Item", members: {
            name: {kind: "VarEntry", qid: "name"},
            description: {kind: "VarEntry", qid: "description"}
        }},
        Room: {kind: "ObjectEntry", qid: "$globals.Room", members: {
            name: {kind: "VarEntry", qid: "name"},
            description: {kind: "VarEntry", qid: "description"},
            items: {kind: "VarEntry", qid: "items"}
        }},
        Verb: {kind: "ObjectEntry", qid: "$globals.Verb", members: {
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
                    defHeader, "$inherit(", parent.qid, ", {\n",
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
                return st.concat("$onHandlers.push([", event, ",", nameEntry.qid, ", function () {", body, "}]);\n");

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
                return st.concat("$init(", obj, ")", ".", expr.memberName);
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
                let args = expr.arguments.map(translateExpression)
                return st.concat(f, "(", st.join(args, ","), ")");
            }
        }
    }

    let moduleHeader =
        "(function (factory) {\n" +
        "        if (typeof module === \"object\" && typeof module.exports === \"object\") {\n" +
        "            var v = factory(require, exports);\n" +
        "            if (v !== undefined) module.exports = v;\n" +
        "        }\n" +
        "        else if (typeof define === \"function\" && define.amd) {\n" +
        "            define([\"require\", \"exports\"], factory);\n" +
        "        }\n" +
        "    })(function (require, story) {\n" +
        "        \"use strict\";\n" +
        "        Object.defineProperty(story, \"__esModule\", { value: true });\n" +
        "        let $globals = { story: {} };\n" +
        "        $globals.say = function(...strs) { story.latestMessage += strs.join(\"\") + \"\\n\"; }\n" +
        "        $globals.playSound = function(soundFile) { if(typeof Audio !== \"undefined\") new Audio(story.resourceDir + \"/\" + soundFile).play(); }\n" +
        "        $globals.Item = {};\n" +
        "        $globals.Room = {};\n" +
        "        $globals.Verb = { $onInherit: function(child) { $verbs.push(child); } };\n" +
        "        let $onHandlers = [];\n" +
        "        let $verbs = [];\n" +
        "        function $init(obj) { return obj && obj.$needsInit ? obj.$init() : obj; }\n" +
        "        function $inherit(parent, childProps) {\n" +
        "            let child = Object.assign(Object.create(parent), childProps);\n" +
        "            if(parent.$onInherit) parent.$onInherit(child);\n" +
        "            return child;" +
        "        }\n" +
        "        function enterRoom(room) {\n" +
        "            story.latestMessage += $init(room).description;\n" +
        "            if(room.items && room.items.length > 0) {\n" +
        "                story.latestMessage += \"\\n\\nYou see here:\\n\";\n" +
        "                for(let i = 0; i < room.items.length - 1; i++) {\n" +
        "                    story.latestMessage += $init(room.items[i]).name + \", \";\n" +
        "                }\n" +
        "                story.latestMessage += \"and \" + $init(room.items[room.items.length - 1]).name + \".\";\n" +
        "            }\n" +
        "        }\n";

    let moduleFooter =
        "        function simplifyObject(obj) { return obj.replace(/\\s*\\b(the|a|an)\\b\\s*/, \"\").toLowerCase(); }\n" +
        "        story.title = $globals.story.title;\n" +
        "        story.description = $globals.story.description;\n" +
        "        story.start =  function(resourceDir = \".\") {\n" +
        "            this.room = $init($globals.startingRoom);\n" +
        "            this.isFinished = false;\n" +
        "            this.latestMessage = \"\";\n" +
        "            this.resourceDir = resourceDir;\n" +
        "            enterRoom(this.room);\n" +
        "        };\n" +
        "        story.input =  function(command) {\n" +
        "            if(command === \"quit\") { this.isFinished = true; return; }\n" +
        "            this.latestMessage = \"\";\n" +
        "            let tokens = command.split(/\\s+/);\n" +
        "            if(tokens.length >= 2) {\n" +
        "                let [verb, ...object] = tokens;\n" +
        "                object = simplifyObject(object.join(\" \"));\n" +
        "                for(let [handlerVerb, handlerObject, handler] of $onHandlers) {\n" +
        "                    handlerObject = simplifyObject(handlerObject);\n" +
        "                    if($init(handlerVerb).syntax.split(/\\s+/)[0] === verb && handlerObject === object) { handler(); return; }\n" +
        "                }\n" +
        "            }\n" +
        "            for(let verb of $verbs) {\n" +
        "                if($init(verb).syntax.split(/\\s+/)[0] === tokens[0]) { verb.defaultAction(); return; }\n" +
        "            }\n" +
        "            $globals.say(\"I'm sorry, but I could not understand you.\");\n" +
        "        };\n" +
        "});\n";
    let js = st.concat(moduleHeader, translateStatements(story.statements, {object: "$globals"}), moduleFooter);
    return st.toString(js);
}