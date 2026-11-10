import assert from "node:assert/strict";
import test from "node:test";
import { itemsOfEvent } from "./github-item.ts";

const person = { type: "User" };
const bot = { type: "Bot" };
const issue = { number: 7, title: "Title", body: null, user: person };

void test("maps an issue or pull request to its title and body", () => {
    assert.deepEqual(itemsOfEvent({ issue }), [
        { path: "issues/7", title: "Title", body: "" },
    ]);
    assert.deepEqual(
        itemsOfEvent({ pull_request: { ...issue, number: 9, body: "Body" } }),
        [{ path: "issues/9", title: "Title", body: "Body" }],
    );
});

void test("maps a comment event to the comment, not the issue it is on", () => {
    const comment = { id: 42, body: "Comment", user: person };
    assert.deepEqual(itemsOfEvent({ issue, comment }), [
        { path: "issues/comments/42", body: "Comment" },
    ]);
});

void test("skips content written by a bot", () => {
    assert.deepEqual(itemsOfEvent({ issue: { ...issue, user: bot } }), []);
    assert.deepEqual(
        itemsOfEvent({ issue, comment: { id: 1, body: "Report", user: bot } }),
        [],
    );
});
