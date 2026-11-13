use std::fmt::Debug;

use lemma_adapter::{DeepSeekWebBackend, ExaWebBackend, HttpTransport, NativeWebBackend};
use lemma_model::Connector;
use lemma_provider::{ProviderError, ProviderService, WebBackend, WebFunction, WebProviderKind};
use lemma_tool::{LocalExecEnv, ToolRegistry, WebFetchBackend, WebSearchBackend};

pub(crate) async fn register_web_tools<C: Connector, T: HttpTransport + Debug>(
    registry: &mut ToolRegistry<LocalExecEnv>,
    providers: &ProviderService<C>,
    transport: &T,
) -> Result<(), ProviderError> {
    let search_backends = providers.web_backends(WebFunction::Search).await?;
    let fetch_backends = providers.web_backends(WebFunction::Fetch).await?;
    let search = search_backends
        .into_iter()
        .filter_map(|backend| search_backend(backend, transport))
        .collect::<Vec<_>>();
    let mut fetch = Vec::<Box<dyn WebFetchBackend>>::new();
    for backend in fetch_backends {
        match backend.kind {
            WebProviderKind::Native => {
                fetch.push(Box::new(NativeWebBackend::new(transport.clone())))
            }
            WebProviderKind::Exa => fetch.push(Box::new(ExaWebBackend::new(
                backend.base_url,
                backend.api_key,
                transport.clone(),
            ))),
            WebProviderKind::DeepSeek => fetch.push(Box::new(DeepSeekWebBackend::new(
                backend.base_url,
                backend.api_key,
                transport.clone(),
            ))),
        }
    }
    if !search.is_empty() {
        registry.register(lemma_tool::WebSearchTool::new(search));
    }
    if !fetch.is_empty() {
        registry.register(lemma_tool::WebFetchTool::new(fetch));
    }
    Ok(())
}

fn search_backend<T: HttpTransport + Debug>(
    backend: WebBackend,
    transport: &T,
) -> Option<Box<dyn WebSearchBackend>> {
    match backend.kind {
        WebProviderKind::Native => None,
        WebProviderKind::Exa => Some(Box::new(ExaWebBackend::new(
            backend.base_url,
            backend.api_key,
            transport.clone(),
        ))),
        WebProviderKind::DeepSeek => Some(Box::new(DeepSeekWebBackend::new(
            backend.base_url,
            backend.api_key,
            transport.clone(),
        ))),
    }
}

#[cfg(test)]
mod tests {
    use lemma_adapter::ReqwestTransport;
    use lemma_provider::{WebBackend, WebProviderKind};

    use super::search_backend;

    #[test]
    fn native_web_provider_has_no_search_backend() {
        let backend = WebBackend {
            kind: WebProviderKind::Native,
            base_url: String::new(),
            api_key: String::new(),
        };
        assert!(search_backend(backend, &ReqwestTransport::new()).is_none());
    }
}
