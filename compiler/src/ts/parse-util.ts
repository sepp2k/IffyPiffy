import * as ast from "./ast";

export function expToLExp(exp: ast.Expression): ast.LExpression {
    switch(exp.kind) {
        case "Variable":
        return exp;

        case "MemberAccess":
        return {
            kind: "MemberAccess",
            receiver: expToLExp(exp.receiver),
            memberName: exp.memberName
        };

        case "ArrayAccess":
        return {
            kind: "ArrayAccess",
            receiver: expToLExp(exp.receiver),
            indexExpression: exp.indexExpression
        };

        default:
        throw new Error("Not an L-Expression: " + exp);
    }
}