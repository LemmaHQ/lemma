import type { AgentItem } from "./agent-item";
import { buildTurnSteps, type TurnStep } from "./step-details";
import type { StreamSlice } from "./stream-reducer";

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

/** One user question grouped with its assistant steps along the active path. */
export interface ConversationTurn {
    id: string;
    userMessage: AgentItem;
    finalReply: AgentItem | undefined;
    steps: TurnStep[];
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

/** Groups an active path into conversation turns. */
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
        turns.push({
            id: currentUser.id,
            userMessage: currentUser,
            finalReply: assistantSteps.at(-1),
            steps: buildTurnSteps(assistantSteps),
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

/** Prepares initial optimistic state for a new outgoing user turn. */
export function prepareNewTurn(
    treeMessages: AgentItem[],
    targetParentId: string | undefined,
    providerId: string,
    model: string,
    content: string,
): PreparedTurn {
    const now = Date.now();
    const userEntry = makeUser(
        crypto.randomUUID(),
        targetParentId,
        content,
        now,
    );
    return buildPreparedTurn(
        treeMessages,
        resolveActivePath(treeMessages, targetParentId),
        userEntry,
        providerId,
        model,
        now,
    );
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
    return buildPreparedTurn(
        preTree,
        resolveActivePath(preTree, activeUser?.parentId),
        activeUser ?? makeUser(activeMessageId, undefined, ""),
        firstReply?.providerId ?? "",
        firstReply?.model ?? "",
        activeUser?.createdAtMs ?? Date.now(),
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
