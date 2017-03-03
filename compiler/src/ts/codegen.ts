import * as ast from "./ast";
import * as st from "./string-tree";
import { SymbolTable } from "./symbol-table";
import { assertNever, filterNulls } from "./util";

export function generateJS(story: ast.Story) {
    type Scope = "local" | "global" | { object: st.StringTree };
    type ScopeType = "local" | "global" | "object";
    let env = new SymbolTable<Scope>({ say: "global", playSound: "global", story: "global", startingRoom: "global" });
    let builtinObjects = {
        "Item": ["name", "description"],
        "Room": ["name", "description", "items"],
        "Verb": ["syntax", "defaultAction"]
    };
    let objectEnv = new SymbolTable<string[]>(builtinObjects);
    let objectId = 0;

    function fillScope(statements: ast.Statement[], scopeType: ScopeType) {
        let scope = scopeType === "object" ? {object: "this"} : scopeType;
        for (let statement of statements) {
            if (statement.kind === "Definition") {
                env.set(statement.name, scope);
                let body = statement.body;
                if (body !== "abstract" && body.kind === "ObjectLit") {
                    let memberNames = body.body.map(stmnt => stmnt.kind === "Definition" ? stmnt.name : null);
                    let parentMembers = objectEnv.get(body.parent);
                    if (parentMembers === null) {
                        throw new Error("Unknown object name: " + body.parent);
                    }
                    objectEnv.set(statement.name, filterNulls(memberNames).concat(parentMembers));
                }
            }
        }
    }

    function translateStatements(statements: ast.Statement[], scopeType: ScopeType): st.StringTree {
        env.pushFrame();
        objectEnv.pushFrame();
        fillScope(statements, scopeType);
        // Move object and functions defs to the beginning, so objects and functions
        // can be referenced before they're defined
        function isFunOrObjDef(stmnt: ast.Statement) {
            return stmnt.kind === "Definition" && stmnt.body !== "abstract" &&
                (stmnt.body.kind === "Lambda" || stmnt.body.kind === "ObjectLit");
        }
        let funAndObjDefs = statements.filter(isFunOrObjDef);
        let rest = statements.filter(stmnt => !isFunOrObjDef(stmnt));
        function trans(stmnt: ast.Statement) { return translateStatement(stmnt, scopeType); }
        let result = st.concat(...funAndObjDefs.map(trans), ...rest.map(trans));
        objectEnv.popFrame();
        env.popFrame();
        return result;
    }

    function translateStatement(statement: ast.Statement, scopeType: ScopeType): st.StringTree {
        switch (statement.kind) {
            case "Definition":
                // Don't generate any code for abstract definitions - they only matter for scope
                if (statement.body === "abstract") {
                    return st.empty();
                } else {
                    let body = translateExpression(statement.body);
                    switch (scopeType) {
                        case "local":
                            return st.concat("let", statement.name, "=", body, ";\n");
                        case "global":
                            return st.concat("$globals", ".", statement.name, "=", body, ";\n");
                        case "object":
                            return st.concat("this", ".", statement.name, "=", body, ";\n");
                        default:
                            return assertNever(scopeType);
                    }
                }

            case "Assignment":
                return st.concat(translateExpression(statement.lhs), "=", translateExpression(statement.rhs), ";\n");

            case "OnHandler":
            case "IfStatement":
                return st.concat("/* TODO: Codegen for:", statement.kind, "*/\n");

            default:
                return st.concat(translateExpression(statement), ";\n");
        }
    }

    function translateExpression(expr: ast.Expression): st.StringTree {
        switch (expr.kind) {
            case "Variable":
                let scope = env.get(expr.name);
                switch(scope) {
                    case "local":
                        return expr.name;
                    case "global":
                        return st.concat("$globals", ".", expr.name);
                    case null:
                        throw Error("Undeclared variable: " + expr.name);
                    default:
                        return st.concat(scope.object, ".", expr.name);
                }

            case "ObjectLit":
                env.pushFrame();
                let parentMembers = objectEnv.get(expr.parent);
                if(parentMembers === null) {
                    throw new Error("Unknown object name: " + expr.parent);
                }
                let objectName = "object" + objectId++;
                for(let member of parentMembers) {
                    env.set(member, {object: objectName});
                }
                let result = st.concat(
                    "(function() {\n",
                    "let", objectName, "=", "{\n",
                    // Objects are initialized when they're first accessed. This way we don't need to worry about
                    // changing the order of side effects by moving around object definitions.
                    "$init: function() {\n",
                    translateStatements(expr.body, "object"),
                    "this.$needsInit = false;\n",
                    "return this;\n},",
                    "$needsInit: true\n};\n",
                    "return", objectName, ";\n",
                    "})()"
                    );
                env.popFrame();
                return result;

            case "MemberAccess":
                let obj = translateExpression(expr.receiver);
                return st.concat("$init(", obj, ")", ".", expr.memberName);

            case "StringLit":
                return "\"" + expr.value + "\"";

            case "ArrayLit":
                let elements = expr.elements.map(translateExpression);
                return st.concat("[", st.join(elements, ","), "]");

            default:
                return st.concat("/* TODO: Codegen for:", expr.kind, "*/ undefined");
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
        "        $globals.say = function(str) { story.latestMessage += str; }\n" +
        "        $globals.playSound = function(soundFile) { /* TODO */ }\n" +
        "        function $init(obj) { return obj && obj.$needsInit ? obj.$init() : obj; }" +
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
        "        story.title = $globals.story.title;\n" +
        "        story.description = $globals.story.description;\n" +
        "        story.start =  function() {\n" +
        "            this.room = $init($globals.startingRoom);\n" +
        "            this.isFinished = false;\n" +
        "            this.latestMessage = \"\";\n" +
        "            enterRoom(this.room);\n" +
        "        };\n" +
        "        story.input =  function(command) { this.latestMessage = \"\"; /* TODO */ };\n" +
        "});\n";
    let js = st.concat(moduleHeader, translateStatements(story.statements, "global"), moduleFooter);
    return st.toString(js);
}