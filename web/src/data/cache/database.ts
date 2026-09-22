import Dexie, { type EntityTable } from "dexie";

import type { ConversationRow, MessageRow, MetaRow } from "./records";

/** Per-user cache database; separate databases keep accounts isolated. */
export class LemmaDb extends Dexie {
    conversations!: EntityTable<ConversationRow, "id">;
    messages!: EntityTable<MessageRow, "id">;
    meta!: EntityTable<MetaRow, "key">;

    constructor(userId: string) {
        super(`lemma-${userId}`);
        // Dexie version blocks are append-only: never edit a shipped one,
        // add the next number instead.
        this.version(1).stores({
            conversations: "id, updatedAtMs",
            messages: "id, [conversationId+createdAtMs]",
            meta: "key",
        });
        // Version 2 re-indexes messages by seq instead of createdAtMs;
        // rows cached under the old ordering are dropped and re-pulled.
        this.version(2)
            .stores({
                conversations: "id, updatedAtMs",
                messages: "id, [conversationId+seq]",
                meta: "key",
            })
            .upgrade(async (tx) => {
                await tx.table("messages").clear();
                await tx.table("meta").delete("cursor");
            });
    }
}

// The open database is a module-level singleton; openDb swaps it when the
// account changes.
let current: LemmaDb | null = null;

export function openDb(userId: string): LemmaDb {
    if (current?.name === `lemma-${userId}`) return current;
    current?.close();
    current = new LemmaDb(userId);
    return current;
}

/** Returns the open database, or null when signed out. */
export function getDb(): LemmaDb | null {
    return current;
}

export function closeDb(): void {
    current?.close();
    current = null;
}
