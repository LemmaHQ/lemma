# Provider Management

## Summary

Provider Management governs configurations, credentials, and live model discovery for upstream Large Language Model providers.
The shared provider domain (`lemma-provider`) coordinates credential sealing, persistence across PostgreSQL and SQLite backends, and protocol adaptation across OpenAI-compatible, Anthropic, and Gemini APIs.

## Requirements

### Identity and configuration

- THE SYSTEM SHALL require each provider to declare a user-facing machine identifier restricted exclusively to ASCII characters.
- THE SYSTEM SHALL enforce identifier immutability after creation.
- THE SYSTEM SHALL isolate provider configurations per authenticated user account, enforcing identifier uniqueness within each user account.
- THE SYSTEM SHALL require a non-empty base URL for every provider, automatically trimming trailing slashes upon ingestion.
- THE SYSTEM SHALL permit an empty API key to support keyless and local model endpoints.
- THE SYSTEM SHALL allow provider display names to contain full UTF-8 characters.
- WHEN a provider creation request omits or leaves the display name blank, THE SYSTEM SHALL set the display name to the provider identifier.
- THE SYSTEM SHALL record creation and last-updated timestamps on every provider record.

### Credential storage and protection

- THE SYSTEM SHALL seal stored API keys at rest using authenticated symmetric encryption in environments configured with a master secret key.
- THE SYSTEM SHALL persist API keys in plaintext in local environments lacking a master secret key, maintaining direct inspectability of local storage.
- WHEN an authenticated user retrieves provider details, THE SYSTEM SHALL return the plaintext API key to support inspection and editing in the client interface.

### Remote model discovery

- THE SYSTEM SHALL discover live remote models by querying the upstream provider endpoint via HTTP.
- WHEN a discovery request supplies an existing provider identifier, THE SYSTEM SHALL execute the discovery query using the stored provider credentials.
- WHEN a discovery request supplies ad-hoc connection parameters (kind, base URL, and optional API key), THE SYSTEM SHALL execute the discovery query using the provided inline credentials.
- THE SYSTEM SHALL adapt HTTP authentication headers according to the provider protocol kind: Authorization Bearer header for OpenAI-compatible providers, x-api-key with a pinned anthropic-version header for Anthropic, and x-goog-api-key for Gemini.
- WHEN querying Gemini model listings, THE SYSTEM SHALL normalize returned model names by stripping the models/ prefix.
- THE SYSTEM SHALL default the model discovery endpoint path to /models when custom path overrides are omitted.

### Lifecycle operations

- THE SERVER SHALL expose provider operations over ConnectRPC via the `ProviderService` interface: ListProviders, CreateProvider, UpdateProvider, DeleteProvider, and FetchModels.
- WHEN an authenticated user lists providers, THE SYSTEM SHALL return all provider records owned by that user.
- WHEN updating an existing provider, THE SYSTEM SHALL apply modifications selectively to explicitly provided fields while preserving unmentioned configuration values intact.
- WHEN deleting a provider, THE SYSTEM SHALL remove the provider record from the user's account and cascade associated state.
