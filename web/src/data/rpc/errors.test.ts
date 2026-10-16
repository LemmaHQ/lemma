import { Code, ConnectError } from "@connectrpc/connect";
import type { TFunction } from "i18next";
import { expect, it } from "vitest";

import { ErrorInfoSchema, ErrorReason } from "@/gen/lemma/v1/errors_pb";
import { errorText } from "./errors";

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

it("reads an unmapped reason as unspecified", () => {
    expect(errorText(withReason(999 as ErrorReason), t)).toBe(
        "errors.unspecified",
    );
});

it("maps a transport code when no ErrorInfo detail is present", () => {
    const e = new ConnectError("network unreachable", Code.Unavailable);
    expect(errorText(e, t)).toBe("errors.network");
});

it("reads an unmapped code as unspecified", () => {
    const e = new ConnectError("internal detail", Code.Internal);
    expect(errorText(e, t)).toBe("errors.unspecified");
});

it("reads non-ConnectError values as unspecified", () => {
    expect(errorText(new Error("boom"), t)).toBe("errors.unspecified");
});
