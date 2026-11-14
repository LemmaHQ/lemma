import type { AgentItem } from "./agent-item";

/** One 16px rail column cell to the left of a tree row's node dot. */
export type RailCell =
    | { type: "tee"; last: boolean; active: boolean }
    | { type: "bar" | "empty"; active: boolean };

/** One visible row in the flattened r14A session tree. */
export interface FlatTreeRow {
    id: string;
    role: "user" | "assistant";
    text: string;
    label?: string | undefined;
    createdAtMs?: number | undefined;
    model?: string | undefined;
    providerId?: string | undefined;
    rails: RailCell[];
    hasParentSpine: boolean;
    hasChildSpine: boolean;
    onPath: boolean;
    isLeaf: boolean;
}

type TreeNodeBase = Omit<
    FlatTreeRow,
    "rails" | "hasParentSpine" | "hasChildSpine"
>;

/** Collapsed logical node in the session branch tree. */
export interface TreeNode extends TreeNodeBase {
    children: TreeNode[];
}

interface BuildContext {
    childrenByParent: ReadonlyMap<string | undefined, AgentItem[]>;
    activeAncestors: ReadonlySet<string>;
    visited: Set<string>;
}

/** Builds active-first collapsed logical roots from raw session messages. */
export function buildCollapsedRoots(
    allMessages: AgentItem[],
    activeAncestors: ReadonlySet<string>,
): TreeNode[] {
    const byId = new Map(allMessages.map((item) => [item.id, item]));
    const childrenByParent = new Map<string | undefined, AgentItem[]>();
    for (const item of allMessages) {
        const key =
            item.parentId !== undefined && byId.has(item.parentId)
                ? item.parentId
                : undefined;
        const bucket = childrenByParent.get(key) ?? [];
        bucket.push(item);
        childrenByParent.set(key, bucket);
    }
    const ctx: BuildContext = {
        childrenByParent,
        activeAncestors,
        visited: new Set(),
    };
    return buildChildren(undefined, ctx);
}

/** Counts leaf nodes across a collapsed tree. */
export function countLeaves(nodes: TreeNode[]): number {
    return nodes.reduce(
        (sum, node) => sum + (node.isLeaf ? 1 : countLeaves(node.children)),
        0,
    );
}

function buildChildren(
    parentId: string | undefined,
    ctx: BuildContext,
): TreeNode[] {
    const raw = (ctx.childrenByParent.get(parentId) ?? []).filter(
        (c) => !ctx.visited.has(c.id),
    );
    return raw
        .map((item) => buildLogicalNode(item, ctx))
        .toSorted((a, b) => (a.onPath === b.onPath ? 0 : a.onPath ? -1 : 1));
}

function buildLogicalNode(rawItem: AgentItem, ctx: BuildContext): TreeNode {
    ctx.visited.add(rawItem.id);
    if (rawItem.role === "user") {
        const children = buildChildren(rawItem.id, ctx);
        return {
            id: rawItem.id,
            role: "user",
            text: rawItem.content,
            label: rawItem.label,
            createdAtMs: rawItem.createdAtMs,
            onPath: ctx.activeAncestors.has(rawItem.id),
            isLeaf: children.length === 0,
            children,
        };
    }
    const chain: AgentItem[] = [rawItem];
    let tail = rawItem;
    while (true) {
        const nextList = (ctx.childrenByParent.get(tail.id) ?? []).filter(
            (c) => !ctx.visited.has(c.id),
        );
        const only = nextList.length === 1 ? nextList[0] : undefined;
        if (only === undefined || only.role === "user") {
            break;
        }
        ctx.visited.add(only.id);
        chain.push(only);
        tail = only;
    }
    const children = buildChildren(tail.id, ctx);
    const lastAssistant =
        chain.findLast((item) => item.role === "assistant") ?? tail;
    const text =
        chain.findLast(
            (item) => item.role === "assistant" && item.content !== "",
        )?.content ??
        lastAssistant.error ??
        "";
    return {
        id: tail.id,
        role: "assistant",
        text,
        label: chain.findLast((item) => item.label !== undefined)?.label,
        createdAtMs: lastAssistant.createdAtMs,
        model: lastAssistant.model,
        providerId: lastAssistant.providerId,
        onPath: chain.some((item) => ctx.activeAncestors.has(item.id)),
        isLeaf: children.length === 0,
        children,
    };
}
