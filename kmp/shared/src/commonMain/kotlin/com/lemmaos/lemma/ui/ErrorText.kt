package com.lemmaos.lemma.ui

import com.lemmaos.lemma.data.AppErrorReason
import com.lemmaos.lemma.data.AppException

fun errorText(e: Throwable): String = when (e) {
    is AppException -> e.reason?.let { reasonText(it, e.attrs) } ?: fallbackText(e)
    else -> fallbackText(e)
}

private fun fallbackText(e: Throwable): String = e.message ?: e.toString()

private fun reasonText(reason: AppErrorReason, attrs: Map<String, String>): String = when (reason) {
    AppErrorReason.UNSPECIFIED -> "Something went wrong. Please try again."
    AppErrorReason.CREDENTIALS_INVALID -> "Incorrect username or password."
    AppErrorReason.USERNAME_TAKEN -> "Username or email is already taken."
    AppErrorReason.SIGNUP_FIELDS_REQUIRED ->
        "Username and email are required; password must be at least 8 characters."
    AppErrorReason.LOGIN_TARGET_REQUIRED -> "Provide exactly one of username or email."
    AppErrorReason.TOKEN_INVALID -> "Your session has expired. Please sign in again."
    AppErrorReason.USER_NOT_FOUND -> "User not found."
    AppErrorReason.PROVIDER_FIELDS_REQUIRED -> "Name, base URL and API key are required."
    AppErrorReason.PROVIDER_KIND_INVALID -> "Invalid provider type."
    AppErrorReason.PROVIDER_NOT_FOUND -> "Provider not found."
    AppErrorReason.PROVIDER_DISABLED -> "This provider is disabled."
    AppErrorReason.ID_INVALID -> "Invalid ID."
    AppErrorReason.TITLE_REQUIRED -> "Title is required."
    AppErrorReason.CONVERSATION_NOT_FOUND -> "Conversation not found."
    AppErrorReason.CONVERSATION_NOT_ACTIVE -> "Conversation not found or already archived."
    AppErrorReason.CONVERSATION_NOT_ARCHIVED -> "Conversation not found or not archived."
    AppErrorReason.ARCHIVED_CONVERSATION_NOT_FOUND -> "Archived conversation not found."
    AppErrorReason.MESSAGE_NOT_FOUND -> "Message not found."
    AppErrorReason.NOT_ASSISTANT_MESSAGE -> "Only assistant messages support this action."
    AppErrorReason.CONTENT_REQUIRED -> "Message content is required."
    AppErrorReason.MODEL_REQUIRED -> "Please select a model."
    AppErrorReason.STORAGE_ENDPOINT_REQUIRED -> "Endpoint is required."
    AppErrorReason.STORAGE_BUCKET_REQUIRED -> "Bucket is required."
    AppErrorReason.STORAGE_ACCESS_KEY_REQUIRED -> "Access key ID is required."
    AppErrorReason.STORAGE_SECRET_KEY_REQUIRED -> "Secret access key is required."
    AppErrorReason.STORAGE_NOT_CONFIGURED -> "Archive storage is not configured."
    AppErrorReason.MIGRATION_NOT_PENDING -> "There is no pending migration."
    AppErrorReason.STORAGE_HAS_ARCHIVES ->
        "Cannot delete: archived conversations still reference this storage. Restore or delete them first."
    AppErrorReason.BUCKET_NOT_FOUND ->
        "Bucket ${attrs["bucket"].orEmpty()} does not exist. Create it on the backend first."
}
