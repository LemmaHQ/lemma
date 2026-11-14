package dev.lemmahq.lemma.client

/**
 * Why a service call failed: the error reason the service attached from `errors.proto`, or, for a
 * failure without one, [Network], [Timeout], or [Unspecified].
 */
enum class ServiceFailure {
    ProviderFieldsRequired,
    ApiFormatInvalid,
    ProviderNotFound,
    ProviderIdentifierInvalid,
    ProviderIdentifierTaken,
    ProviderKeyRequired,
    IdInvalid,
    TitleRequired,
    SessionNotFound,
    DirectoryNotFound,
    MessageNotFound,
    InvalidBranchPoint,
    ContentRequired,
    ModelRequired,
    TurnNotRunning,
    SessionBusy,
    Network,
    Timeout,
    Unspecified,
}
