import { ConnectError } from "@connectrpc/connect";

import { ErrorInfoSchema, type ErrorReason } from "@/gen/lemma/v1/errors_pb";

/** The business reason a failed request carries, if any. */
export function errorReason(e: unknown): ErrorReason | undefined {
    return e instanceof ConnectError
        ? e.findDetails(ErrorInfoSchema).at(0)?.reason
        : undefined;
}
