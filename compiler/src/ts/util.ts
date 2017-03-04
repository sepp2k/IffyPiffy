import * as util from "util";

export function p(obj: Object) {
    console.log(util.inspect(obj, { depth: undefined }));
}

// Taken from https://www.typescriptlang.org/docs/handbook/advanced-types.html#exhaustiveness-checking
export function assertNever(x: never): never {
    throw new Error("Unexpected object: " + x);
}

export function filterNulls<T>(lst: (T | null)[]): T[] {
    // Needs cast because TS won't figure out by itself that filtering with !== null
    // leaves no nulls in the result :-(
    return lst.filter(def => def !== null) as T[];
}

export type StringMap<T> = { [name: string]: T | undefined };

export function mergeMaps<T>(map1: StringMap<T>, map2: StringMap<T>): StringMap<T> {
    let result: StringMap<T> = {};
    for(let key in map1) {
        result[key] = map1[key];
    }
    for(let key in map2) {
        result[key] = map2[key];
    }
    return result;
}