# Authentication

## Summary

Authentication manages user account registration, identity verification, session rotation, and multi-client credential transport.
The shared authentication domain (`lemma-auth`) coordinates password hashing with Argon2, JWT access tokens, SHA-256 hashed refresh tokens with automatic rotation lineage revocation, and cross-platform transport adaptation.

## Requirements

### Account registration and roles

- THE SYSTEM SHALL require registration requests to supply a non-empty username, email address, and a password containing at least eight characters.
- THE SYSTEM SHALL hash stored password credentials using Argon2 before persistence.
- THE SYSTEM SHALL assign the owner role to the initial registered account in the system, and the normal role to subsequent accounts.
- THE SYSTEM SHALL enforce uniqueness across usernames and email addresses.

### Identity verification and tokens

- WHEN an authenticated session is initiated via login, THE SYSTEM SHALL verify user credentials against either username or email.
- Upon successful authentication, THE SYSTEM SHALL issue a dual-token pair: a short-lived JSON Web Token access token and a 30-day cryptographically random refresh token.
- THE SYSTEM SHALL sign access tokens using HMAC with the configured secret key.
- THE SYSTEM SHALL store only the SHA-256 hash of refresh tokens in the database, retaining plaintext tokens strictly in memory and client storage.

### Token rotation and revocation

- WHEN a client requests a token refresh with a valid active refresh token, THE SYSTEM SHALL issue a new token pair and link the previous refresh token to the new token in the rotation chain.
- WHEN a client presents an expired refresh token, THE SYSTEM SHALL reject the refresh request.
- WHEN a client presents a revoked or previously rotated refresh token, THE SYSTEM SHALL revoke the entire token rotation lineage to neutralize reuse attempts.
- WHEN an authenticated user logs out, THE SYSTEM SHALL mark the presented refresh token as revoked.
- WHEN an authenticated user requests their profile via the Me RPC, THE SYSTEM SHALL return the account details associated with the active token claims.

### Multi-client transport adaptation

- THE SYSTEM SHALL support cookie-based authentication transport in browser environments, setting HTTP-only cookies for token persistence.
- THE SYSTEM SHALL support Bearer token authentication headers for native and desktop client environments.
- WHERE operating in desktop local mode, THE SYSTEM SHALL support skipping manual authentication by providing predefined local credentials.

### Service interface

- THE SERVER SHALL expose authentication flows over ConnectRPC via the `AuthService` interface: SignUp, Login, Refresh, Logout, and Me.
