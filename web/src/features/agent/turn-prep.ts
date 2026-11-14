import type { AgentItem } from "./agent-item";
import type { StreamSlice } from "./stream-reducer";
import { resolveActivePath } from "./tree";

/** Store slice fields updated during a live turn. */
export interface TurnStoreSlice extends StreamSlice {
    treeMessages: AgentItem[];
    leafId: string | undefined;
    streaming: boolean;
    turnStartedAtMs: number | null;
}

/** Initial state and metadata prepared for a live or resumed turn. */
export interface PreparedTurn {
    providerId: string;
    model: string;
    aiTempId: string;
    userPlaceholderId: string;
    preTree: AgentItem[];
    baseCount: number;
    patch: TurnStoreSlice;
}

/** Default cleared fields when opening or resetting an active session. */
export const EMPTY_SESSION_SLICE: TurnStoreSlice & { rewind: null } = {
    treeMessages: [],
    leafId: undefined,
    items: [],
    streaming: false,
    turnStartedAtMs: null,
    currentStep: null,
    reconnectingOffset: null,
    rewind: null,
};

/** Normalizes empty or absent protocol identifier strings to undefined. */
export function nonEmptyId(value: string | undefined): string | undefined {
    return value === undefined || value === "" ? undefined : value;
}

/** Prepares initial live-turn state when resuming an active message after open. */
export function prepareResumedTurn(
    treeMessages: AgentItem[],
    activeMessageId: string,
): PreparedTurn {
    const activeUser = treeMessages.find((m) => m.id === activeMessageId);
    const firstReply = treeMessages.find(
        (m) => m.parentId === activeMessageId && m.role === "assistant",
    );
    const preTree = removeSubtree(treeMessages, activeMessageId);
    const basePath = resolveActivePath(preTree, activeUser?.parentId);
    const userEntry = activeUser ?? makeUser(activeMessageId, undefined, "");
    return buildPreparedTurn(
        preTree,
        basePath,
        userEntry,
        firstReply?.providerId ?? "",
        firstReply?.model ?? "",
        activeUser?.createdAtMs ?? Date.now(),
    );
}

/** Prepares initial optimistic state for a new outgoing user turn. */
export function prepareNewTurn(
    treeMessages: AgentItem[],
    targetParentId: string | undefined,
    providerId: string,
    model: string,
    content: string,
): PreparedTurn {
    const basePath = resolveActivePath(treeMessages, targetParentId);
    const now = Date.now();
    const userEntry = makeUser(
        crypto.randomUUID(),
        targetParentId,
        content,
        now,
    );
    return buildPreparedTurn(
        treeMessages,
        basePath,
        userEntry,
        providerId,
        model,
        now,
    );
}

function buildPreparedTurn(
    preTree: AgentItem[],
    basePath: AgentItem[],
    userEntry: AgentItem,
    providerId: string,
    model: string,
    turnStartedAtMs: number,
): PreparedTurn {
    const aiTempId = `${userEntry.id}:ai`;
    const aiEntry: AgentItem = {
        id: aiTempId,
        parentId: userEntry.id,
        role: "assistant",
        content: "",
        thinking: "",
        status: "streaming",
        providerId,
        model,
        toolCalls: [],
        createdAtMs: userEntry.createdAtMs,
    };
    return {
        providerId,
        model,
        aiTempId,
        userPlaceholderId: userEntry.id,
        preTree,
        baseCount: basePath.length,
        patch: {
            treeMessages: [...preTree, userEntry, aiEntry],
            leafId: aiTempId,
            items: [...basePath, userEntry, aiEntry],
            streaming: true,
            turnStartedAtMs,
            currentStep: null,
            reconnectingOffset: null,
        },
    };
}

function makeUser(
    id: string,
    parentId: string | undefined,
    content: string,
    createdAtMs?: number,
): AgentItem {
    return {
        id,
        parentId,
        role: "user",
        content,
        thinking: "",
        status: "done",
        providerId: "",
        model: "",
        toolCalls: [],
        createdAtMs,
    };
}

function removeSubtree(items: AgentItem[], rootId: string): AgentItem[] {
    const removed = new Set<string>([rootId]);
    let changed = true;
    while (changed) {
        changed = false;
        for (const item of items) {
            if (
                !removed.has(item.id) &&
                item.parentId !== undefined &&
                removed.has(item.parentId)
            ) {
                removed.add(item.id);
                changed = true;
            }
        }
    }
    return items.filter((item) => !removed.has(item.id));
}
