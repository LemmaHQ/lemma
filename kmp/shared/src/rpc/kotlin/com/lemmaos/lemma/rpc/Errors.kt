package com.lemmaos.lemma.rpc

import com.connectrpc.ConnectException
import com.connectrpc.ResponseMessage
import com.lemmaos.gen.lemma.v1.ErrorInfo
import com.lemmaos.gen.lemma.v1.ErrorReason
import com.lemmaos.lemma.data.AppErrorReason
import com.lemmaos.lemma.data.AppException

fun ConnectException.toAppException(): AppException {
    val info = unpackedDetails(ErrorInfo::class).firstOrNull()
    return AppException(info?.reason?.toApp(), info?.attrsMap.orEmpty(), message)
}

private fun ErrorReason.toApp(): AppErrorReason? = when (this) {
    ErrorReason.ERROR_REASON_UNSPECIFIED -> AppErrorReason.UNSPECIFIED
    ErrorReason.ERROR_REASON_CREDENTIALS_INVALID -> AppErrorReason.CREDENTIALS_INVALID
    ErrorReason.ERROR_REASON_USERNAME_TAKEN -> AppErrorReason.USERNAME_TAKEN
    ErrorReason.ERROR_REASON_SIGNUP_FIELDS_REQUIRED -> AppErrorReason.SIGNUP_FIELDS_REQUIRED
    ErrorReason.ERROR_REASON_LOGIN_TARGET_REQUIRED -> AppErrorReason.LOGIN_TARGET_REQUIRED
    ErrorReason.ERROR_REASON_TOKEN_INVALID -> AppErrorReason.TOKEN_INVALID
    ErrorReason.ERROR_REASON_USER_NOT_FOUND -> AppErrorReason.USER_NOT_FOUND
    ErrorReason.ERROR_REASON_PROVIDER_FIELDS_REQUIRED -> AppErrorReason.PROVIDER_FIELDS_REQUIRED
    ErrorReason.ERROR_REASON_PROVIDER_KIND_INVALID -> AppErrorReason.PROVIDER_KIND_INVALID
    ErrorReason.ERROR_REASON_PROVIDER_NOT_FOUND -> AppErrorReason.PROVIDER_NOT_FOUND
    ErrorReason.ERROR_REASON_PROVIDER_DISABLED -> AppErrorReason.PROVIDER_DISABLED
    ErrorReason.ERROR_REASON_ID_INVALID -> AppErrorReason.ID_INVALID
    ErrorReason.ERROR_REASON_TITLE_REQUIRED -> AppErrorReason.TITLE_REQUIRED
    ErrorReason.ERROR_REASON_CONVERSATION_NOT_FOUND -> AppErrorReason.CONVERSATION_NOT_FOUND
    ErrorReason.ERROR_REASON_CONVERSATION_NOT_ACTIVE -> AppErrorReason.CONVERSATION_NOT_ACTIVE
    ErrorReason.ERROR_REASON_CONVERSATION_NOT_ARCHIVED -> AppErrorReason.CONVERSATION_NOT_ARCHIVED
    ErrorReason.ERROR_REASON_ARCHIVED_CONVERSATION_NOT_FOUND -> AppErrorReason.ARCHIVED_CONVERSATION_NOT_FOUND
    ErrorReason.ERROR_REASON_MESSAGE_NOT_FOUND -> AppErrorReason.MESSAGE_NOT_FOUND
    ErrorReason.ERROR_REASON_NOT_ASSISTANT_MESSAGE -> AppErrorReason.NOT_ASSISTANT_MESSAGE
    ErrorReason.ERROR_REASON_CONTENT_REQUIRED -> AppErrorReason.CONTENT_REQUIRED
    ErrorReason.ERROR_REASON_MODEL_REQUIRED -> AppErrorReason.MODEL_REQUIRED
    ErrorReason.ERROR_REASON_STORAGE_ENDPOINT_REQUIRED -> AppErrorReason.STORAGE_ENDPOINT_REQUIRED
    ErrorReason.ERROR_REASON_STORAGE_BUCKET_REQUIRED -> AppErrorReason.STORAGE_BUCKET_REQUIRED
    ErrorReason.ERROR_REASON_STORAGE_ACCESS_KEY_REQUIRED -> AppErrorReason.STORAGE_ACCESS_KEY_REQUIRED
    ErrorReason.ERROR_REASON_STORAGE_SECRET_KEY_REQUIRED -> AppErrorReason.STORAGE_SECRET_KEY_REQUIRED
    ErrorReason.ERROR_REASON_STORAGE_NOT_CONFIGURED -> AppErrorReason.STORAGE_NOT_CONFIGURED
    ErrorReason.ERROR_REASON_MIGRATION_NOT_PENDING -> AppErrorReason.MIGRATION_NOT_PENDING
    ErrorReason.ERROR_REASON_STORAGE_HAS_ARCHIVES -> AppErrorReason.STORAGE_HAS_ARCHIVES
    ErrorReason.ERROR_REASON_BUCKET_NOT_FOUND -> AppErrorReason.BUCKET_NOT_FOUND
    ErrorReason.UNRECOGNIZED -> null
}

fun <T> ResponseMessage<T>.orThrowApp(): T = when (this) {
    is ResponseMessage.Success -> message
    is ResponseMessage.Failure -> throw cause.toAppException()
}
