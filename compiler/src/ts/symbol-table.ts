import { StringMap } from "./util";

export class SymbolTable<T> {
    frames: StringMap<T>[];

    constructor(startFrame: StringMap<T>|null = null) {
        this.frames = startFrame ? [startFrame] : [];
    }

    get(id: string): T | null {
        for (let i = this.frames.length - 1; i >= 0; i--) {
            let result = this.frames[i][id];
            if (result) {
                return result;
            }
        }
        return null;
    }

    set(id: string, value: T) {
        this.frames[this.frames.length - 1][id] = value;
    }

    pushFrame(frame: StringMap<T> = {}) {
        this.frames.push(frame);
    }

    popFrame() {
        this.frames.pop();
    }

}