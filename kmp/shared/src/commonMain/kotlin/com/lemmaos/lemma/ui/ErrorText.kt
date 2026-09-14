package com.lemmaos.lemma.ui

import com.lemmaos.lemma.data.AppErrorReason
import com.lemmaos.lemma.data.AppException
import com.lemmaos.lemma.i18n.I18n

fun errorText(e: Throwable): String = when (e) {
    is AppException -> e.reason?.let { reasonText(it, e.attrs) } ?: fallbackText(e)
    else -> fallbackText(e)
}

private fun fallbackText(e: Throwable): String = e.message ?: e.toString()

private fun reasonText(reason: AppErrorReason, attrs: Map<String, String>): String = when (reason) {
    AppErrorReason.UNSPECIFIED -> I18n.t("errors.unspecified")
    AppErrorReason.CREDENTIALS_INVALID -> I18n.t("errors.credentialsInvalid")
    AppErrorReason.USERNAME_TAKEN -> I18n.t("errors.usernameTaken")
    AppErrorReason.SIGNUP_FIELDS_REQUIRED -> I18n.t("errors.signupFieldsRequired")
    AppErrorReason.LOGIN_TARGET_REQUIRED -> I18n.t("errors.loginTargetRequired")
    AppErrorReason.TOKEN_INVALID -> I18n.t("errors.tokenInvalid")
    AppErrorReason.USER_NOT_FOUND -> I18n.t("errors.userNotFound")
    AppErrorReason.PROVIDER_FIELDS_REQUIRED -> I18n.t("errors.providerFieldsRequired")
    AppErrorReason.PROVIDER_KIND_INVALID -> I18n.t("errors.providerKindInvalid")
    AppErrorReason.PROVIDER_NOT_FOUND -> I18n.t("errors.providerNotFound")
    AppErrorReason.PROVIDER_DISABLED -> I18n.t("errors.providerDisabled")
    AppErrorReason.ID_INVALID -> I18n.t("errors.idInvalid")
    AppErrorReason.TITLE_REQUIRED -> I18n.t("errors.titleRequired")
    AppErrorReason.CONVERSATION_NOT_FOUND -> I18n.t("errors.conversationNotFound")
    AppErrorReason.CONVERSATION_NOT_ACTIVE -> I18n.t("errors.conversationNotActive")
    AppErrorReason.CONVERSATION_NOT_ARCHIVED -> I18n.t("errors.conversationNotArchived")
    AppErrorReason.ARCHIVED_CONVERSATION_NOT_FOUND -> I18n.t("errors.archivedConversationNotFound")
    AppErrorReason.MESSAGE_NOT_FOUND -> I18n.t("errors.messageNotFound")
    AppErrorReason.NOT_ASSISTANT_MESSAGE -> I18n.t("errors.notAssistantMessage")
    AppErrorReason.CONTENT_REQUIRED -> I18n.t("errors.contentRequired")
    AppErrorReason.MODEL_REQUIRED -> I18n.t("errors.modelRequired")
    AppErrorReason.STORAGE_ENDPOINT_REQUIRED -> I18n.t("errors.storageEndpointRequired")
    AppErrorReason.STORAGE_BUCKET_REQUIRED -> I18n.t("errors.storageBucketRequired")
    AppErrorReason.STORAGE_ACCESS_KEY_REQUIRED -> I18n.t("errors.storageAccessKeyRequired")
    AppErrorReason.STORAGE_SECRET_KEY_REQUIRED -> I18n.t("errors.storageSecretKeyRequired")
    AppErrorReason.STORAGE_NOT_CONFIGURED -> I18n.t("errors.storageNotConfigured")
    AppErrorReason.MIGRATION_NOT_PENDING -> I18n.t("errors.migrationNotPending")
    AppErrorReason.STORAGE_HAS_ARCHIVES -> I18n.t("errors.storageHasArchives")
    AppErrorReason.BUCKET_NOT_FOUND ->
        I18n.t("errors.bucketNotFound", "bucket" to attrs["bucket"].orEmpty())
}
