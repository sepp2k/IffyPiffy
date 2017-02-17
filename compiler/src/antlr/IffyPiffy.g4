grammar IffyPiffy;
story: globalStatements=definition* EOF;

statement:
    definition                                         # DefinitionStatement
  | 'if' condition=expr ('\n'? 'then' '\n'? | '\n')
      thenCase+=statement* 'else' elseCase+=statement*
      'end' '\n'?                                      # IfStatement
  | expr '\n'                                          # ExpressionStatement
;

objectBody: defs=definition*;

definition:
    type=ID name=ID '\n'? objectBody '\n'? 'end' '\n'? # ObjectDef
  | 'def' name=ID paramList? body=defBody              # VarDef
  // Technically an assignment is not a definition, but we want to allow it
  // everywhere where definitions are allowed (inside objects, at the toplevel),
  // not just where statements are allowed (i.e. in methods), so we put it here
  // rather than in statement
  // We allow arbitrary expressions here, but really we only want to accept
  // variables, object members and array slots. Other kinds of expressions
  // will be rejected later.
  // We allow a parameter list after the lhs, so we can assign a function by
  // writing name(params) = body. For that lhs should be a variable, but again
  // we'll check this at a later stage.
  | lhs=expr paramList? body=defBody                   # Assignment
  | '\n'                                               # EmptyStatement
;

paramList: ('(' (params+=ID (',' params+=ID))? ')');

defBody:
    '\n' body+=statement* '\n'? 'end' '\n'? # MultiLineBody
  | '=' body=expr '\n'                      # SingleLineBody
;

expr:
    name=ID                                          # Variable
  | value=STRING_LIT                                 # StringLiteral
  | value=NAT_LIT                                    # NaturalLiteral
  | lhs=expr op=('+'|'-') rhs=expr                   # InfixOp
  | lhs=expr op=('*'|'/'|'%') rhs=expr               # InfixOp
  | obj=expr '.' name=ID                             # MemberAccess
  | fun=expr '(' (args+=expr (',' args+=expr)*)? ')' # FunCall
  | lhs=expr '[' rhs=expr ']'                        # ArrayAccess
  | op=('-'|'+') arg=expr                            # PrefixOp
  | '[' (elems+=expr (',' elems+=expr)*)? ']'        # ArrayExpression
  | '(' expr ')'                                     # NestedExpression
;

ID: [a-zA-Z_][a-zA-Z0-9_]*;
NAT_LIT: [0-9]+;
STRING_LIT: '"' (~'"')* '"';
WS: [ \t\r]+ -> channel(HIDDEN);
ESCAPED_NEWLINE: '\\\n' -> channel(HIDDEN);