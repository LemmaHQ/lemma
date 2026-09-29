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
        // Version 3 restores the (createdAtMs, id) ordering; rows cached
        // under the previous seq index are dropped and re-pulled.
        this.version(3)
            .stores({
                conversations: "id, updatedAtMs",
                messages: "id, [conversationId+createdAtMs]",
                meta: "key",
            })
            .upgrade(async (tx) => {
                await tx.table("messages").clear();
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
