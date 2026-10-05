import { ConnectError } from "@connectrpc/connect";
import type { ParseKeys, TFunction } from "i18next";

import { ErrorInfoSchema, ErrorReason } from "@/gen/lemma/v1/errors_pb";

const reasonKeys: Record<ErrorReason, ParseKeys> = {
    [ErrorReason.UNSPECIFIED]: "errors.unspecified",
    [ErrorReason.CREDENTIALS_INVALID]: "errors.credentialsInvalid",
    [ErrorReason.USERNAME_TAKEN]: "errors.usernameTaken",
    [ErrorReason.SIGNUP_FIELDS_REQUIRED]: "errors.signupFieldsRequired",
    [ErrorReason.LOGIN_TARGET_REQUIRED]: "errors.loginTargetRequired",
    [ErrorReason.TOKEN_INVALID]: "errors.tokenInvalid",
    [ErrorReason.USER_NOT_FOUND]: "errors.userNotFound",
    [ErrorReason.PROVIDER_FIELDS_REQUIRED]: "errors.providerFieldsRequired",
    [ErrorReason.PROVIDER_KIND_INVALID]: "errors.providerKindInvalid",
    [ErrorReason.PROVIDER_NOT_FOUND]: "errors.providerNotFound",
    [ErrorReason.PROVIDER_DISABLED]: "errors.providerDisabled",
    [ErrorReason.ID_INVALID]: "errors.idInvalid",
    [ErrorReason.TITLE_REQUIRED]: "errors.titleRequired",
    [ErrorReason.CONVERSATION_NOT_FOUND]: "errors.conversationNotFound",
    [ErrorReason.CONVERSATION_NOT_ACTIVE]: "errors.conversationNotActive",
    [ErrorReason.CONVERSATION_NOT_ARCHIVED]: "errors.conversationNotArchived",
    [ErrorReason.ARCHIVED_CONVERSATION_NOT_FOUND]:
        "errors.archivedConversationNotFound",
    [ErrorReason.MESSAGE_NOT_FOUND]: "errors.messageNotFound",
    [ErrorReason.NOT_ASSISTANT_MESSAGE]: "errors.notAssistantMessage",
    [ErrorReason.CONTENT_REQUIRED]: "errors.contentRequired",
    [ErrorReason.MODEL_REQUIRED]: "errors.modelRequired",
};

export function errorText(e: unknown, t: TFunction): string {
    if (e instanceof ConnectError) {
        const info = e.findDetails(ErrorInfoSchema)[0];
        const key = info ? reasonKeys[info.reason] : undefined;
        if (info && key) {
            const render = t as (
                key: string,
                options?: Record<string, string>,
            ) => string;
            return render(key, info.attrs);
        }
        return e.message;
    }
    return String(e);
}
