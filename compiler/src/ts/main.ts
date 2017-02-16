import {ANTLRInputStream} from 'antlr4ts/ANTLRInputStream';
import {CommonTokenStream} from 'antlr4ts/CommonTokenStream';

import {IffyPiffyParser} from './antlr-gen/IffyPiffyParser';
import {IffyPiffyLexer} from './antlr-gen/IffyPiffyLexer';

const lexer = new IffyPiffyLexer(new ANTLRInputStream("Room TestRoom {}"));
const tokens = new CommonTokenStream(lexer);
const parser = new IffyPiffyParser(tokens);
console.log(parser.story());