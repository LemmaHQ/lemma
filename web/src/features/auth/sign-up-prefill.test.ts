import { expect, it } from "vitest";

import { prefillFromIdentifier, readSignUpPrefill } from "./sign-up-prefill";

it.each([
    ["alice@example.com", { email: "alice@example.com" }],
    ["alice", { username: "alice" }],
])("prefills sign-up from the identifier %s", (identifier, prefill) => {
    expect(prefillFromIdentifier(identifier)).toEqual(prefill);
});

it.each([
    ["a username", { username: "alice" }, { username: "alice" }],
    ["an email", { email: "a@x.io" }, { email: "a@x.io" }],
    ["no navigation state", null, {}],
    ["a string state", "alice", {}],
    ["an unrelated object", { from: "/signin" }, {}],
    ["non-string fields", { username: 1, email: false }, {}],
])("reads %s from navigation state", (_case, state, prefill) => {
    expect(readSignUpPrefill(state)).toEqual(prefill);
});
