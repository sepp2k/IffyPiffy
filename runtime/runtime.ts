interface IffyPiffyObject {
    $init(): this;
    $needsInit(): boolean;
    $onInherit?(child: IffyPiffyObject): void;
}

interface IffyPiffyVerb extends IffyPiffyObject {
    syntax: string;
    defaultAction(): void;
}

interface IffyPiffyRoom extends IffyPiffyObject {
    description: string;
    items: IffyPiffyItem[];
}

interface IffyPiffyItem extends IffyPiffyObject {
    name: string;
    description: string;
}

export namespace globals {

    export let story: { description?: string, title?: string } = {};

    export let startingRoom: IffyPiffyRoom;

    export function say(...strs: string[]) {
        latestMessage += strs.join("") + "\n";
    }

    export function playSound(soundFile: string) {
        if (typeof Audio !== "undefined") {
            new Audio(resourceDir + "/" + soundFile).play();
        }
    }

    export let Item = {};

    export let Room = {};

    export let Verb = {
        $onInherit: function (child: IffyPiffyVerb) {
            verbs.push(child);
        }
    };
}

function enterRoom(room: IffyPiffyRoom) {
    latestMessage += init(room).description;
    if (room.items && room.items.length > 0) {
        latestMessage += "\n\nYou see here:\n";
        for (let i = 0; i < room.items.length - 1; i++) {
            latestMessage += init(room.items[i]).name + ", ";
        }
        latestMessage += "and " + init(room.items[room.items.length - 1]).name + ".";
    }
}

let latestMessage: string = "";

let resourceDir = ".";

export let onHandlers: [IffyPiffyVerb, string, () => void][] = [];

export let verbs: IffyPiffyVerb[] = [];

export function init<T extends IffyPiffyObject>(obj: T): T {
    return obj && obj.$needsInit ? obj.$init() : obj;
}

export function inherit(parent: IffyPiffyObject, childProps: {}) {
    let child = Object.assign(Object.create(parent), childProps);
    if (parent.$onInherit) parent.$onInherit(child);
    return child;
}


function simplifyObject(obj: string) {
    return obj.replace(/\s*\b(the|a|an)\b\s*/, "").toLowerCase();
}

export class Story {
    title = globals.story.title;
    description = globals.story.description;
    room: IffyPiffyRoom;
    isFinished: boolean;
    latestMessage: string;

    start(_resourceDir = ".") {
        this.room = init(globals.startingRoom);
        this.isFinished = false;
        latestMessage = "";
        resourceDir = _resourceDir;
        enterRoom(this.room);
        this.latestMessage = latestMessage;
    }

    private handleInput(command: string) {
                if (command === "quit") {
            this.isFinished = true;
            return;
        }
        latestMessage = "";
        let tokens = command.split(/\s+/);
        if (tokens.length >= 2) {
            let [verb, ...objectParts] = tokens;
            let object = simplifyObject(objectParts.join(" "));
            for (let [handlerVerb, handlerObject, handler] of onHandlers) {
                handlerObject = simplifyObject(handlerObject);
                if (init(handlerVerb).syntax.split(/\s+/)[0] === verb && handlerObject === object) {
                    handler();
                    return;
                }
            }
        }
        for (let verb of verbs) {
            if (init(verb).syntax.split(/\s+/)[0] === tokens[0]) {
                verb.defaultAction();
                return;
            }
        }
        globals.say("I'm sorry, but I could not understand you.");
    }

    input(command: string) {
        latestMessage = "";
        this.handleInput(command);
        this.latestMessage = latestMessage;
    }
}