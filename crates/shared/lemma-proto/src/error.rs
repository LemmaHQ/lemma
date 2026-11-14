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
        ErrorReason::ProviderNotFound
        | ErrorReason::SessionNotFound
        | ErrorReason::DirectoryNotFound
        | ErrorReason::MessageNotFound
        | ErrorReason::TurnNotRunning => ErrorCode::NotFound,
        ErrorReason::SessionBusy => ErrorCode::FailedPrecondition,
        ErrorReason::Unspecified
        | ErrorReason::ProviderFieldsRequired
        | ErrorReason::ApiFormatInvalid
        | ErrorReason::ProviderKeyRequired
        | ErrorReason::ProviderIdentifierInvalid
        | ErrorReason::ProviderIdentifierTaken
        | ErrorReason::IdInvalid
        | ErrorReason::TitleRequired
        | ErrorReason::InvalidBranchPoint
        | ErrorReason::ContentRequired
        | ErrorReason::ModelRequired => ErrorCode::InvalidArgument,
    }
}

fn message(reason: ErrorReason) -> &'static str {
    match reason {
        ErrorReason::Unspecified => "unspecified error",
        ErrorReason::ProviderFieldsRequired => "name, base_url and api_key required",
        ErrorReason::ApiFormatInvalid => "invalid API format",
        ErrorReason::ProviderKeyRequired => "save an API key before enabling this provider",
        ErrorReason::ProviderNotFound => "provider not found",
        ErrorReason::ProviderIdentifierInvalid => "identifier must be non-empty ASCII",
        ErrorReason::ProviderIdentifierTaken => "identifier already taken",
        ErrorReason::IdInvalid => "invalid id",
        ErrorReason::TitleRequired => "title required",
        ErrorReason::SessionNotFound => "session not found",
        ErrorReason::DirectoryNotFound => "directory not found",
        ErrorReason::MessageNotFound => "message not found",
        ErrorReason::InvalidBranchPoint => "invalid branch point",
        ErrorReason::ContentRequired => "content required",
        ErrorReason::ModelRequired => "model required",
        ErrorReason::TurnNotRunning => "turn not running",
        ErrorReason::SessionBusy => "session already has a running turn",
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
