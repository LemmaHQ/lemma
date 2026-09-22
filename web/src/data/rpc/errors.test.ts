import { Code, ConnectError } from "@connectrpc/connect";
import type { TFunction } from "i18next";
import { expect, it } from "vitest";

import { ErrorInfoSchema, ErrorReason } from "@/gen/lemma/v1/errors_pb";
import { errorText } from "./errors";

// The stub echoes the key so assertions pin the reason→key mapping itself,
// independent of locale wording.
const t = ((key: string) => key) as unknown as TFunction;

function withReason(reason: ErrorReason): ConnectError {
    return new ConnectError("raw message", Code.NotFound, undefined, [
        { desc: ErrorInfoSchema, value: { reason, attrs: {} } },
    ]);
}

it("maps app error reason to i18n key", () => {
    expect(errorText(withReason(ErrorReason.PROVIDER_NOT_FOUND), t)).toBe(
        "errors.providerNotFound",
    );
});

// ConnectError.message carries a "[code] " prefix by design.
it("falls back to raw English message when reason has no mapping", () => {
    expect(errorText(withReason(999 as ErrorReason), t)).toBe(
        "[not_found] raw message",
    );
});

it("displays the ConnectError message as-is when no ErrorInfo detail is present", () => {
    const e = new ConnectError("network unreachable", Code.Unavailable);
    expect(errorText(e, t)).toBe("[unavailable] network unreachable");
});

it("stringifies non-ConnectError instances", () => {
    expect(errorText(new Error("boom"), t)).toBe("Error: boom");
    expect(errorText("plain", t)).toBe("plain");
});
