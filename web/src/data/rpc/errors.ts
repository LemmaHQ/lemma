import { Code, ConnectError } from "@connectrpc/connect";
import type { ParseKeys, TFunction } from "i18next";

import { ErrorInfoSchema, ErrorReason } from "@/gen/lemma/v1/errors_pb";

const reasonKeys: Partial<Record<ErrorReason, ParseKeys>> = {
    [ErrorReason.UNSPECIFIED]: "errors.unspecified",
    [ErrorReason.CREDENTIALS_INVALID]: "errors.credentialsInvalid",
    [ErrorReason.USERNAME_TAKEN]: "errors.usernameTaken",
    [ErrorReason.SIGNUP_FIELDS_REQUIRED]: "errors.signupFieldsRequired",
    [ErrorReason.LOGIN_TARGET_REQUIRED]: "errors.loginTargetRequired",
    [ErrorReason.TOKEN_INVALID]: "errors.tokenInvalid",
    [ErrorReason.USER_NOT_FOUND]: "errors.userNotFound",
    [ErrorReason.PROVIDER_FIELDS_REQUIRED]: "errors.providerFieldsRequired",
    [ErrorReason.PROVIDER_IDENTIFIER_INVALID]:
        "errors.providerIdentifierInvalid",
    [ErrorReason.PROVIDER_IDENTIFIER_TAKEN]: "errors.providerIdentifierTaken",
    [ErrorReason.PROVIDER_KIND_INVALID]: "errors.providerKindInvalid",
    [ErrorReason.PROVIDER_NOT_FOUND]: "errors.providerNotFound",
    [ErrorReason.PROVIDER_DISABLED]: "errors.providerDisabled",
    [ErrorReason.ID_INVALID]: "errors.idInvalid",
    [ErrorReason.TITLE_REQUIRED]: "errors.titleRequired",
    [ErrorReason.CONVERSATION_NOT_FOUND]: "errors.conversationNotFound",
    [ErrorReason.MESSAGE_NOT_FOUND]: "errors.messageNotFound",
    [ErrorReason.NOT_ASSISTANT_MESSAGE]: "errors.notAssistantMessage",
    [ErrorReason.CONTENT_REQUIRED]: "errors.contentRequired",
    [ErrorReason.MODEL_REQUIRED]: "errors.modelRequired",
    [ErrorReason.TURN_NOT_RUNNING]: "errors.turnNotRunning",
} satisfies Record<ErrorReason, ParseKeys>;

const codeKeys: Partial<Record<Code, ParseKeys>> = {
    [Code.Unavailable]: "errors.network",
    [Code.DeadlineExceeded]: "errors.timeout",
    [Code.Unauthenticated]: "errors.tokenInvalid",
};

/** The business reason a failed request carries, if any. */
export function errorReason(e: unknown): ErrorReason | undefined {
    return e instanceof ConnectError
        ? e.findDetails(ErrorInfoSchema).at(0)?.reason
        : undefined;
}

/** Localized text for a failed request; unmapped failures read as `errors.unspecified`. */
export function errorText(e: unknown, t: TFunction): string {
    if (e instanceof ConnectError) {
        const info = e.findDetails(ErrorInfoSchema).at(0);
        const key = info === undefined ? undefined : reasonKeys[info.reason];
        if (info !== undefined && key !== undefined) {
            // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- TFunction overloads cannot be narrowed by a type guard
            const render = t as (
                key: string,
                options?: Record<string, string>,
            ) => string;
            return render(key, info.attrs);
        }
        return t(codeKeys[e.code] ?? "errors.unspecified");
    }
    return t("errors.unspecified");
}
