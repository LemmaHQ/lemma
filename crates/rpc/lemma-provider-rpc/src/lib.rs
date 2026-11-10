//! Connect RPC shell over the provider domain: JWT authentication,
//! proto mapping, and wire error mapping. All behavior lives in
//! `lemma-provider`.

mod provider_mapping;
mod provider_rpc;

pub use provider_rpc::ProviderRpc;
