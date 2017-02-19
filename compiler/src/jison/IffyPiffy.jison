%lex

%%
\s+                   /* skip whitespace */
[0-9]+("."[0-9]+)?    return 'NUMBER';
"*"                   return '*';
"/"                   return '/';
"-"                   return '-';
"+"                   return '+';
"("                   return '(';
")"                   return ')';
<<EOF>>               return 'EOF';
.                     return 'INVALID'
/lex

%left '+' '-'
%left '*' '/'
%left UNARY

%start story

%%

story
    : NUMBER { return {}; }
    ;