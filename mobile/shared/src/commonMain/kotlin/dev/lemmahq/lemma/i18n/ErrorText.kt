package dev.lemmahq.lemma.i18n

import dev.lemmahq.lemma.client.ServiceFailure
import lemma.mobile.shared.generated.resources.Res
import lemma.mobile.shared.generated.resources.error_content_required
import lemma.mobile.shared.generated.resources.error_credentials_invalid
import lemma.mobile.shared.generated.resources.error_email_taken
import lemma.mobile.shared.generated.resources.error_id_invalid
import lemma.mobile.shared.generated.resources.error_model_required
import lemma.mobile.shared.generated.resources.error_network
import lemma.mobile.shared.generated.resources.error_provider_fields_required
import lemma.mobile.shared.generated.resources.error_provider_identifier_invalid
import lemma.mobile.shared.generated.resources.error_provider_identifier_taken
import lemma.mobile.shared.generated.resources.error_provider_kind_invalid
import lemma.mobile.shared.generated.resources.error_provider_not_found
import lemma.mobile.shared.generated.resources.error_session_not_found
import lemma.mobile.shared.generated.resources.error_signup_fields_required
import lemma.mobile.shared.generated.resources.error_timeout
import lemma.mobile.shared.generated.resources.error_title_required
import lemma.mobile.shared.generated.resources.error_token_invalid
import lemma.mobile.shared.generated.resources.error_turn_not_running
import lemma.mobile.shared.generated.resources.error_unspecified
import lemma.mobile.shared.generated.resources.error_user_not_found
import lemma.mobile.shared.generated.resources.error_username_taken

/** The localized message for a service call that failed for [failure]. */
fun errorText(failure: ServiceFailure): UiText =
    UiText.Resource(
        when (failure) {
            ServiceFailure.CredentialsInvalid -> Res.string.error_credentials_invalid
            ServiceFailure.UsernameTaken -> Res.string.error_username_taken
            ServiceFailure.SignupFieldsRequired -> Res.string.error_signup_fields_required
            ServiceFailure.TokenInvalid -> Res.string.error_token_invalid
            ServiceFailure.UserNotFound -> Res.string.error_user_not_found
            ServiceFailure.EmailTaken -> Res.string.error_email_taken
            ServiceFailure.ProviderFieldsRequired -> Res.string.error_provider_fields_required
            ServiceFailure.ProviderKindInvalid -> Res.string.error_provider_kind_invalid
            ServiceFailure.ProviderNotFound -> Res.string.error_provider_not_found
            ServiceFailure.ProviderIdentifierInvalid -> Res.string.error_provider_identifier_invalid
            ServiceFailure.ProviderIdentifierTaken -> Res.string.error_provider_identifier_taken
            ServiceFailure.IdInvalid -> Res.string.error_id_invalid
            ServiceFailure.TitleRequired -> Res.string.error_title_required
            ServiceFailure.SessionNotFound -> Res.string.error_session_not_found
            ServiceFailure.ContentRequired -> Res.string.error_content_required
            ServiceFailure.ModelRequired -> Res.string.error_model_required
            ServiceFailure.TurnNotRunning -> Res.string.error_turn_not_running
            ServiceFailure.Network -> Res.string.error_network
            ServiceFailure.Timeout -> Res.string.error_timeout
            ServiceFailure.Unspecified -> Res.string.error_unspecified
        }
    )
