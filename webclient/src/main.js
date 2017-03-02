define(["stories", "iffypiffy"], function (storyNames, iffypiffy) {
    let storyPaths = storyNames.map(s => "../../stories/" + s + "/" + s);
    require(storyPaths, function (...stories) {
        $(document).ready(function () {
            for (let story of stories) {
                let button = $("<button></button>");
                button.click(function() {
                    iffypiffy.loadStory(story);
                });
                button.text(story.title);
                $("#button-bar").append(button);
            }
        });
    });
});