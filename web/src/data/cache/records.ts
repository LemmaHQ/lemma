import { timestampDate } from "@bufbuild/protobuf/wkt";

import type { Conversation, Message } from "@/gen/lemma/v1/conversation_pb";

import type { LemmaDb } from "./database";

export interface ConversationRow {
    id: string;
    title: string;
    status: number;
    archivedAtMs: number | null;
    createdAtMs: number;
    updatedAtMs: number;
}

export interface MessageRow {
    id: string;
    conversationId: string;
    role: string;
    content: string;
    providerId: string;
    model: string;
    status: number;
    createdAtMs: number;
}

export interface MetaRow {
    key: string;
    value: string;
}

const ms = (ts: Conversation["updatedAt"]): number =>
    ts ? timestampDate(ts).getTime() : 0;

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

export async function listConversations(
    db: LemmaDb,
): Promise<ConversationRow[]> {
    const rows = await db.conversations.toArray();
    return rows
        .filter((r) => r.status !== 2)
        .sort((a, b) => b.updatedAtMs - a.updatedAtMs);
}

export async function listArchived(db: LemmaDb): Promise<ConversationRow[]> {
    const rows = await db.conversations.toArray();
    return rows
        .filter((r) => r.status === 2)
        .sort((a, b) => (b.archivedAtMs ?? 0) - (a.archivedAtMs ?? 0));
}

export async function listMessages(
    db: LemmaDb,
    conversationId: string,
): Promise<MessageRow[]> {
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

export async function deleteMessagesOf(
    db: LemmaDb,
    conversationIds: string[],
): Promise<void> {
    if (conversationIds.length === 0) {
        return;
    }
    await db.messages.where("conversationId").anyOf(conversationIds).delete();
}
