interface IffyPiffyObject {
    $init(): this;
    $needsInit: boolean;
    $objectName: string;
    $onInherit?(child: IffyPiffyObject): void;
}

interface IffyPiffyVerb extends IffyPiffyObject {
    syntax: string;
    defaultAction(): void;
}

interface IffyPiffyThing extends IffyPiffyObject {
    name: string;
    description: string;
}

interface IffyPiffyRoom extends IffyPiffyThing {
    description: string;
    items: IffyPiffyItem[];
}

interface IffyPiffyItem extends IffyPiffyThing {
}

let verbs: IffyPiffyVerb[] = [];
let things: IffyPiffyThing[] = [];

export namespace globals {

    export let startingRoom: IffyPiffyRoom;

    export function say(...strs: string[]) {
        latestMessage += strs.join("") + "\n";
    }

    export function playSound(soundFile: string) {
        if (typeof Audio !== "undefined") {
            new Audio(resourceDir + "/" + soundFile).play();
        }
    }

    export let Object = {
        $init() {
            this.$needsInit = false;
        },
        $objectName: "Object"
    } as IffyPiffyObject;

    export let Thing = inherit(Object, "Thing", function () {});
    Thing.$onInherit = function (child: IffyPiffyThing) {
        things.push(child);
    };

    export let Item = inherit(Thing, "Item", function () {});

    export let Room = inherit(Thing, "Room", function () {
        this.items = [];
    });

    export let Verb = inherit(Object, "Verb", function () {});
    Verb.$onInherit = function (child: IffyPiffyVerb) {
        verbs.push(child);
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

export function init<T extends IffyPiffyObject>(obj: T): T {
    return obj && obj.$needsInit ? obj.$init() : obj;
}

export function inherit(parent: IffyPiffyObject, objectName: string, initializer: () => void) {
    let child = Object.create(parent);
    child.$parent = parent;
    child.$needsInit = true;
    child.$objectName = objectName;
    child.$init = function () {
        parent.$init.call(this);
        initializer.call(this);
        return this;
    };
    // Only built-in objects have a custom $onInherit handler, so any other object simply
    // inherits the one from its parent.
    child.$onInherit = parent.$onInherit;
    if(parent.$onInherit) parent.$onInherit(child);
    return child;
}


function simplifyObject(obj: string) {
    return obj.replace(/\s*\b(the|a|an)\b\s*/, "").toLowerCase();
}

export class Story {
    title: string;
    description: string;
    room: IffyPiffyRoom;
    isFinished: boolean;
    latestMessage: string;
    initializer: () => void;

    constructor(title: string, description: string, initializer: () => void) {
        this.title = title;
        this.description = description;
        this.initializer = initializer;
    }

    start(_resourceDir = ".") {
        this.isFinished = false;
        this.initializer();
        this.room = init(globals.startingRoom);
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
                if(handlerObject === undefined) continue;
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