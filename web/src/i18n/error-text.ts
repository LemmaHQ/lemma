import { Code, ConnectError } from "@connectrpc/connect";
import type { ParseKeys, TFunction } from "i18next";

import { ErrorInfoSchema, ErrorReason } from "@/gen/lemma/v1/errors_pb";

const reasonKeys: Partial<Record<ErrorReason, ParseKeys>> = {
    [ErrorReason.UNSPECIFIED]: "errors.unspecified",
    [ErrorReason.PROVIDER_FIELDS_REQUIRED]: "errors.providerFieldsRequired",
    [ErrorReason.PROVIDER_IDENTIFIER_INVALID]:
        "errors.providerIdentifierInvalid",
    [ErrorReason.PROVIDER_IDENTIFIER_TAKEN]: "errors.providerIdentifierTaken",
    [ErrorReason.API_FORMAT_INVALID]: "errors.apiFormatInvalid",
    [ErrorReason.PROVIDER_KEY_REQUIRED]: "errors.providerKeyRequired",
    [ErrorReason.PROVIDER_NOT_FOUND]: "errors.providerNotFound",
    [ErrorReason.ID_INVALID]: "errors.idInvalid",
    [ErrorReason.TITLE_REQUIRED]: "errors.titleRequired",
    [ErrorReason.SESSION_NOT_FOUND]: "errors.sessionNotFound",
    [ErrorReason.DIRECTORY_NOT_FOUND]: "errors.directoryNotFound",
    [ErrorReason.MESSAGE_NOT_FOUND]: "errors.messageNotFound",
    [ErrorReason.INVALID_BRANCH_POINT]: "errors.invalidBranchPoint",
    [ErrorReason.CONTENT_REQUIRED]: "errors.contentRequired",
    [ErrorReason.MODEL_REQUIRED]: "errors.modelRequired",
    [ErrorReason.TURN_NOT_RUNNING]: "errors.turnNotRunning",
    [ErrorReason.SESSION_BUSY]: "errors.sessionBusy",
} satisfies Record<ErrorReason, ParseKeys>;

const codeKeys: Partial<Record<Code, ParseKeys>> = {
    [Code.Unavailable]: "errors.network",
    [Code.DeadlineExceeded]: "errors.timeout",
};

/** Localized text for a failed request; unmapped failures read as `errors.unspecified`. */
export function errorText(e: unknown, t: TFunction): string {
    if (e instanceof ConnectError) {
        const info = e.findDetails(ErrorInfoSchema).at(0);
        const key = info === undefined ? undefined : reasonKeys[info.reason];
        if (info !== undefined && key !== undefined) {
            return t(key);
        }
        return t(codeKeys[e.code] ?? "errors.unspecified");
    }
    return t("errors.unspecified");
}
