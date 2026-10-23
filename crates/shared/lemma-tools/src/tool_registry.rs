use std::collections::HashMap;

use lemma_core::ToolSpec;

use crate::tool::Tool;

/// Registry storing the tools enabled for an `E` environment.
#[derive(Debug)]
pub struct ToolRegistry<E> {
    tools: HashMap<String, Box<dyn Tool<E>>>,
}

impl<E> ToolRegistry<E> {
    /// Creates an empty registry.
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    /// Registers a tool under its wire name.
    pub fn register(&mut self, tool: impl Tool<E> + 'static) {
        let name = tool.spec().name;
        self.tools.insert(name, Box::new(tool));
    }

    /// Looks up a tool by wire name.
    #[must_use]
    pub fn get(&self, name: &str) -> Option<&dyn Tool<E>> {
        self.tools.get(name).map(Box::as_ref)
    }

    /// Returns specifications of all registered tools.
    #[must_use]
    pub fn specs(&self) -> Vec<ToolSpec> {
        self.tools.values().map(|t| t.spec()).collect()
    }
}

impl<E> Default for ToolRegistry<E> {
    fn default() -> Self {
        Self {
            tools: HashMap::new(),
        }
    }
}
