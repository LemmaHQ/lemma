use http::Uri;

use crate::client_error::ClientError;

/// The host a client talks to; each connection keeps its own tokens.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum Connection {
    /// The local engine running inside the application.
    Local,
    /// A `lemma-server` at an `http` or `https` base URL without a trailing slash.
    Remote(String),
}

impl Connection {
    /// A remote connection to `url` with surrounding whitespace and trailing slashes removed.
    ///
    /// # Errors
    ///
    /// [`ClientError::UrlInvalid`] unless `url` is an absolute `http` or `https` URL.
    pub fn remote(url: &str) -> Result<Self, ClientError> {
        Ok(Self::Remote(parse_remote(url)?.0))
    }
}

/// The trimmed base URL and its parsed form.
pub(crate) fn parse_remote(url: &str) -> Result<(String, Uri), ClientError> {
    let url = url.trim().trim_end_matches('/');
    let uri: Uri = url.parse().map_err(|_| ClientError::UrlInvalid)?;
    match (uri.scheme_str(), uri.host()) {
        (Some("http" | "https"), Some(_)) => Ok((url.to_owned(), uri)),
        _ => Err(ClientError::UrlInvalid),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn remote_urls_are_trimmed() {
        assert!(
            matches!(Connection::remote(" https://lemma.example/ "), Ok(Connection::Remote(url)) if url == "https://lemma.example"),
            "whitespace and trailing slash removed"
        );
        assert!(
            matches!(Connection::remote("http://10.0.0.2:1025"), Ok(Connection::Remote(url)) if url == "http://10.0.0.2:1025"),
            "plain http with a port"
        );
    }

    #[test]
    fn only_absolute_http_urls_are_accepted() {
        for url in [
            "",
            "lemma.example",
            "ftp://lemma.example",
            "http://",
            "not a url",
        ] {
            assert!(
                matches!(Connection::remote(url), Err(ClientError::UrlInvalid)),
                "{url:?} rejected"
            );
        }
    }
}
