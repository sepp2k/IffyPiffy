(function (root, story) {
  if (typeof define === 'function' && define.amd) {
    define([], function() { return story; });
  } else if (typeof exports === 'object') {
    module.exports = story;
  } else {
    root.echo = story;
  }
})(this, {
  title: "Echo",
  description: "A small \"story\" that just repeats what the user says (small story to test the clients)",
  start: function() {
    this.latestMessage = "Hello (type \"quit\" to quit)";
    this.inputMode = "prompt";
    this.room = null;
    this.isFinished = false;
  },
  input: function(command) {
    if(command == "quit") {
      this.isFinished = true;
      this.latestMessage = "Quitting";
    } else {
      this.latestMessage = "You said: " + command;
    }
  }
});