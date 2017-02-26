import * as util from "util";

export function p(obj: Object) {
    console.log(util.inspect(obj, {depth: undefined}));
}

// Taken from https://www.typescriptlang.org/docs/handbook/advanced-types.html#exhaustiveness-checking
export function assertNever(x: never): never {
    throw new Error("Unexpected object: " + x);
}