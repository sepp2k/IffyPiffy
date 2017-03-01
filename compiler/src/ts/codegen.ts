import * as ast from "./ast";
import * as st from "./string-tree";
import { SymbolTable } from "./symbol-table";
import { assertNever } from "./util";

export function generateJS(story: ast.Story) {
    type Scope = "local" | "global" | { object: st.StringTree };
    type ScopeType = "local" | "global" | "object";
    let env = new SymbolTable<Scope>({ say: "global", playSound: "global", story: "global", startingRoom: "global" });

    function fillScope(statements: ast.Statement[], scopeType: ScopeType) {
        let scope = scopeType === "object" ? {object: "this"} : scopeType;
        for(let statement of statements) {
            if (statement.kind === "Definition") {
                if (statement.object === null) {
                    env.set(statement.name, scope);
                } else {
                    console.log("TODO: Definitions on objects");
                }
            }
        }
    }

    function translateStatements(statements: ast.Statement[], scopeType: ScopeType): st.StringTree {
        env.pushFrame();
        fillScope(statements, scopeType);
        // Move object and functions defs to the beginning, so objects and functions
        // can be referenced before they're defined
        function isFunOrObjDef(stmnt: ast.Statement) {
            return stmnt.kind === "Definition" && stmnt.body !== "abstract" && stmnt.body.length === 1 &&
                (stmnt.body[0].kind === "Lambda" || stmnt.body[0].kind === "ObjectLit");
        }
        let funAndObjDefs = statements.filter(isFunOrObjDef);
        let rest = statements.filter(stmnt => !isFunOrObjDef(stmnt));
        function trans(stmnt: ast.Statement) { return translateStatement(stmnt, scopeType); }
        let result = st.concat(...funAndObjDefs.map(trans), ...rest.map(trans));
        env.popFrame();
        return result;
    }

    function translateStatement(statement: ast.Statement, scopeType: ScopeType): st.StringTree {
        switch (statement.kind) {
            case "Definition":
                // Don't generate any code for abstract definitions - they only matter for scope
                if (statement.body !== "abstract") {
                    if(statement.object === null) {
                        let last = translateStatement(statement.body[statement.body.length - 1], scopeType);
                        let rest = statement.body.slice(0, statement.body.length - 2);
                        let body = st.concat("(function() {", translateStatements(rest, "local"), "return", last, "})()");
                        let result: st.StringTree;
                        switch(scopeType) {
                            case "local":
                                return st.concat("let", statement.name, "=", body, ";\n");
                            case "global":
                                return st.concat("iffypiffyGlobals", ".", statement.name, "=", body, ";\n");
                            case "object":
                                return st.concat(statement.name, ":", body, ",\n");
                            default:
                                return assertNever(scopeType);
                        }
                    } else {
                        return "/* TODO: Definitions on objects */;\n";
                    }
                } else {
                    return st.empty();
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
                        return st.concat("iffypiffyGlobals", ".", expr.name);
                    case null:
                        throw Error("Undeclared variable: " + expr.name);
                    default:
                        return st.concat(scope.object, ".", expr.name);
                }

            case "ObjectLit":
                env.pushFrame();
                // TODO: Properly define variables based on parent
                env.set("name", { object: "this" });
                env.set("description", {object: "this"});
                if(expr.parent === "Room") {
                    env.set("items", { object: "this" });
                } else if (expr.parent === "Verb") {
                    env.set("syntax", { object: "this" });
                    env.set("defaultAction", { object: "this" });
                }
                let result = st.concat("{init: function() {", translateStatements(expr.body, "object"), " return this; } } . init()");
                env.popFrame();
                return result;

            case "MemberAccess":
                return st.concat(translateExpression(expr.receiver), ".", expr.memberName);

            case "StringLit":
                return "\"" + expr.value + "\"";

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
        "            define([\"require\", \"exports\", \"./string-tree\"], factory);\n" +
        "        }\n" +
        "    })(function (require, story) {\n" +
        "        \"use strict\";\n" +
        "        Object.defineProperty(exports, \"__esModule\", { value: true });\n" +
        "        let iffypiffyGlobals = { story: {} };\n";

    let say = "        iffypiffyGlobals.say = function(str) { story.latestMessage += str; }\n";
    let playSound = "        iffypiffyGlobals.playSound = function(soundFile) { /* TODO */ }\n";
    let moduleFooter =
        "        story.title = iffypiffyGlobals.story.title;\n" +
        "        story.description = iffypiffyGlobals.story.description;\n" +
        "        story.start =  function() {\n" +
        "            this.room = iffypiffyGlobals.startingRoom;\n" +
        "            this.isFinished = false;\n" +
        "            this.latestMessage = this.room.description;\n" +
        "        };\n" +
        "        story.input =  function(command) { this.latestMessage = \"\"; /* TODO */ };\n" +
        "});\n";
    let js = st.concat(moduleHeader, say, playSound, translateStatements(story.statements, "global"), moduleFooter);
    return st.toString(js);
}