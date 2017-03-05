define(["stories", "iffypiffy"], function (storyNames, iffypiffy) {
    let storyPaths = storyNames.map(s => "../../stories/" + s + "/" + s);
    require(storyPaths, function (...stories) {
        $(document).ready(function () {
            for (let i = 0; i < stories.length; i++) {
                let story = stories[i];
                let dir = "../../stories/" + storyNames[i];
                let button = $("<button></button>");
                button.click(function() {
                    iffypiffy.loadStory(story, dir);
                });
                button.text(story.title);
                $("#button-bar").append(button);
            }
        });
    });
});