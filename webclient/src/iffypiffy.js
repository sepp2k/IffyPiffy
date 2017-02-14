(function (root, mod) {
  if (typeof define === 'function' && define.amd) {
    define([], function() { return mod; });
  } else if (typeof exports === 'object') {
    module.exports = mod;
  } else {
    root.iffypiffy = mod;
  }
})(this, (function() {
  function htmlify(message) {
    return message.replace(/\n\n/g, "<p/>").replace(/\n/g, "<br/>");
  }
  var outputArea = $("#story");
  var inputArea = $("#input");
  var title = $("#story-title");
  var latestOutput = null;
  var latestInput = null;
  function append(message) {
    outputArea.append(message);
    // TODO: Handle the case where the appended message takes up more than one screen
    var scrollHeight = Math.max(outputArea[0].scrollHeight, outputArea[0].clientHeight);
    outputArea[0].scrollTop = scrollHeight - outputArea[0].clientHeight;
  }
  return {
    loadStory: function(story) {
      outputArea.text("");
      inputArea.val("");
      outputArea.show();
      inputArea.show();
      this.story = story;
      story.start();
      this.executeStep();
      title.text(story.title);
      var iffy = this;
      inputArea.off('keyup');
      inputArea.keyup(function(event) {
        if(event.keyCode === 13){
          var input = inputArea.val();
          inputArea.val("");
          if(latestInput !== null) {
            latestInput.removeClass("current");
          }
          latestInput = $('<div class="input current">' + input + '</div>');
          append(latestInput);
          iffy.story.input(input);
          iffy.executeStep();
        }
      });
    },
    executeStep: function() {
      if(latestOutput !== null) {
        latestOutput.removeClass("current");
      }
      latestOutput = $('<div class="output current">' + htmlify(this.story.latestMessage) + '</div>');
      append(latestOutput);
      if(this.story.isFinished) {
        inputArea.hide();
      }
    }
  };
})());