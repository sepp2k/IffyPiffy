export let title = "The Quick Brown Fox";
export let description = "The moving story of a quick brown fox (lots of text to test the clients)";
export let latestMessage: string;
export let isFinished: boolean;

let messages = [
    "\"The quick brown fox jumps over the lazy dog\" is an English-language pangram—a phrase that contains all of the letters of the alphabet. It is commonly used for touch-typing practice. It is also used to test typewriters and computer keyboards, show fonts, and other applications involving all of the letters in the English alphabet. Owing to its brevity and coherence, it has become widely known.",
    "The earliest known appearance of the phrase is from The Michigan School Moderator, a journal that provided many teachers with education-related news and suggestions for lessons. In an article titled \"Interesting Notes\" in the March 14, 1885 issue, the phrase is given as a suggestion for writing practice: \"The following sentence makes a good copy for practice, as it contains every letter of the alphabet: 'A quick brown fox jumps over the lazy dog.'\" Note that the phrase in this case begins with the word \"A\" rather than \"The\". Several other early sources also use this variation.\n\nAs the use of typewriters grew in the late 19th century, the phrase began appearing in typing and stenography lesson books as a practice sentence. Early examples of publications which used the phrase include Illustrative Shorthand by Linda Bronson (1888), How to Become Expert in Typewriting: A Complete Instructor Designed Especially for the Remington Typewriter (1890), and Typewriting Instructor and Stenographer's Hand-book (1892). By the turn of the 20th century, the phrase had become widely known. In the January 10, 1903, issue of Pitman's Phonetic Journal, it is referred to as \"the well known memorized typing line embracing all the letters of the alphabet\". Robert Baden-Powell's book Scouting for Boys (1908) uses the phrase as a practice sentence for signaling.",
    "The first message sent on the Moscow–Washington hotline was the test phrase \"THE QUICK BROWN FOX JUMPED OVER THE LAZY DOG'S BACK 1234567890\". Later, during testing, the Russian translators sent a message asking their American counterparts \"What does it mean when your people say 'The quick brown fox jumped over the lazy dog?'\"\n\nDuring the 20th century, technicians tested typewriters and teleprinters by typing the sentence."
];

let index: number;

export function start() {
    index = 0;
    latestMessage = messages[0];
    isFinished = false;
};

export function input(command: string) {
    if (command == "quit") {
        isFinished = true;
        latestMessage = "Quitting";
    } else {
        index++;
        if (index >= messages.length) {
            isFinished = true;
            latestMessage = "THE END";
        } else {
            latestMessage = messages[index];
        }
    }
}