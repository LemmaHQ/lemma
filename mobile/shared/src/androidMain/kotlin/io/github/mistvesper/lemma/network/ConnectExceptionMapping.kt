package io.github.mistvesper.lemma.network

import com.connectrpc.Code
import com.connectrpc.ConnectException
import io.github.mistvesper.gen.lemma.v1.ErrorInfo
import io.github.mistvesper.gen.lemma.v1.ErrorReason
import io.github.mistvesper.lemma.client.ServiceException
import io.github.mistvesper.lemma.client.ServiceFailure
import java.io.IOException

internal fun ConnectException.toServiceException(): ServiceException {
    val reason = unpackedDetails(ErrorInfo::class).firstOrNull()?.let { it.reason.toFailure() }
    val failure =
        reason
            ?: when (code) {
                Code.UNAVAILABLE -> ServiceFailure.Network
                Code.UNKNOWN ->
                    if (exception is IOException) ServiceFailure.Network
                    else ServiceFailure.Unspecified
                Code.DEADLINE_EXCEEDED -> ServiceFailure.Timeout
                else -> ServiceFailure.Unspecified
            }
    return ServiceException(failure, this)
}

private fun ErrorReason.toFailure(): ServiceFailure? =
    when (this) {
        ErrorReason.ERROR_REASON_UNSPECIFIED -> ServiceFailure.Unspecified
        ErrorReason.ERROR_REASON_PROVIDER_FIELDS_REQUIRED -> ServiceFailure.ProviderFieldsRequired
        ErrorReason.ERROR_REASON_API_FORMAT_INVALID -> ServiceFailure.ApiFormatInvalid
        ErrorReason.ERROR_REASON_PROVIDER_NOT_FOUND -> ServiceFailure.ProviderNotFound
        ErrorReason.ERROR_REASON_PROVIDER_IDENTIFIER_INVALID ->
            ServiceFailure.ProviderIdentifierInvalid
        ErrorReason.ERROR_REASON_PROVIDER_IDENTIFIER_TAKEN -> ServiceFailure.ProviderIdentifierTaken
        ErrorReason.ERROR_REASON_PROVIDER_KEY_REQUIRED -> ServiceFailure.ProviderKeyRequired
        ErrorReason.ERROR_REASON_ID_INVALID -> ServiceFailure.IdInvalid
        ErrorReason.ERROR_REASON_TITLE_REQUIRED -> ServiceFailure.TitleRequired
        ErrorReason.ERROR_REASON_SESSION_NOT_FOUND -> ServiceFailure.SessionNotFound
        ErrorReason.ERROR_REASON_DIRECTORY_NOT_FOUND -> ServiceFailure.DirectoryNotFound
        ErrorReason.ERROR_REASON_MESSAGE_NOT_FOUND -> ServiceFailure.MessageNotFound
        ErrorReason.ERROR_REASON_INVALID_BRANCH_POINT -> ServiceFailure.InvalidBranchPoint
        ErrorReason.ERROR_REASON_CONTENT_REQUIRED -> ServiceFailure.ContentRequired
        ErrorReason.ERROR_REASON_MODEL_REQUIRED -> ServiceFailure.ModelRequired
        ErrorReason.ERROR_REASON_TURN_NOT_RUNNING -> ServiceFailure.TurnNotRunning
        ErrorReason.ERROR_REASON_SESSION_BUSY -> ServiceFailure.SessionBusy
        ErrorReason.UNRECOGNIZED -> null
    }
