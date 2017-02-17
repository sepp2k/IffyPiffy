import * as fs from 'fs';
import {ANTLRInputStream} from 'antlr4ts/ANTLRInputStream';
import {CommonTokenStream} from 'antlr4ts/CommonTokenStream';

import {IffyPiffyParser} from './antlr-gen/IffyPiffyParser';
import {IffyPiffyLexer} from './antlr-gen/IffyPiffyLexer';

var appName = process.argv[0] + " " + process.argv[1];
if(process.argv.length != 3) {
    console.log("Usage: " + appName + " sourceFile");
    process.exit(1);
}

const filename = process.argv[2];

fs.readFile(filename, {encoding: "utf-8"}, function (err, source) {
    if(err) {
        console.log("Couldn't open the source file: " + err);
        process.exit(2);
    }
    const lexer = new IffyPiffyLexer(new ANTLRInputStream(source));
    const tokens = new CommonTokenStream(lexer);
    const parser = new IffyPiffyParser(tokens);
    console.log(parser.story());
});