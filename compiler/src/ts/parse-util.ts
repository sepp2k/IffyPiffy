import * as ast from './ast'

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

export function expToDefTarget(exp: ast.Expression): [ast.LExpression|null, string] {
    switch(exp.kind) {
        case "Variable":
        return [null, exp.name];

        case "MemberAccess":
        return [expToLExp(exp.receiver), exp.memberName];

        default:
        throw new Error("You can only define variables or members on objects, not: " + exp);
    }
}

export function mkDefinition(target: ast.Expression, body: ast.Statement[]): ast.Definition {
    const [obj, name] = expToDefTarget(target);
    return {
        kind: "Definition",
        object: obj,
        name: name,
        body: body
    };
}