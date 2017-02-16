grammar IffyPiffy;
story: defs=definition*;
definition:
    type=ID name=ID '{' objectBody '}'     # ObjectDef
  | name=qid '=' expression ';'            # Assignment
  | varKind name=qid ('=' expression)? ';' # VarDef
  ;

objectBody:;

qid: ids+=ID ('.' ids+=ID)*;
expression:
    name=qid         # Variable
  | value=STRING_LIT # StringLiteral
  ;

varKind: 'var' | 'const';

ID: [a-zA-Z_][a-zA-Z0-9_]*;
STRING_LIT: '"' [^"] '"';
WS: [ \t\r\n]+ -> channel(HIDDEN);