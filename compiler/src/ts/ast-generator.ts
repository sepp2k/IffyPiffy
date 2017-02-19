import {ParseTree} from 'antlr4ts/tree/ParseTree'
import {RuleNode} from 'antlr4ts/tree/RuleNode'
import {ErrorNode} from 'antlr4ts/tree/ErrorNode'
import {TerminalNode} from 'antlr4ts/tree/TerminalNode'
import * as ipp from './antlr-gen/IffyPiffyParser'
import {IffyPiffyVisitor} from './antlr-gen/IffyPiffyVisitor'
import * as ast from './ast'

class Visitor<Result> implements IffyPiffyVisitor<Result> {
    visit(tree: ParseTree): Result {
        return tree.accept(this);
    }
    visitChildren(node: RuleNode): Result {
        throw new Error("Unhandled node type: " + typeof(node));
    }
    visitTerminal(node: TerminalNode): Result {
        throw new Error("visitTerminal should never be called.");
    }
    visitErrorNode(node: ErrorNode): Result {
        throw new Error("visitErrorNode should never be called.");
    }
}

const storyGenerator = new class StoryGenerator extends Visitor<ast.Story> {
    private filterNulls(defs: (ast.TopLevelStatement|null)[]): ast.TopLevelStatement[] {
        // Needs cast because TS won't figure out by itself that filtering with != null
        // leaves no nulls in the result :-(
        return defs.filter(def => def != null) as ast.TopLevelStatement[];
    }
    visitStory(storyCtx: ipp.StoryContext): ast.Story {
        return {
            statements: this.filterNulls(storyCtx._statements.map(stmnt => topLevelStatementGenerator.visit(stmnt)))
        };
    }
}

function force<T>(x: T|undefined): T {
    if(x === undefined) {
        throw new Error("Unexpected undefined");
    } else {
        return x;
    }
}

const topLevelStatementGenerator = new class TopLevelStatementGenerator extends Visitor<ast.TopLevelStatement|null> {
    visitObjectDef(defCtx: ipp.ObjectDefContext): ast.TopLevelStatement {
        return {
            kind: "Definition",
            name: force(defCtx._name.text),
            body: [] // TODO
        };
    }
    visitSimpleDef(defCtx: ipp.SimpleDefContext): ast.TopLevelStatement {
        return {
            kind: "Definition",
            name: force(defCtx._name.text),
            body: [] // TODO
        };
    }
    visitAssignment(defCtx: ipp.AssignmentContext): ast.TopLevelStatement {
        return {
            kind: "Assignment",
            lhs: {} as ast.LExpression, //TODO
            rhs: {} as ast.Expression // TODO
        };
    }
    visitEmptyStatement(_: ipp.EmptyStatementContext) {
        return null;
    }
}

export function generateAst(story: ipp.StoryContext): ast.Story {
    return storyGenerator.visit(story);
}