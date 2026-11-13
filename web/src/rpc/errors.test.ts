import { Code, ConnectError } from "@connectrpc/connect";
import { expect, it } from "vitest";

import { ErrorInfoSchema, ErrorReason } from "@/gen/lemma/v1/errors_pb";

import { errorReason } from "./errors";

it("returns the ErrorReason from a ConnectError detail", () => {
    const error = new ConnectError("done", Code.FailedPrecondition, undefined, [
        {
            desc: ErrorInfoSchema,
            value: { reason: ErrorReason.TURN_NOT_RUNNING },
        },
    ]);

    expect(errorReason(error)).toBe(ErrorReason.TURN_NOT_RUNNING);
});

it("returns undefined for ConnectErrors without ErrorInfo and other errors", () => {
    expect(
        errorReason(new ConnectError("plain", Code.Internal)),
    ).toBeUndefined();
    expect(errorReason(new Error("boom"))).toBeUndefined();
});
