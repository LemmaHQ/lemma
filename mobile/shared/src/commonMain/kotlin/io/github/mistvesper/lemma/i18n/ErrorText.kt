package io.github.mistvesper.lemma.i18n

import io.github.mistvesper.lemma.client.ServiceFailure
import lemma.mobile.shared.generated.resources.Res
import lemma.mobile.shared.generated.resources.errors_api_format_invalid
import lemma.mobile.shared.generated.resources.errors_content_required
import lemma.mobile.shared.generated.resources.errors_directory_not_found
import lemma.mobile.shared.generated.resources.errors_id_invalid
import lemma.mobile.shared.generated.resources.errors_invalid_branch_point
import lemma.mobile.shared.generated.resources.errors_message_not_found
import lemma.mobile.shared.generated.resources.errors_model_required
import lemma.mobile.shared.generated.resources.errors_network
import lemma.mobile.shared.generated.resources.errors_provider_fields_required
import lemma.mobile.shared.generated.resources.errors_provider_identifier_invalid
import lemma.mobile.shared.generated.resources.errors_provider_identifier_taken
import lemma.mobile.shared.generated.resources.errors_provider_key_required
import lemma.mobile.shared.generated.resources.errors_provider_not_found
import lemma.mobile.shared.generated.resources.errors_session_busy
import lemma.mobile.shared.generated.resources.errors_session_not_found
import lemma.mobile.shared.generated.resources.errors_timeout
import lemma.mobile.shared.generated.resources.errors_title_required
import lemma.mobile.shared.generated.resources.errors_turn_not_running
import lemma.mobile.shared.generated.resources.errors_unspecified

/** The localized message for a service call that failed for [failure]. */
fun errorText(failure: ServiceFailure): UiText =
    UiText.Resource(
        when (failure) {
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
            ServiceFailure.DirectoryNotFound -> Res.string.errors_directory_not_found
            ServiceFailure.MessageNotFound -> Res.string.errors_message_not_found
            ServiceFailure.InvalidBranchPoint -> Res.string.errors_invalid_branch_point
            ServiceFailure.ContentRequired -> Res.string.errors_content_required
            ServiceFailure.ModelRequired -> Res.string.errors_model_required
            ServiceFailure.TurnNotRunning -> Res.string.errors_turn_not_running
            ServiceFailure.SessionBusy -> Res.string.errors_session_busy
            ServiceFailure.Network -> Res.string.errors_network
            ServiceFailure.Timeout -> Res.string.errors_timeout
            ServiceFailure.Unspecified -> Res.string.errors_unspecified
        }
    )
