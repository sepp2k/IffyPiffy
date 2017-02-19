export interface Story {
    statements: TopLevelStatement[]
}

export type TopLevelStatement = Definition | Assignment;
export type Statement = TopLevelStatement | Expression;

export interface Definition {
    kind: "Definition";
    name: String;
    body: Statement[];
}

export interface Assignment {
    kind: "Assignment";
    lhs: LExpression;
    rhs: Expression;
}

export type LExpression = Variable | LMemberAccess | LArrayAccess;
export type Expression = Variable | MemberAccess | ArrayAccess | FunctionCall;

export interface Variable {
    kind: "Variable";
    name: String;
}

export interface MemberAccess {
    kind: "MemberAccess";
    receiver: Expression;
    memberName: String;
}

export interface ArrayAccess {
    kind: "ArrayAccess";
    receiver: Expression;
    indexExpression: Expression;
}

export interface LMemberAccess extends MemberAccess {
    kind: "MemberAccess";
    receiver: LExpression;
    memberName: String;
}

export interface LArrayAccess extends ArrayAccess {
    kind: "ArrayAccess";
    receiver: LExpression;
    indexExpression: Expression;
}

export interface FunctionCall {
    kind: "FunctionCall";
    func: Expression;
    arguments: Expression[];
}