use std::path::PathBuf;
use std::sync::Arc;

use lemma_adapter::{HttpConnector, ReqwestTransport};
use lemma_agent::Agent;
use lemma_agent_rpc::AgentRpc;
use lemma_auth_rpc::AuthRpc;
use lemma_conversation::ConversationStore;
use lemma_conversation_rpc::ConversationRpc;
use lemma_provider::ProviderService;
use lemma_provider_rpc::ProviderRpc;
use sea_orm::DatabaseConnection;

use crate::secrets::Secrets;

/// Connector every provider call goes through.
type HostConnector = HttpConnector<ReqwestTransport>;

/// The four Connect services over one database: auth and providers on it
/// directly, conversations on `S`.
#[derive(Debug)]
pub struct AppState<S> {
    pub(crate) auth: AuthRpc,
    pub(crate) providers: ProviderRpc<HostConnector>,
    pub(crate) conversations: ConversationRpc<S>,
    pub(crate) agent: AgentRpc<S, HostConnector>,
}

impl<S: ConversationStore> AppState<S> {
    /// Wires the services over the database and the conversation store.
    /// With `workspaces_dir` set, turns run workspace tools under it.
    #[must_use]
    pub fn new(
        db: DatabaseConnection,
        conversations: S,
        secrets: Secrets,
        workspaces_dir: Option<PathBuf>,
    ) -> Self {
        let connector = HttpConnector::new(ReqwestTransport::new());
        let provider_service = Arc::new(ProviderService::new(
            db.clone(),
            Some(secrets.secret_key),
            connector,
        ));
        let agent = Agent::new(
            conversations.clone(),
            Arc::clone(&provider_service),
            workspaces_dir,
        );
        Self {
            auth: AuthRpc::new(db, secrets.jwt_secret.clone()),
            providers: ProviderRpc::new(provider_service, secrets.jwt_secret.clone()),
            conversations: ConversationRpc::new(conversations, secrets.jwt_secret.clone()),
            agent: AgentRpc::new(agent, secrets.jwt_secret),
        }
    }
}
