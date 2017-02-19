%lex
// Make the lexer act in a sane way
%options flex
%%
[ \t\r]+                /* skip whitespace */
\\[\n]                  /* skip line breaks escaped by backslashes */
"*"                     return '*';
"/"                     return '/';
"%"                     return '%';
"-"                     return '-';
"+"                     return '+';
"("                     return '(';
")"                     return ')';
"["                     return '[';
"]"                     return ']';
","                     return ',';
"."                     return '.';
":"                     return ':';
"="                     return '=';
[\n]                    return '\n';
"if"                    return 'IF';
"then"                  return 'THEN';
"else"                  return 'ELSE';
"end"                   return 'END';
"def"                   return 'DEF';
"true"                  return 'TRUE';
"false"                 return 'FALSE';
[a-zA-Z_][a-zA-Z0-9_]*  return 'ID';
[0-9]+("."[0-9]+)?      return 'NUMBER';
\"(\\.|[^"])*\"         return 'STRING';
<<EOF>>                 return 'EOF';
.                       return 'INVALID';
/lex

%start story

%%

story
    : globalStatements EOF {
        return {statements: $1.filter(s => s !== null)};
    }
    | EOF {
        return [];
    }
    ;

globalStatements
    : globalStatements globalStatement { $$ = $1; $$.push($2); }
    | globalStatement { $$ = [$1]; }
    ;

globalStatement
    // We allow arbitrary expressions as the lhs, but really we only want to
    // accept variables, object members and array slots. Other kinds of expressions
    // will be rejected later.
    // We allow a parameter list after the lhs, so we can assign a function by
    // writing f(x) = body.
    : postfix "=" defBody { $$ = {}; }
    | postfix "(" ")" "=" defBody { $$ = {}; }
    | postfix "(" paramList ")" "=" defBody { $$ = {}; }
    // TODO: Optionally allow types for non-abstract defs as well
    | DEF ID ":" ID { $$ = {}; }
    | DEF postfix "=" defBody { $$ = {}; }
    | DEF postfix "(" ")" "=" defBody { $$ = {}; }
    | DEF postfix "(" paramList ")" "=" defBody { $$ = {}; }
    | ID ID "\n" globalStatements END { $$ = {}; }
    | "\n" { $$ = null; }
    ;

statements
    : statements statement { $$ = $1; $$.push($2); }
    | statement { $$ = [$1]; }
    ;

statement
    : globalStatement { $$ = $1; }
    | IF expr then statements ELSE statements END "\n" { $$ = {}; }
    | IF expr then statements END "\n" { $$ = {}; }
    | expr "\n" { $$ = $1; }
    ;

then
    : "\n" THEN
    | THEN
    | "\n"
    ;

paramList
    : paramList "," param { $1.push($3); $$ = $1; }
    | param { $$ = [$1]; }
    ;

param
    : ID ":" ID { $$ = {name: $0, type: $2}; }
    ;

defBody
    : "\n" statement* END { $$ = $2; }
    | expr "\n" { $$ = [$2]; }
    ;

expr
    : expr "+" mult { $$ = {}; }
    | expr "-" mult { $$ = {}; }
    | mult { $$ = $1; }
    ;

mult
    : mult "*" funCall { $$ = {}; }
    | mult "/" funCall { $$ = {}; }
    | mult "%" funCall { $$ = {}; }
    | funCall { $$ = $1; }
    ;

funCall
    : postfix "(" ")" { $$ = {}; }
    | postfix "(" exprList ")" { $$ = {}; }
    | postfix { $$ = $1; }
    ;

postfix
    : funCall "." ID { $$ = {}; }
    | funCall "[" expr "]" { $$ = {}; }
    | prefix { $$ = $1; }
    ;

prefix
    : "+" prefix { $$ = {}; }
    | "-" prefix { $$ = {}; }
    | primary { $$ = $1; }
    ;

primary
    : ID { $$ = {kind: "Variable", name: $1}; }
    | STRING { $$ = {}; }
    | NUMBER { $$ = {}; }
    | FALSE { $$ = {}; }
    | TRUE { $$ = {}; }
    | "[" exprList "]" { $$ = {}; }
    | "(" expr ")" { $$ = $2; }
    ;

exprList
    : exprList "," expr { $1.push($3); $$ = $1; }
    | expr { $$ = [$1]; }
    ;