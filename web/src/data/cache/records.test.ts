import "fake-indexeddb/auto";
import { create } from "@bufbuild/protobuf";
import { timestampFromDate } from "@bufbuild/protobuf/wkt";
import Dexie from "dexie";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { closeDb, LemmaDb, openDb } from "@/data/cache/database";
import {
    conversationToRow,
    deleteConversationCascade,
    listArchived,
    listConversations,
    listMessages,
    messageToRow,
    replaceArchived,
    upsertConversations,
    upsertMessages,
    type ConversationRow,
    type MessageRow,
} from "@/data/cache/records";
import {
    ConversationSchema,
    MessageSchema,
} from "@/gen/lemma/v1/conversation_pb";

function conv(
    id: string,
    over: Partial<ConversationRow> = {},
): ConversationRow {
    return {
        id,
        title: "t",
        status: 0,
        archivedAtMs: null,
        messageCount: 0,
        createdAtMs: 1000,
        updatedAtMs: 1000,
        ...over,
    };
}

function msg(
    id: string,
    convId: string,
    over: Partial<MessageRow> = {},
): MessageRow {
    return {
        id,
        conversationId: convId,
        role: "user",
        content: "c",
        providerId: "",
        model: "",
        status: 2,
        createdAtMs: 1000,
        ...over,
    };
}

describe("db", () => {
    let db: LemmaDb;

    beforeEach(async () => {
        db = openDb("records-test");
        await db.delete();
        await db.open();
    });

    afterEach(() => {
        closeDb();
    });

    it("orders messages by conversation and ascending (createdAtMs, id)", async () => {
        await upsertMessages(db, [
            msg("m2", "c1", { createdAtMs: 2 }),
            msg("m1", "c1", { createdAtMs: 1 }),
            msg("m3", "c2", { createdAtMs: 1 }),
        ]);
        const rows = await listMessages(db, "c1");
        expect(rows.map((r) => r.id)).toEqual(["m1", "m2"]);
    });

    it("breaks createdAtMs ties by id", async () => {
        await upsertMessages(db, [
            msg("m-b", "c1", { createdAtMs: 5 }),
            msg("m-a", "c1", { createdAtMs: 5 }),
        ]);
        const rows = await listMessages(db, "c1");
        expect(rows.map((r) => r.id)).toEqual(["m-a", "m-b"]);
    });

    it("cleans up archived rows not present in full refresh", async () => {
        await upsertConversations(db, [
            conv("a1", { status: 2, archivedAtMs: 1000 }),
            conv("a2", { status: 2, archivedAtMs: 2000 }),
        ]);
        await replaceArchived(db, [
            conv("a2", { status: 2, archivedAtMs: 2000 }),
        ]);
        const archived = await listArchived(db);
        expect(archived.map((r) => r.id)).toEqual(["a2"]);
    });

    it("deletes conversation cascade including all messages", async () => {
        await upsertConversations(db, [conv("c1")]);
        await upsertMessages(db, [msg("m1", "c1"), msg("m2", "c1")]);
        await deleteConversationCascade(db, "c1");
        expect(await db.conversations.get("c1")).toBeUndefined();
        expect(await listMessages(db, "c1")).toEqual([]);
    });

    it("excludes archived conversations from active list sorted descending by updatedAtMs", async () => {
        await upsertConversations(db, [
            conv("c1", { updatedAtMs: 1000 }),
            conv("c2", { updatedAtMs: 3000 }),
            conv("a1", { status: 2, archivedAtMs: 5000 }),
        ]);
        const rows = await listConversations(db);
        expect(rows.map((r) => r.id)).toEqual(["c2", "c1"]);
    });

    it("converts proto timestamps to epoch millis", () => {
        const convRow = conversationToRow(
            create(ConversationSchema, {
                id: "c1",
                title: "t",
                status: 1,
                messageCount: 3,
                createdAt: timestampFromDate(new Date(1700000001000)),
                updatedAt: timestampFromDate(new Date(1700000002000)),
            }),
        );
        expect(convRow.createdAtMs).toBe(1700000001000);
        expect(convRow.updatedAtMs).toBe(1700000002000);

        const msgRow = messageToRow(
            create(MessageSchema, {
                id: "m1",
                conversationId: "c1",
                role: "user",
                content: "hi",
                status: 2,
                createdAt: timestampFromDate(new Date(1700000003000)),
            }),
        );
        expect(msgRow.createdAtMs).toBe(1700000003000);
        expect(msgRow.content).toBe("hi");
    });

    it("tolerates missing archivedAtMs in archived list", async () => {
        await upsertConversations(db, [
            conv("a1", { status: 2, archivedAtMs: null }),
            conv("a2", { status: 2, archivedAtMs: 2000 }),
        ]);
        const rows = await listArchived(db);
        expect(rows.map((r) => r.id)).toEqual(["a2", "a1"]);
    });

    it("clears messages cached under the seq index on v3 upgrade", async () => {
        closeDb();
        const legacy = new Dexie("lemma-records-upgrade-test");
        legacy.version(2).stores({
            conversations: "id, updatedAtMs",
            messages: "id, [conversationId+seq]",
            meta: "key",
        });
        await legacy.open();
        await legacy
            .table("messages")
            .put({ id: "m1", conversationId: "c1", seq: 1, createdAtMs: 1 });
        legacy.close();

        db = openDb("records-upgrade-test");
        await db.open();
        expect(await db.messages.count()).toBe(0);
    });
});
