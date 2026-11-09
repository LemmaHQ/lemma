use lemma_client::ClientError;
use lemma_proto::lemma::v1::ErrorReason;

use crate::strings::{Language, errors};

type Text = fn(Language) -> &'static str;

const REASON_TEXTS: [(ErrorReason, Text); 17] = [
    (ErrorReason::CredentialsInvalid, errors::credentials_invalid),
    (ErrorReason::UsernameTaken, errors::username_taken),
    (ErrorReason::EmailTaken, errors::email_taken),
    (
        ErrorReason::SignupFieldsRequired,
        errors::signup_fields_required,
    ),
    (ErrorReason::TokenInvalid, errors::token_invalid),
    (ErrorReason::UserNotFound, errors::user_not_found),
    (
        ErrorReason::ProviderFieldsRequired,
        errors::provider_fields_required,
    ),
    (
        ErrorReason::ProviderIdentifierInvalid,
        errors::provider_identifier_invalid,
    ),
    (
        ErrorReason::ProviderIdentifierTaken,
        errors::provider_identifier_taken,
    ),
    (
        ErrorReason::ProviderKindInvalid,
        errors::provider_kind_invalid,
    ),
    (ErrorReason::ProviderNotFound, errors::provider_not_found),
    (ErrorReason::IdInvalid, errors::id_invalid),
    (ErrorReason::TitleRequired, errors::title_required),
    (ErrorReason::SessionNotFound, errors::session_not_found),
    (ErrorReason::ContentRequired, errors::content_required),
    (ErrorReason::ModelRequired, errors::model_required),
    (ErrorReason::TurnNotRunning, errors::turn_not_running),
];

/// The interface text for a failed client operation; unmapped failures read as a generic failure.
pub(crate) fn error_text(error: &ClientError, language: Language) -> &'static str {
    let text: Text = match error {
        ClientError::Reason(reason) => REASON_TEXTS
            .iter()
            .find(|(known, _)| known == reason)
            .map_or(errors::unspecified, |(_, text)| *text),
        ClientError::Network => errors::network,
        ClientError::Timeout => errors::timeout,
        ClientError::SignedOut => errors::token_invalid,
        _ => errors::unspecified,
    };
    text(language)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn business_reasons_read_as_their_own_text() {
        assert_eq!(
            error_text(
                &ClientError::Reason(ErrorReason::CredentialsInvalid),
                Language::En
            ),
            "Incorrect username or password",
            "credentials"
        );
        assert_eq!(
            error_text(&ClientError::Reason(ErrorReason::Unspecified), Language::Zh),
            "操作失败，请重试",
            "a reason without text reads as a generic failure"
        );
    }

    #[test]
    fn transport_failures_read_as_connection_problems() {
        assert_eq!(
            error_text(&ClientError::Network, Language::En),
            "Can't reach the server, check your connection and try again",
            "unreachable host"
        );
        assert_eq!(
            error_text(&ClientError::Timeout, Language::En),
            "The request timed out, please try again",
            "deadline"
        );
        assert_eq!(
            error_text(&ClientError::SignedOut, Language::En),
            "You've been signed out. Please sign in again.",
            "lost tokens ask to sign in again"
        );
        assert_eq!(
            error_text(&ClientError::Internal("disk full".to_owned()), Language::En),
            "Something went wrong, please try again",
            "infrastructure failures stay generic"
        );
    }
}
