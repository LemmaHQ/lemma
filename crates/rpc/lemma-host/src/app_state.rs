use std::path::PathBuf;
use std::sync::Arc;

use lemma_adapter::{HttpConnector, ReqwestTransport};
use lemma_agent::Agent;
use lemma_agent_rpc::AgentRpc;
use lemma_auth_rpc::AuthRpc;
use lemma_provider::ProviderService;
use lemma_provider_rpc::ProviderRpc;
use lemma_session::SessionService;
use lemma_session_rpc::SessionRpc;
use lemma_system_rpc::SystemRpc;
use sea_orm::DatabaseConnection;

use crate::secrets::Secrets;

/// Connector every provider call goes through.
type HostConnector = HttpConnector<ReqwestTransport>;

/// The five Connect services over one database.
#[derive(Debug)]
pub struct AppState {
    pub(crate) auth: AuthRpc,
    pub(crate) providers: ProviderRpc<HostConnector>,
    pub(crate) sessions: SessionRpc,
    pub(crate) agent: AgentRpc<HostConnector>,
    pub(crate) system: SystemRpc,
}

impl AppState {
    /// Wires the services over the database. With `workspaces_dir` set,
    /// turns run workspace tools under it.
    #[must_use]
    pub fn new(db: DatabaseConnection, secrets: Secrets, workspaces_dir: Option<PathBuf>) -> Self {
        let connector = HttpConnector::new(ReqwestTransport::new());
        let provider_service = Arc::new(ProviderService::new(
            db.clone(),
            secrets.secret_key,
            connector,
        ));
        let session_service = SessionService::new(db.clone());
        let agent = Agent::new(
            session_service.clone(),
            Arc::clone(&provider_service),
            workspaces_dir,
        );
        Self {
            auth: AuthRpc::new(db, secrets.jwt_secret.clone()),
            providers: ProviderRpc::new(provider_service, secrets.jwt_secret.clone()),
            sessions: SessionRpc::new(session_service, secrets.jwt_secret.clone()),
            agent: AgentRpc::new(agent, secrets.jwt_secret),
            system: SystemRpc,
        }
    }
}
