import Dexie, { type EntityTable } from "dexie";

import type { ConversationRow, MessageRow, MetaRow } from "./records";

export class LemmaDb extends Dexie {
    conversations!: EntityTable<ConversationRow, "id">;
    messages!: EntityTable<MessageRow, "id">;
    meta!: EntityTable<MetaRow, "key">;

    constructor(userId: string) {
        super(`lemma-${userId}`);
        this.version(1).stores({
            conversations: "id, updatedAtMs",
            messages: "id, [conversationId+createdAtMs]",
            meta: "key",
        });
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

let current: LemmaDb | null = null;

export function openDb(userId: string): LemmaDb {
    if (current?.name === `lemma-${userId}`) {
        return current;
    }
    current?.close();
    current = new LemmaDb(userId);
    return current;
}

export function getDb(): LemmaDb | null {
    return current;
}

export function closeDb(): void {
    current?.close();
    current = null;
}
