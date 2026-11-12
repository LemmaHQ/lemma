package dev.lemmahq.lemma.i18n

import dev.lemmahq.lemma.client.ServiceFailure
import lemma.mobile.shared.generated.resources.Res
import lemma.mobile.shared.generated.resources.errors_api_format_invalid
import lemma.mobile.shared.generated.resources.errors_content_required
import lemma.mobile.shared.generated.resources.errors_credentials_invalid
import lemma.mobile.shared.generated.resources.errors_email_taken
import lemma.mobile.shared.generated.resources.errors_id_invalid
import lemma.mobile.shared.generated.resources.errors_model_required
import lemma.mobile.shared.generated.resources.errors_network
import lemma.mobile.shared.generated.resources.errors_provider_fields_required
import lemma.mobile.shared.generated.resources.errors_provider_identifier_invalid
import lemma.mobile.shared.generated.resources.errors_provider_identifier_taken
import lemma.mobile.shared.generated.resources.errors_provider_key_required
import lemma.mobile.shared.generated.resources.errors_provider_not_found
import lemma.mobile.shared.generated.resources.errors_session_not_found
import lemma.mobile.shared.generated.resources.errors_signup_fields_required
import lemma.mobile.shared.generated.resources.errors_timeout
import lemma.mobile.shared.generated.resources.errors_title_required
import lemma.mobile.shared.generated.resources.errors_token_invalid
import lemma.mobile.shared.generated.resources.errors_turn_not_running
import lemma.mobile.shared.generated.resources.errors_unspecified
import lemma.mobile.shared.generated.resources.errors_user_not_found
import lemma.mobile.shared.generated.resources.errors_username_taken

/** The localized message for a service call that failed for [failure]. */
fun errorText(failure: ServiceFailure): UiText =
    UiText.Resource(
        when (failure) {
            ServiceFailure.CredentialsInvalid -> Res.string.errors_credentials_invalid
            ServiceFailure.UsernameTaken -> Res.string.errors_username_taken
            ServiceFailure.SignupFieldsRequired -> Res.string.errors_signup_fields_required
            ServiceFailure.TokenInvalid -> Res.string.errors_token_invalid
            ServiceFailure.UserNotFound -> Res.string.errors_user_not_found
            ServiceFailure.EmailTaken -> Res.string.errors_email_taken
            ServiceFailure.ProviderFieldsRequired -> Res.string.errors_provider_fields_required
            ServiceFailure.ApiFormatInvalid -> Res.string.errors_api_format_invalid
            ServiceFailure.ProviderNotFound -> Res.string.errors_provider_not_found
            ServiceFailure.ProviderIdentifierInvalid ->
                Res.string.errors_provider_identifier_invalid
            ServiceFailure.ProviderIdentifierTaken -> Res.string.errors_provider_identifier_taken
            ServiceFailure.ProviderKeyRequired -> Res.string.errors_provider_key_required
            ServiceFailure.IdInvalid -> Res.string.errors_id_invalid
            ServiceFailure.TitleRequired -> Res.string.errors_title_required
            ServiceFailure.SessionNotFound -> Res.string.errors_session_not_found
            ServiceFailure.ContentRequired -> Res.string.errors_content_required
            ServiceFailure.ModelRequired -> Res.string.errors_model_required
            ServiceFailure.TurnNotRunning -> Res.string.errors_turn_not_running
            ServiceFailure.Network -> Res.string.errors_network
            ServiceFailure.Timeout -> Res.string.errors_timeout
            ServiceFailure.Unspecified -> Res.string.errors_unspecified
        }
    )
