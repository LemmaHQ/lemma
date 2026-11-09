use std::fmt;

/// An access token and the refresh token that renews it.
#[derive(Clone, PartialEq, Eq)]
pub struct TokenPair {
    /// The bearer token every authenticated call carries.
    pub access_token: String,
    /// The single-use token that obtains the next pair.
    pub refresh_token: String,
}

impl fmt::Debug for TokenPair {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("TokenPair").finish_non_exhaustive()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn debug_output_hides_the_tokens() {
        let pair = TokenPair {
            access_token: "secret-access".to_owned(),
            refresh_token: "secret-refresh".to_owned(),
        };
        assert_eq!(format!("{pair:?}"), "TokenPair { .. }", "tokens redacted");
    }
}
