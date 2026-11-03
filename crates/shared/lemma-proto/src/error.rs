//! Coded business errors carried as Connect error details.
//!
//! Every business error must go through [`app_error`]: the reason comes
//! from the closed set in `errors.proto`, the English message here is only
//! a fallback, and the frontend localizes by reason code. Internal
//! operational errors remain code-free and retain their raw diagnostic strings.

use connectrpc::{ConnectError, ErrorCode, ErrorDetail};

use crate::lemma::v1::{ErrorInfo, ErrorReason};

const ERROR_INFO_TYPE: &str = "lemma.v1.ErrorInfo";

fn transport_code(reason: ErrorReason) -> ErrorCode {
    match reason {
        ErrorReason::CredentialsInvalid | ErrorReason::TokenInvalid => ErrorCode::Unauthenticated,
        ErrorReason::UserNotFound
        | ErrorReason::ProviderNotFound
        | ErrorReason::SessionNotFound
        | ErrorReason::TurnNotRunning => ErrorCode::NotFound,
        _ => ErrorCode::InvalidArgument,
    }
}

fn message(reason: ErrorReason) -> &'static str {
    match reason {
        ErrorReason::CredentialsInvalid => "invalid credentials",
        ErrorReason::UsernameTaken => "username already taken",
        ErrorReason::EmailTaken => "email already taken",
        ErrorReason::SignupFieldsRequired => {
            "username and email required, password at least 8 chars"
        }
        ErrorReason::TokenInvalid => "invalid token",
        ErrorReason::UserNotFound => "user not found",
        ErrorReason::ProviderFieldsRequired => "name, base_url and api_key required",
        ErrorReason::ProviderKindInvalid => "invalid provider kind",
        ErrorReason::ProviderNotFound => "provider not found",
        ErrorReason::ProviderIdentifierInvalid => "identifier must be non-empty ASCII",
        ErrorReason::ProviderIdentifierTaken => "identifier already taken",
        ErrorReason::IdInvalid => "invalid id",
        ErrorReason::TitleRequired => "title required",
        ErrorReason::SessionNotFound => "session not found",
        ErrorReason::ContentRequired => "content required",
        ErrorReason::ModelRequired => "model required",
        ErrorReason::TurnNotRunning => "turn not running",
        ErrorReason::Unspecified => "unspecified error reason",
    }
}

/// Builds a coded business error with the fallback message.
#[must_use]
pub fn app_error(reason: ErrorReason) -> ConnectError {
    let info = ErrorInfo {
        reason: reason.into(),
        ..Default::default()
    };
    ConnectError::new(transport_code(reason), message(reason))
        .with_detail(ErrorDetail::from_message(ERROR_INFO_TYPE, &info))
}
