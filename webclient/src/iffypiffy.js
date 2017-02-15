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
  return {
    loadStory: function(story) {
      outputArea.text("");
      inputArea.val("");
      outputArea.show();
      inputArea.show();
      inputArea.focus();
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
          outputArea.append(latestInput);
          iffy.story.input(input);
          iffy.executeStep();
          outputArea.scrollTo(latestInput, 500);
        }
      });
    },
    executeStep: function() {
      if(latestOutput !== null) {
        latestOutput.removeClass("current");
      }
      latestOutput = $('<div class="output current">' + htmlify(this.story.latestMessage) + '</div>');
      outputArea.append(latestOutput);
      if(this.story.isFinished) {
        inputArea.hide();
      }
    }
  };
})());
