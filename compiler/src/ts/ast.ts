export interface Story {
    title: string;
    description: string;
    statements: TopLevelStatement[];
}

export type TopLevelStatement = VariableDefinition | FunctionDefinition | ObjectDefinition | Assignment | OnHandler;
export type Statement = TopLevelStatement | IfStatement | Expression;

export interface VariableDefinition {
    kind: "VariableDefinition";
    name: string;
    body: Expression|"abstract";
}

export interface FunctionDefinition {
    kind: "FunctionDefinition";
    name: string;
    isOverride: boolean;
    params: string[];
    body: Statement[] | "abstract";
}

export interface ObjectDefinition {
    kind: "ObjectDefinition";
    name: string;
    parent: string;
    body: TopLevelStatement[];
}


export interface Assignment {
    kind: "Assignment";
    lhs: LExpression;
    rhs: Expression;
}

export interface OnHandler {
    kind: "OnHandler";
    event: Expression;
    body: Statement[];
}

export interface IfStatement {
    kind: "IfStatement";
    condition: Expression;
    thenCase: Statement[];
    elseCase: Statement[];
}

export type LExpression = Variable | LMemberAccess | LArrayAccess;
export type Expression =
    Variable
    | StringLit
    | NumberLit
    | BoolLit
    | ArrayLit
    | MemberAccess
    | ArrayAccess
    | FunctionCall;

export interface Variable {
    kind: "Variable";
    name: string;
}

export interface StringLit {
    kind: "StringLit";
    value: string;
}

export interface NumberLit {
    kind: "NumberLit";
    value: number;
}

export interface BoolLit {
    kind: "BoolLit";
    value: boolean;
}

export interface ArrayLit {
    kind: "ArrayLit";
    elements: Expression[];
}

export interface MemberAccess {
    kind: "MemberAccess";
    receiver: Expression;
    memberName: string;
}

export interface ArrayAccess {
    kind: "ArrayAccess";
    receiver: Expression;
    indexExpression: Expression;
}

export interface LMemberAccess extends MemberAccess {
    kind: "MemberAccess";
    receiver: LExpression;
    memberName: string;
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