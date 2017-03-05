export let title = "Echo";
export let description = "A small \"story\" that just repeats what the user says (small story to test the clients)";
export let latestMessage: string;
export let isFinished: boolean;

export function start() {
    latestMessage = "Hello (type \"quit\" to quit)";
    isFinished = false;
}

export function input(command: string) {
    if (command === "quit") {
        isFinished = true;
        latestMessage = "Quitting";
    } else {
        latestMessage = "You said: " + command;
    }
}