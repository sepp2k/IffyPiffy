import * as fs from 'fs';
import * as iffypiffyc from './iffypiffyc';

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
    const story = iffypiffyc.parse(source);
    console.log(story);
});