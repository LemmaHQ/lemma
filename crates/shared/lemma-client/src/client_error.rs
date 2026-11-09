use std::io;

use base64::Engine;
use base64::alphabet;
use base64::engine::{DecodePaddingMode, GeneralPurpose, GeneralPurposeConfig};
use buffa::Message;
use connectrpc::rustls;
use connectrpc::{ConnectError, ErrorCode};
use lemma_proto::lemma::v1::{ErrorInfo, ErrorReason};

const ERROR_INFO_TYPE: &str = "lemma.v1.ErrorInfo";

const DETAIL_BASE64: GeneralPurpose = GeneralPurpose::new(
    &alphabet::STANDARD,
    GeneralPurposeConfig::new().with_decode_padding_mode(DecodePaddingMode::Indifferent),
);

/// A failed client operation, classified so the interface can translate it.
#[derive(Debug, thiserror::Error)]
pub enum ClientError {
    /// The service rejected the call with a business error reason.
    #[error("service rejected the call: {0:?}")]
    Reason(ErrorReason),
    /// The host could not be reached.
    #[error("host unreachable")]
    Network,
    /// The call ran past its deadline.
    #[error("call timed out")]
    Timeout,
    /// The client holds no valid tokens; the user signs in again.
    #[error("signed out")]
    SignedOut,
    /// A server URL that is not an absolute `http` or `https` URL.
    #[error("invalid server URL")]
    UrlInvalid,
    /// The remote server runs a different version than this client.
    #[error("server version {server} differs from client version {client}")]
    VersionMismatch {
        /// The version the server reports.
        server: String,
        /// This client's version.
        client: String,
    },
    /// The token store failed to write or remove tokens.
    #[error("token storage failed")]
    Storage(#[source] io::Error),
    /// The TLS configuration could not be built.
    #[error("TLS setup failed")]
    Tls(#[source] rustls::Error),
    /// An infrastructure failure, with the service's diagnostic text.
    #[error("{0}")]
    Internal(String),
}

impl ClientError {
    /// The business error reason, when the service gave one.
    #[must_use]
    pub fn reason(&self) -> Option<ErrorReason> {
        match self {
            Self::Reason(reason) => Some(*reason),
            _ => None,
        }
    }
}

impl From<ConnectError> for ClientError {
    fn from(error: ConnectError) -> Self {
        if let Some(reason) = error_reason(&error) {
            return Self::Reason(reason);
        }
        match error.code {
            ErrorCode::Unavailable => Self::Network,
            ErrorCode::DeadlineExceeded => Self::Timeout,
            ErrorCode::Unauthenticated => Self::Reason(ErrorReason::TokenInvalid),
            code => Self::Internal(error.message.unwrap_or_else(|| code.as_str().to_owned())),
        }
    }
}

/// The reason of the `ErrorInfo` detail a business error carries.
pub(crate) fn error_reason(error: &ConnectError) -> Option<ErrorReason> {
    error
        .details
        .iter()
        .filter(|detail| detail.type_url == ERROR_INFO_TYPE)
        .find_map(|detail| {
            let bytes = DETAIL_BASE64.decode(detail.value.as_deref()?).ok()?;
            ErrorInfo::decode_from_slice(&bytes).ok()?.reason.as_known()
        })
        .filter(|reason| *reason != ErrorReason::Unspecified)
}

#[cfg(test)]
mod tests {
    use base64::engine::general_purpose::STANDARD;
    use connectrpc::ErrorDetail;
    use lemma_proto::app_error;

    use super::*;

    fn detail(value: Option<&str>) -> ConnectError {
        ConnectError::invalid_argument("bad").with_detail(ErrorDetail {
            type_url: ERROR_INFO_TYPE.to_owned(),
            value: value.map(str::to_owned),
            debug: None,
        })
    }

    #[test]
    fn a_business_error_yields_its_reason() {
        let error = ClientError::from(app_error(ErrorReason::SessionNotFound));
        assert_eq!(
            error.reason(),
            Some(ErrorReason::SessionNotFound),
            "reason from the ErrorInfo detail"
        );
    }

    #[test]
    fn padded_detail_values_decode() {
        let info = ErrorInfo {
            reason: ErrorReason::TitleRequired.into(),
            ..Default::default()
        };
        let padded = STANDARD.encode(info.encode_to_vec());
        assert_eq!(
            error_reason(&detail(Some(&padded))),
            Some(ErrorReason::TitleRequired),
            "padding accepted"
        );
    }

    #[test]
    fn unreadable_and_unspecified_details_fall_back_to_the_code() {
        let unspecified = app_error(ErrorReason::Unspecified);
        for error in [
            detail(None),
            detail(Some("%%")),
            detail(Some("AQ")),
            unspecified,
        ] {
            assert!(
                matches!(ClientError::from(error), ClientError::Internal(_)),
                "no usable reason"
            );
        }
    }

    #[test]
    fn codes_without_a_reason_map_to_their_class() {
        let mut silent = ConnectError::internal("");
        silent.message = None;
        let cases = [
            (ConnectError::unavailable("down"), "host unreachable"),
            (ConnectError::deadline_exceeded("slow"), "call timed out"),
            (
                ConnectError::unauthenticated("who"),
                "service rejected the call: ERROR_REASON_TOKEN_INVALID",
            ),
            (ConnectError::internal("db failed"), "db failed"),
            (silent, "internal"),
        ];
        for (error, text) in cases {
            let error = ClientError::from(error);
            assert_eq!(error.to_string(), text, "classified {error:?}");
            assert_eq!(
                error.reason().is_some(),
                text.contains("rejected"),
                "reason only for business errors"
            );
        }
    }
}
