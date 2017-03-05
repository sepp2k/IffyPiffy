import {p} from "./util";

export type StringTree = string | {children: StringTree[]};

export function empty(): StringTree {
    return {children: []};
}

export function concat(...trees: StringTree[]) {
    return {children: trees};
}

export function join(trees: StringTree[], separator: string): StringTree {
    if(trees.length === 0) return "";
    let children = [];
    for(let i = 0; i < trees.length - 1; i++) {
        children.push(trees[i]);
        children.push(separator);
    }
    children.push(trees[trees.length - 1]);
    return { children: children };
}

export function toString(tree: StringTree, separator = " ") {
    let strings: string[] = [];
    function traverse(tree: StringTree) {
        if(typeof(tree) === "string") {
            strings.push(tree);
        } else {
            for(let child of tree.children) {
                traverse(child);
            }
        }
    }
    traverse(tree);
    return strings.join(separator);
}