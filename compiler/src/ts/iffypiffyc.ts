import {ANTLRInputStream} from 'antlr4ts/ANTLRInputStream';
import {CommonTokenStream} from 'antlr4ts/CommonTokenStream';

import {IffyPiffyParser} from './antlr-gen/IffyPiffyParser';
import {IffyPiffyLexer} from './antlr-gen/IffyPiffyLexer';

import {generateAst} from './ast-generator'

export function parse(source: string) {
    const lexer = new IffyPiffyLexer(new ANTLRInputStream(source));
    const tokens = new CommonTokenStream(lexer);
    const parser = new IffyPiffyParser(tokens);
    const story = parser.story();
    return generateAst(story);
}