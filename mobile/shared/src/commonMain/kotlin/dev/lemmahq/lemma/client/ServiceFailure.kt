package dev.lemmahq.lemma.client

/**
 * Why a service call failed: the error reason the service attached from `errors.proto`, or, for a
 * failure without one, [Network], [Timeout], [TokenInvalid] for an unauthenticated call, or
 * [Unspecified].
 */
enum class ServiceFailure {
    CredentialsInvalid,
    UsernameTaken,
    SignupFieldsRequired,
    TokenInvalid,
    UserNotFound,
    EmailTaken,
    ProviderFieldsRequired,
    ApiFormatInvalid,
    ProviderNotFound,
    ProviderIdentifierInvalid,
    ProviderIdentifierTaken,
    ProviderKeyRequired,
    IdInvalid,
    TitleRequired,
    SessionNotFound,
    ContentRequired,
    ModelRequired,
    TurnNotRunning,
    Network,
    Timeout,
    Unspecified,
}
