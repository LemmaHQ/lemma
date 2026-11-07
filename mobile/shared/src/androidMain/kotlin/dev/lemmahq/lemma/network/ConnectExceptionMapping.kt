package dev.lemmahq.lemma.network

import com.connectrpc.Code
import com.connectrpc.ConnectException
import dev.lemmahq.gen.lemma.v1.ErrorInfo
import dev.lemmahq.gen.lemma.v1.ErrorReason
import dev.lemmahq.lemma.client.ServiceException
import dev.lemmahq.lemma.client.ServiceFailure
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
                Code.UNAUTHENTICATED -> ServiceFailure.TokenInvalid
                else -> ServiceFailure.Unspecified
            }
    return ServiceException(failure, this)
}

private fun ErrorReason.toFailure(): ServiceFailure? =
    when (this) {
        ErrorReason.ERROR_REASON_UNSPECIFIED -> ServiceFailure.Unspecified
        ErrorReason.ERROR_REASON_CREDENTIALS_INVALID -> ServiceFailure.CredentialsInvalid
        ErrorReason.ERROR_REASON_USERNAME_TAKEN -> ServiceFailure.UsernameTaken
        ErrorReason.ERROR_REASON_SIGNUP_FIELDS_REQUIRED -> ServiceFailure.SignupFieldsRequired
        ErrorReason.ERROR_REASON_TOKEN_INVALID -> ServiceFailure.TokenInvalid
        ErrorReason.ERROR_REASON_USER_NOT_FOUND -> ServiceFailure.UserNotFound
        ErrorReason.ERROR_REASON_EMAIL_TAKEN -> ServiceFailure.EmailTaken
        ErrorReason.ERROR_REASON_PROVIDER_FIELDS_REQUIRED -> ServiceFailure.ProviderFieldsRequired
        ErrorReason.ERROR_REASON_PROVIDER_KIND_INVALID -> ServiceFailure.ProviderKindInvalid
        ErrorReason.ERROR_REASON_PROVIDER_NOT_FOUND -> ServiceFailure.ProviderNotFound
        ErrorReason.ERROR_REASON_PROVIDER_IDENTIFIER_INVALID ->
            ServiceFailure.ProviderIdentifierInvalid
        ErrorReason.ERROR_REASON_PROVIDER_IDENTIFIER_TAKEN -> ServiceFailure.ProviderIdentifierTaken
        ErrorReason.ERROR_REASON_ID_INVALID -> ServiceFailure.IdInvalid
        ErrorReason.ERROR_REASON_TITLE_REQUIRED -> ServiceFailure.TitleRequired
        ErrorReason.ERROR_REASON_SESSION_NOT_FOUND -> ServiceFailure.SessionNotFound
        ErrorReason.ERROR_REASON_CONTENT_REQUIRED -> ServiceFailure.ContentRequired
        ErrorReason.ERROR_REASON_MODEL_REQUIRED -> ServiceFailure.ModelRequired
        ErrorReason.ERROR_REASON_TURN_NOT_RUNNING -> ServiceFailure.TurnNotRunning
        ErrorReason.UNRECOGNIZED -> null
    }
