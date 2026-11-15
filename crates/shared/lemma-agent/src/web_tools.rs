use std::fmt::Debug;

use lemma_adapter::{DeepSeekWebBackend, ExaWebBackend, HttpTransport, NativeWebBackend};
use lemma_model::Connector;
use lemma_provider::{ProviderError, ProviderService, WebProviderKind, WebSearchKind};
use lemma_tool::{LocalExecEnv, ToolRegistry, WebFetchBackend, WebSearchBackend};

pub(crate) async fn register_web_tools<C: Connector, T: HttpTransport + Debug>(
    registry: &mut ToolRegistry<LocalExecEnv>,
    providers: &ProviderService<C>,
    transport: &T,
) -> Result<(), ProviderError> {
    let search_backends = providers.web_search_backends().await?;
    let fetch_backends = providers.web_fetch_backends().await?;
    let search = search_backends
        .into_iter()
        .map(|backend| -> Box<dyn WebSearchBackend> {
            match backend.kind {
                WebSearchKind::Exa => Box::new(ExaWebBackend::new(
                    backend.base_url,
                    backend.api_key,
                    transport.clone(),
                )),
                WebSearchKind::DeepSeek => Box::new(DeepSeekWebBackend::new(
                    backend.base_url,
                    backend.api_key,
                    transport.clone(),
                )),
            }
        })
        .collect::<Vec<_>>();
    let fetch = fetch_backends
        .into_iter()
        .map(|backend| -> Box<dyn WebFetchBackend> {
            match backend.kind {
                WebProviderKind::Native => Box::new(NativeWebBackend::new(transport.clone())),
                WebProviderKind::Exa => Box::new(ExaWebBackend::new(
                    backend.base_url,
                    backend.api_key,
                    transport.clone(),
                )),
                WebProviderKind::DeepSeek => Box::new(DeepSeekWebBackend::new(
                    backend.base_url,
                    backend.api_key,
                    transport.clone(),
                )),
            }
        })
        .collect::<Vec<_>>();
    if !search.is_empty() {
        registry.register(lemma_tool::WebSearchTool::new(search));
    }
    if !fetch.is_empty() {
        registry.register(lemma_tool::WebFetchTool::new(fetch));
    }
    Ok(())
}
