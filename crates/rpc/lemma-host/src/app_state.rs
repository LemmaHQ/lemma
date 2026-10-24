use std::path::PathBuf;
use std::sync::Arc;

use lemma_adapter::{HttpConnector, ReqwestTransport};
use lemma_agent::Agent;
use lemma_agent_rpc::AgentRpc;
use lemma_auth::AuthStore;
use lemma_auth_rpc::AuthRpc;
use lemma_conversation::ConversationStore;
use lemma_conversation_rpc::ConversationRpc;
use lemma_provider::{ProviderService, ProviderStore};
use lemma_provider_rpc::ProviderRpc;

use crate::secrets::Secrets;

/// Connector every provider call goes through.
type HostConnector = HttpConnector<ReqwestTransport>;

/// The four Connect services over one storage backend: auth on `A`,
/// conversations on `S`, providers on `P`.
#[derive(Debug)]
pub struct AppState<A, S, P> {
    pub(crate) auth: AuthRpc<A>,
    pub(crate) providers: ProviderRpc<P, HostConnector>,
    pub(crate) conversations: ConversationRpc<S>,
    pub(crate) agent: AgentRpc<S, P, HostConnector>,
}

impl<A: AuthStore, S: ConversationStore, P: ProviderStore> AppState<A, S, P> {
    /// Wires the services over the backend's stores. With `workspaces_dir`
    /// set, turns run workspace tools under it.
    #[must_use]
    pub fn new(
        auth: A,
        conversations: S,
        providers: P,
        secrets: Secrets,
        workspaces_dir: Option<PathBuf>,
    ) -> Self {
        let connector = HttpConnector::new(ReqwestTransport::new());
        let provider_service = Arc::new(ProviderService::new(
            providers,
            Some(secrets.secret_key),
            connector,
        ));
        let agent = Agent::new(
            conversations.clone(),
            Arc::clone(&provider_service),
            workspaces_dir,
        );
        Self {
            auth: AuthRpc::new(auth, secrets.jwt_secret.clone()),
            providers: ProviderRpc::new(provider_service, secrets.jwt_secret.clone()),
            conversations: ConversationRpc::new(conversations, secrets.jwt_secret.clone()),
            agent: AgentRpc::new(agent, secrets.jwt_secret),
        }
    }
}
