var readline = require("readline");
var path = require("path");
var runtime = require("../../runtime/runtime");
var story = require(path.resolve(process.argv[2]));

if(typeof story === "function") story = story(runtime);

var rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: "> "
});

function executeStep() {
  console.log(story.latestMessage);
  if(story.isFinished) {
    process.exit();
  } else {
    rl.prompt();
  }
}

process.stdout.write("\033]0;" + story.title + " - IffyPiffy\007");

story.start();
executeStep();

rl.on("line", function (line) {
  story.input(line);
  executeStep();
}).on('close', function () {
  process.exit();
});