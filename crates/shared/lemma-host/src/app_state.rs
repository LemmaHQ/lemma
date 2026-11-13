use std::path::PathBuf;
use std::sync::Arc;

use lemma_adapter::{HttpConnector, ReqwestTransport};
use lemma_agent::Agent;
use lemma_provider::ProviderService;
use lemma_session::SessionService;
use sqlx::SqlitePool;

use crate::agent_rpc::AgentRpc;
use crate::provider_rpc::ProviderRpc;
use crate::secrets::Secrets;
use crate::session_rpc::SessionRpc;

type HostConnector = HttpConnector<ReqwestTransport>;

/// The Connect services wired over one database.
#[derive(Debug)]
pub struct AppState {
    pub(crate) providers: ProviderRpc<HostConnector>,
    pub(crate) sessions: SessionRpc,
    pub(crate) agent: AgentRpc<HostConnector>,
}

impl AppState {
    /// Wires the services over `db` and `workspaces_dir`.
    #[must_use]
    pub fn new(db: SqlitePool, secrets: &Secrets, workspaces_dir: PathBuf) -> Self {
        let transport = ReqwestTransport::new();
        let connector = HttpConnector::new(transport.clone());
        let provider_service = Arc::new(ProviderService::new(
            db.clone(),
            &secrets.secret_key,
            connector,
        ));
        let session_service = SessionService::new(db);
        let agent = Agent::new(
            session_service.clone(),
            Arc::clone(&provider_service),
            workspaces_dir,
            Some(transport),
        );
        Self {
            providers: ProviderRpc::new(provider_service),
            sessions: SessionRpc::new(session_service),
            agent: AgentRpc::new(agent),
        }
    }
}
