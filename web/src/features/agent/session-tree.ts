import {
    formatClockTime,
    type TreePaneRow,
    type TreeRailSegment,
} from "@lemma/ui";

import { resolveActivePath } from "./active-path";
import type { UiMessage } from "./ui-message";

interface TreeNode {
    id: string;
    kind: "question" | "answer";
    title: string;
    label: string | undefined;
    meta: string | undefined;
    onPath: boolean;
    isLeaf: boolean;
    children: TreeNode[];
}

interface BuildContext {
    childrenByParent: ReadonlyMap<string | undefined, UiMessage[]>;
    activeAncestors: ReadonlySet<string>;
    visited: Set<string>;
}

/** Builds the collapsed, active-first, rail-annotated rows for `SessionTreePane`. */
export function buildSessionTree(
    allMessages: UiMessage[],
    activeLeafId: string | undefined,
): { rows: TreePaneRow[]; pathCount: number } {
    if (allMessages.length === 0) {
        return { rows: [], pathCount: 0 };
    }
    const activeAncestors = new Set(
        resolveActivePath(allMessages, activeLeafId).map((item) => item.id),
    );
    const roots = buildCollapsedRoots(allMessages, activeAncestors);
    const pathCount = countLeaves(roots);
    const rows: TreePaneRow[] = [];

    const emitList = (
        nodes: TreeNode[],
        prefixRails: TreeRailSegment[],
        emittedInCol: boolean,
        hasParent: boolean,
    ) => {
        const [only, second] = nodes;
        if (only === undefined) {
            return;
        }
        if (second === undefined) {
            rows.push({
                id: only.id,
                kind: only.kind,
                title: only.title,
                label: only.label,
                meta: only.meta,
                rails: prefixRails,
                hasTopSpine: hasParent && emittedInCol,
                hasBottomSpine: only.children.length > 0,
                onPath: only.onPath,
                isLeaf: only.isLeaf,
            });
            emitList(only.children, prefixRails, true, true);
            return;
        }
        const last = nodes.length - 1;
        for (const [idx, child] of nodes.entries()) {
            rows.push({
                id: child.id,
                kind: child.kind,
                title: child.title,
                label: child.label,
                meta: child.meta,
                rails: [...prefixRails, "tee"],
                hasTopSpine: false,
                hasBottomSpine: child.children.length > 0,
                onPath: child.onPath,
                isLeaf: child.isLeaf,
            });
            emitList(
                child.children,
                [...prefixRails, idx === last ? "empty" : "bar"],
                true,
                true,
            );
        }
    };

    emitList(roots, [], false, false);
    return { rows, pathCount };
}

function buildCollapsedRoots(
    allMessages: UiMessage[],
    activeAncestors: ReadonlySet<string>,
): TreeNode[] {
    const byId = new Map(allMessages.map((item) => [item.id, item]));
    const childrenByParent = new Map<string | undefined, UiMessage[]>();
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

function countLeaves(nodes: TreeNode[]): number {
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
        (child) => !ctx.visited.has(child.id),
    );
    return raw
        .map((item) => buildLogicalNode(item, ctx))
        .toSorted((a, b) => (a.onPath === b.onPath ? 0 : a.onPath ? -1 : 1));
}

function buildLogicalNode(rawItem: UiMessage, ctx: BuildContext): TreeNode {
    ctx.visited.add(rawItem.id);
    if (rawItem.role === "user") {
        const children = buildChildren(rawItem.id, ctx);
        return {
            id: rawItem.id,
            kind: "question",
            title: rawItem.content,
            label: rawItem.label,
            meta:
                rawItem.createdAtMs === undefined
                    ? undefined
                    : formatClockTime(rawItem.createdAtMs),
            onPath: ctx.activeAncestors.has(rawItem.id),
            isLeaf: children.length === 0,
            children,
        };
    }
    const chain: UiMessage[] = [rawItem];
    let tail = rawItem;
    while (true) {
        const nextList = (ctx.childrenByParent.get(tail.id) ?? []).filter(
            (child) => !ctx.visited.has(child.id),
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
    const model = lastAssistant.model === "" ? undefined : lastAssistant.model;
    return {
        id: tail.id,
        kind: "answer",
        title: text === "" ? (model ?? "") : text,
        label: chain.findLast((item) => item.label !== undefined)?.label,
        meta:
            model ??
            (lastAssistant.createdAtMs === undefined
                ? undefined
                : formatClockTime(lastAssistant.createdAtMs)),
        onPath: chain.some((item) => ctx.activeAncestors.has(item.id)),
        isLeaf: children.length === 0,
        children,
    };
}
