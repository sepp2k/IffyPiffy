%lex
// Make the lexer act in a sane way
%options flex
%%
[ \t\r]+                /* skip whitespace */
\\[\n]                  /* skip line breaks escaped by backslashes */
"//"[^\n]*              /* Skip comments */
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
"="                     return '=';
[\n]                    return '\n';
"if"                    return 'IF';
"then"                  return 'THEN';
"else"                  return 'ELSE';
"end"                   return 'END';
"def"                   return 'DEF';
"override"              return 'OVERRIDE';
"on"                    return 'ON';
"true"                  return 'TRUE';
"false"                 return 'FALSE';
"abstract"              return 'ABSTRACT';
[a-zA-Z_][a-zA-Z0-9_]*  return 'ID';
[0-9]+("."[0-9]+)?      return 'NUMBER';
\"(\\.|[^"])*\"         return 'STRING';
<<EOF>>                 return 'EOF';
.                       return 'INVALID';
/lex
%{
    const util = require('./parse-util');
%}

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
    : globalStatements globalStatement { $$ = $1; if($2 !== null) $$.push($2); }
    | globalStatement { $$ = $1===null ? [] : [$1]; }
    ;

globalStatement
    // We allow arbitrary expressions as the lhs, but really we only want to
    // accept variables, object members and array slots. For other kinds of
    // expressions expToLExp will cause an error.
    : postfix "=" expr "\n" { $$ = {kind: "Assignment", lhs: util.expToLExp($1), rhs: $3}; }
    | DEF ID "=" exprOrAbstract "\n" {
        $$ = {
            kind: "VariableDefinition",
            name: $2,
            body: $4
        };
    }
    | DEF ID "(" paramList ")" defBody {
        $$ = {
            kind: "FunctionDefinition",
            isOverride: false,
            name: $2,
            params: $4,
            body: $6
        };
    }
    | OVERRIDE ID "(" paramList ")" defBody {
        $$ = {
            kind: "FunctionDefinition",
            isOverride: true,
            name: $2,
            params: $4,
            body: $6
        };
    }
    | ON expr "\n" statements END { $$ = {kind: "OnHandler", event: $2, body: $4}; }
    | ID ID "\n" globalStatements END {
        $$ = {
            kind: "ObjectDefinition",
            name: $2,
            body: $4,
            parent: $1
        };
    }
    | "\n" { $$ = null; }
    ;

statements
    : statements statement { $$ = $1; $$.push($2); }
    | statement { $$ = [$1]; }
    ;

statement
    : globalStatement { $$ = $1; }
    | IF expr then statements ELSE statements END "\n" {
        $$ = {
            kind: "IfStatement",
            condition: $2,
            thenCase: $4,
            elseCase: $6
        };
    }
    | IF expr then statements END "\n" {
        $$ = {
            kind: "IfStatement",
            condition: $2,
            thenCase: $4,
            elseCase: []
        };
    }
    | expr "\n" { $$ = $1; }
    ;

then
    : "\n" THEN
    | THEN
    | "\n"
    ;

paramList
    : paramList "," ID { $1.push($3); $$ = $1; }
    | ID { $$ = [$1]; }
    | { $$ = []; }
    ;

defBody
    : "\n" statements END { $$ = $2; }
    | "=" expr "\n" { $$ = [$2]; }
    | "=" ABSTRACT "\n" { $$ = "abstract"; }
    ;

exprOrAbstract
    : expr { $$ = $1; }
    | ABSTRACT { $$ = "abstract"; }
    ;

expr
    : expr "+" mult { $$ = "TODO"; }
    | expr "-" mult { $$ = "TODO"; }
    | mult { $$ = $1; }
    ;

mult
    : mult "*" postfix { $$ = "TODO"; }
    | mult "/" postfix { $$ = "TODO"; }
    | mult "%" postfix { $$ = "TODO"; }
    | postfix { $$ = $1; }
    ;

postfix
    : prefix "(" exprList ")" { $$ = {kind: "FunctionCall", func: $1, arguments: $3}; }
    | prefix "." ID { $$ = {kind: "MemberAccess", receiver: $1, memberName: $3}; }
    | prefix "[" expr "]" { $$ = {kind: "ArrayAccess", receiver: $1, indexExpression: $3}; }
    | prefix { $$ = $1; }
    ;

prefix
    : "+" prefix { $$ = "TODO"; }
    | "-" prefix { $$ = "TODO"; }
    | primary { $$ = $1; }
    ;

primary
    : ID { $$ = {kind: "Variable", name: $1}; }
    | STRING { $$ = {kind: "StringLit", value: $1.substring(1, $1.length-1)}; }
    | NUMBER { $$ = {kind: "NumberLit", value: parseFloat($1)}; }
    | FALSE { $$ = {kind: "BoolLit", value: false}; }
    | TRUE { $$ = {kind: "BoolLit", value: true}; }
    | "[" exprList "]" { $$ = {kind: "ArrayLit", elements: $2}; }
    | "(" expr ")" { $$ = $2; }
    ;

exprList
    : exprList "," expr { $1.push($3); $$ = $1; }
    | expr { $$ = [$1]; }
    | { $$ = []; }
    ;