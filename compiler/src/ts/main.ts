import "source-map-support/register";
import * as fs from "fs";
import { p } from "./util";
import { parser } from "./parser";
import * as codegen from "./codegen";

let appName = process.argv[0] + " " + process.argv[1];
if (process.argv.length < 3) {
    console.log("Usage: " + appName + " [--print-ast] sourceFiles");
    process.exit(1);
}

let printAst = false;
for (let filename of process.argv.slice(2)) {
    if(filename === "--print-ast") {
        printAst = true;
        continue;
    }
    const outfile = filename.replace(/\.iffypiffy$/, "") + ".js";

    fs.readFile(filename, { encoding: "utf-8" }, function (err, source) {
        if (err) {
            console.log("Couldn't open the source file: " + err);
            process.exit(2);
        }
        let story = parser.parse(source);
        if(printAst) p(story);
        let js = codegen.generateJS(story);
        fs.writeFileSync(outfile, js);
    });
}