interface IffyPiffyObject {
    $init(): this;
    $needsInit: boolean;
    $objectName: string;
    $onInherit?(child: IffyPiffyObject): void;
}

interface IffyPiffyVerb extends IffyPiffyObject {
    syntax: (string|IffyPiffyThing)[];
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
        latestMessage += str(...strs) + "\n";
    }

    export function str(...strs: string[]) {
        return strs.join("");
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

    export let Thing = inherit(Object, "Thing", function () {
        onHandlers.push([examine, this, function() {
            say(init(this).description);
        }]);
    });
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

    export let examine = inherit(Verb, "examine", function () {
        this.syntax = ["examine", Item];
        this.defaultAction = function () {
            say("You don't see that anywhere.");
        };
    });

    export let quit = inherit(Verb, "quit", function () {
        this.syntax = ["quit"];
        this.defaultAction = function () {
            say("Goodbye!");
            isFinished = true;
        };
    });
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
let isFinished = false;

let resourceDir = ".";

export let onHandlers: [IffyPiffyVerb, IffyPiffyThing, () => void][] = [];

export function init<T extends IffyPiffyObject>(obj: T): T {
    if (typeof obj === "object" && obj.$needsInit) {
        obj.$init();
        for (let member in obj) {
            // I can't be arsed to make the types work here
            init(obj[member] as any);
        }
    }
    return obj;
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
        isFinished = false;
        this.initializer();
        this.room = init(globals.startingRoom);
        latestMessage = "";
        resourceDir = _resourceDir;
        enterRoom(this.room);
        this.latestMessage = latestMessage;
        this.isFinished = isFinished;
    }

    private handleInput(command: string) {
        latestMessage = "";
        let tokens = command.split(/\s+/);
        if (tokens.length >= 2) {
            let [verb, ...objectParts] = tokens;
            let objectName = simplifyObject(objectParts.join(" "));
            for (let [handlerVerb, handlerObject, handler] of onHandlers) {
                if(handlerObject.name === undefined) continue;
                let handlerObjectName = simplifyObject(handlerObject.name);
                if (init(handlerVerb).syntax[0] === verb && handlerObjectName === objectName) {
                    handler.call(handlerObject);
                    return;
                }
            }
        }
        for (let verb of verbs) {
            if (init(verb).syntax[0] === tokens[0]) {
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
        this.isFinished = isFinished;
    }
}