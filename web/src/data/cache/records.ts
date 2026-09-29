import { timestampDate } from "@bufbuild/protobuf/wkt";

import type { Conversation, Message } from "@/gen/lemma/v1/conversation_pb";

import type { LemmaDb } from "./database";

/**
 * Cached conversation: the proto entity flattened.
 * Timestamps are epoch millis, since IndexedDB keys cannot hold a bigint.
 */
export interface ConversationRow {
    id: string;
    title: string;
    // ConversationStatus enum value; 2 is archived.
    status: number;
    archivedAtMs: number | null;
    createdAtMs: number;
    updatedAtMs: number;
}

/** Cached message; same flattening rules as ConversationRow. */
export interface MessageRow {
    id: string;
    conversationId: string;
    role: string;
    content: string;
    providerId: string;
    model: string;
    // MessageStatus enum value, kept as a number.
    status: number;
    createdAtMs: number;
}

export interface MetaRow {
    key: string;
    value: string;
}

const ms = (ts: Conversation["updatedAt"]): number =>
    ts ? timestampDate(ts).getTime() : 0;

/** Flattens a proto Conversation into a cache row. */
export function conversationToRow(c: Conversation): ConversationRow {
    return {
        id: c.id,
        title: c.title,
        status: c.status,
        archivedAtMs: c.archivedAt ? ms(c.archivedAt) : null,
        createdAtMs: ms(c.createdAt),
        updatedAtMs: ms(c.updatedAt),
    };
}

/** Flattens a proto Message like conversationToRow. */
export function messageToRow(m: Message): MessageRow {
    return {
        id: m.id,
        conversationId: m.conversationId,
        role: m.role,
        content: m.content,
        providerId: m.providerId,
        model: m.model,
        status: m.status,
        createdAtMs: ms(m.createdAt),
    };
}

/** Active conversations, most recently updated first. */
export async function listConversations(
    db: LemmaDb,
): Promise<ConversationRow[]> {
    const rows = await db.conversations.toArray();
    // Status 2 is ConversationStatus.ARCHIVED.
    return rows
        .filter((r) => r.status !== 2)
        .sort((a, b) => b.updatedAtMs - a.updatedAtMs);
}

/** Archived conversations, most recently archived first. */
export async function listArchived(db: LemmaDb): Promise<ConversationRow[]> {
    const rows = await db.conversations.toArray();
    return rows
        .filter((r) => r.status === 2)
        .sort((a, b) => (b.archivedAtMs ?? 0) - (a.archivedAtMs ?? 0));
}

/** All cached messages of a conversation, oldest first. */
export async function listMessages(
    db: LemmaDb,
    conversationId: string,
): Promise<MessageRow[]> {
    // The compound index covers exactly this conversation's rows in
    // (createdAtMs, id) order, matching the server's ordering key.
    return db.messages
        .where("[conversationId+createdAtMs]")
        .between([conversationId, 0], [conversationId, Infinity])
        .toArray();
}

export async function upsertConversations(
    db: LemmaDb,
    rows: ConversationRow[],
): Promise<void> {
    await db.conversations.bulkPut(rows);
}

export async function upsertMessages(
    db: LemmaDb,
    rows: MessageRow[],
): Promise<void> {
    await db.messages.bulkPut(rows);
}

/**
 * Full refresh of the archived list: cached archived rows absent from the
 * new list are deleted, and their ids are returned so the caller can
 * cascade-delete their messages.
 */
export async function replaceArchived(
    db: LemmaDb,
    rows: ConversationRow[],
): Promise<string[]> {
    return db.transaction("rw", db.conversations, async () => {
        const keep = new Set(rows.map((r) => r.id));
        const stale = await db.conversations
            .filter((r) => r.status === 2 && !keep.has(r.id))
            .toArray();
        await db.conversations.bulkDelete(stale.map((r) => r.id));
        await db.conversations.bulkPut(rows);
        return stale.map((r) => r.id);
    });
}

/**
 * Deletes cached active conversations absent from the server's roster and
 * returns their ids, so the caller can cascade-delete their messages.
 */
export async function pruneActiveExcept(
    db: LemmaDb,
    keepIds: Set<string>,
): Promise<string[]> {
    return db.transaction("rw", db.conversations, async () => {
        const stale = await db.conversations
            .filter((r) => r.status !== 2 && !keepIds.has(r.id))
            .toArray();
        await db.conversations.bulkDelete(stale.map((r) => r.id));
        return stale.map((r) => r.id);
    });
}

export async function deleteConversationCascade(
    db: LemmaDb,
    id: string,
): Promise<void> {
    await db.transaction("rw", db.conversations, db.messages, async () => {
        await db.conversations.delete(id);
        await db.messages.where("conversationId").equals(id).delete();
    });
}

/**
 * Drops the cached messages of the given conversations. Messages of
 * archived conversations live only in the server-side archive, so a
 * restored conversation re-pulls its history.
 */
export async function deleteMessagesOf(
    db: LemmaDb,
    conversationIds: string[],
): Promise<void> {
    if (conversationIds.length === 0) return;
    await db.messages.where("conversationId").anyOf(conversationIds).delete();
}
