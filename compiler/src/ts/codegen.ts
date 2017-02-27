import * as ast from "./ast";
import * as st from "./string-tree";
import { assertNever } from "./util";

function translateStatements(statements: ast.Statement[]): st.StringTree {
    return st.concat(...statements.map(translateStatement));
}

function translateStatement(statement: ast.Statement): st.StringTree {
    switch (statement.kind) {
        case "Definition":
            // Do nothing for abstract definitions - they only matter to
            // the static checker (once it exists), not the code generator
            if (statement.body !== "abstract") {
                return st.concat("let", statement.name, "=", translateStatements(statement.body), ";\n");
            } else {
                return st.empty();
            }

        case "Assignment":
            return st.concat(translateExpression(statement.lhs), "=", translateExpression(statement.rhs), ";\n");

        default:
            return st.concat("/* TODO: Codegen for:", statement.kind, "*/");
    }

}

function translateExpression(expr: ast.Expression): st.StringTree {
    switch (expr.kind) {
        case "Variable":
            return expr.name;

        case "MemberAccess":
            return st.concat(translateExpression(expr.receiver), ".", expr.memberName);

        case "StringLit":
            return "\"" + expr.value + "\"";

        default:
            return st.concat("/* TODO: Codegen for:", expr.kind, "*/");
    }
}

export function generateJS(story: ast.Story) {
    let moduleHeader =
        "(function (factory) {\n" +
        "        if (typeof module === \"object\" && typeof module.exports === \"object\") {\n" +
        "            var v = factory(require, exports);\n" +
        "            if (v !== undefined) module.exports = v;\n" +
        "        }\n" +
        "        else if (typeof define === \"function\" && define.amd) {\n" +
        "            define([\"require\", \"exports\", \"./string-tree\"], factory);\n" +
        "        }\n" +
        "    })(function (require, exports) {\n" +
        "        \"use strict\";\n" +
        "        Object.defineProperty(exports, \"__esModule\", { value: true });\n" +
        "        let story = {};";

    let say = "        function say(str) { story.latestMessage += str; }\n";
    let playSound = "        function playSound(soundFile) { /* TODO */ }\n";
    let moduleFooter =
        "        story.start =  function() { this.room = startingRoom; this.isFinished = false; };\n" +
        "        story.input =  function(command) { this.latestMessage = \"\"; /* TODO */ };\n" +
        "        exports.default = story;\n});";
    let js = st.concat(moduleHeader, say, playSound, translateStatements(story.statements), moduleFooter);
    return st.toString(js);
}