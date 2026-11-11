import { Code, ConnectError } from "@connectrpc/connect";
import type { TFunction } from "i18next";
import { expect, it } from "vitest";

import { ErrorInfoSchema, ErrorReason } from "@/gen/lemma/v1/errors_pb";
import { errorText } from "./error-text";

// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- mock t only needs the call signature
const t = ((key: string) => key) as unknown as TFunction;

function withReason(reason: number): ConnectError {
    return new ConnectError("raw message", Code.NotFound, undefined, [
        { desc: ErrorInfoSchema, value: { reason } },
    ]);
}

it.each([
    [ErrorReason.PROVIDER_NOT_FOUND, "errors.providerNotFound"],
    [ErrorReason.DIRECTORY_NOT_FOUND, "errors.directoryNotFound"],
    [ErrorReason.DIRECTORY_UNSUPPORTED, "errors.directoryUnsupported"],
])("maps app error reason %s to i18n key", (reason, key) => {
    expect(errorText(withReason(reason), t)).toBe(key);
});

it("reads an unmapped reason as unspecified", () => {
    expect(errorText(withReason(999), t)).toBe("errors.unspecified");
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
