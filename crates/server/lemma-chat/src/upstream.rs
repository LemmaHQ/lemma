//! Bridge from the proto provider kind to canonical ProviderKind.

use lemma_adapter::ProviderKind;
use lemma_proto::lemma::v1::ProviderKind as ProtoProviderKind;

/// Maps the proto provider kind onto the canonical provider kind.
pub fn kind_of(kind: ProtoProviderKind) -> ProviderKind {
    match kind {
        ProtoProviderKind::PROVIDER_KIND_ANTHROPIC => ProviderKind::Anthropic,
        ProtoProviderKind::PROVIDER_KIND_GEMINI => ProviderKind::Gemini,
        _ => ProviderKind::OpenAiCompatible,
    }
}
