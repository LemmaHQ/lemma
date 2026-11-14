import type { AgentItem } from "./agent-item";
import { buildTurnSteps, type TurnStep } from "./step-details";
import {
    buildCollapsedRoots,
    countLeaves,
    type FlatTreeRow,
    type RailCell,
    type TreeNode,
} from "./tree-nodes";

export type { FlatTreeRow };

/** Filter mode for the session tree drawer. */
export type TreeFilter = "all" | "questions" | "labeled";

/** One user question grouped with its assistant steps along the active path. */
export interface ConversationTurn {
    id: string;
    userMessage: AgentItem;
    assistantSteps: AgentItem[];
    finalReply: AgentItem | undefined;
    terminalId: string;
    steps: TurnStep[];
    isStreaming: boolean;
}

type PendingTee = Extract<RailCell, { type: "tee" }>;

/** Resolves the active branch path from root to effectiveLeafId in oldest-first order. */
export function resolveActivePath(
    allMessages: AgentItem[],
    effectiveLeafId: string | undefined,
): AgentItem[] {
    if (effectiveLeafId === undefined) {
        return [];
    }
    const byId = new Map(allMessages.map((item) => [item.id, item]));
    const visited = new Set<string>();
    const reversed: AgentItem[] = [];
    let cursor: string | undefined = effectiveLeafId;
    while (cursor !== undefined && !visited.has(cursor)) {
        const current = byId.get(cursor);
        if (current === undefined) {
            break;
        }
        visited.add(cursor);
        reversed.push(current);
        cursor = current.parentId;
    }
    return reversed.toReversed();
}

/** Groups an active path into conversation turns, preserving each turn's DB terminalId. */
export function groupTurns(activePath: AgentItem[]): ConversationTurn[] {
    const turns: ConversationTurn[] = [];
    let currentUser: AgentItem | null = null;
    let currentItems: AgentItem[] = [];
    const flush = () => {
        if (currentUser === null) {
            return;
        }
        const assistantSteps = currentItems.filter(
            (item) => item.role === "assistant",
        );
        const terminal = currentItems.at(-1) ?? currentUser;
        turns.push({
            id: currentUser.id,
            userMessage: currentUser,
            assistantSteps,
            finalReply: assistantSteps.at(-1),
            terminalId: terminal.id,
            steps: buildTurnSteps(assistantSteps),
            isStreaming: assistantSteps.some(
                (step) => step.status === "streaming",
            ),
        });
    };
    for (const item of activePath) {
        if (item.role === "user") {
            flush();
            currentUser = item;
            currentItems = [];
        } else if (currentUser !== null) {
            currentItems.push(item);
        }
    }
    flush();
    return turns;
}

/** Builds the collapsed, active-first, r14A rail-annotated session tree. */
export function buildSessionTree(
    allMessages: AgentItem[],
    activeLeafId: string | undefined,
    options: { search: string; filter: TreeFilter },
): { rows: FlatTreeRow[]; pathCount: number } {
    if (allMessages.length === 0) {
        return { rows: [], pathCount: 0 };
    }
    const activeAncestors = new Set(
        resolveActivePath(allMessages, activeLeafId).map((item) => item.id),
    );
    const roots = buildCollapsedRoots(allMessages, activeAncestors);
    const pathCount = countLeaves(roots);
    const needle = options.search.trim().toLowerCase();
    const matched = new Set<string>();
    const kept = new Set<string>();
    const mark = (node: TreeNode): boolean => {
        const filterOk =
            options.filter === "all" ||
            (options.filter === "questions" && node.role === "user") ||
            (options.filter === "labeled" && node.label !== undefined);
        const searchOk =
            needle === "" ||
            `${node.label ?? ""} ${node.text}`.toLowerCase().includes(needle);
        const isMatch = filterOk && searchOk;
        if (isMatch) {
            matched.add(node.id);
        }
        let childKept = false;
        for (const child of node.children) {
            if (mark(child)) {
                childKept = true;
            }
        }
        if (isMatch || childKept) {
            kept.add(node.id);
            return true;
        }
        return false;
    };
    for (const root of roots) {
        mark(root);
    }
    const rows: FlatTreeRow[] = [];
    const emitList = (
        nodes: TreeNode[],
        prefixRails: RailCell[],
        pendingTee: PendingTee | null,
        emittedInCol: boolean,
        hasParent: boolean,
    ) => {
        const visible = nodes.filter((node) => kept.has(node.id));
        const [only, second] = visible;
        if (only === undefined) {
            return;
        }
        if (second === undefined) {
            const hasKeptChild = only.children.some((c) => kept.has(c.id));
            if (matched.has(only.id)) {
                const { children: _, ...base } = only;
                rows.push({
                    ...base,
                    rails:
                        pendingTee === null
                            ? prefixRails
                            : [...prefixRails, pendingTee],
                    hasParentSpine:
                        pendingTee === null && hasParent && emittedInCol,
                    hasChildSpine: hasKeptChild,
                });
                emitList(
                    only.children,
                    flushTee(prefixRails, pendingTee),
                    null,
                    true,
                    true,
                );
            } else {
                emitList(
                    only.children,
                    prefixRails,
                    pendingTee,
                    emittedInCol,
                    hasParent,
                );
            }
            return;
        }
        const basePrefix = flushTee(prefixRails, pendingTee);
        const last = visible.length - 1;
        for (const [idx, child] of visible.entries()) {
            const tee: PendingTee = {
                type: "tee",
                last: idx === last,
                active: child.onPath,
            };
            const hasKeptChild = child.children.some((c) => kept.has(c.id));
            if (matched.has(child.id)) {
                const { children: _, ...base } = child;
                rows.push({
                    ...base,
                    rails: [...basePrefix, tee],
                    hasParentSpine: false,
                    hasChildSpine: hasKeptChild,
                });
                emitList(
                    child.children,
                    flushTee(basePrefix, tee),
                    null,
                    true,
                    true,
                );
            } else {
                emitList(child.children, basePrefix, tee, false, true);
            }
        }
    };
    emitList(roots, [], null, false, false);
    return { rows, pathCount };
}

function flushTee(
    prefix: RailCell[],
    pendingTee: PendingTee | null,
): RailCell[] {
    return pendingTee === null
        ? prefix
        : [
              ...prefix,
              {
                  type: pendingTee.last ? "empty" : "bar",
                  active: pendingTee.active,
              },
          ];
}
