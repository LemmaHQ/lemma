use std::collections::HashMap;
use std::sync::Arc;

use crate::tool::{Tool, ToolSpec};

/// Registry storing enabled tools available to the agent.
#[derive(Default, Clone)]
pub struct ToolRegistry {
    tools: HashMap<String, Arc<dyn Tool>>,
}

impl ToolRegistry {
    /// Creates an empty registry.
    pub fn new() -> Self {
        Self {
            tools: HashMap::new(),
        }
    }

    /// Registers a tool into the registry.
    pub fn register(&mut self, tool: Arc<dyn Tool>) {
        let name = tool.spec().name;
        self.tools.insert(name, tool);
    }

    /// Looks up a registered tool by its wire name.
    pub fn get(&self, name: &str) -> Option<Arc<dyn Tool>> {
        self.tools.get(name).cloned()
    }

    /// Returns specifications of all currently registered tools.
    pub fn specs(&self) -> Vec<ToolSpec> {
        self.tools.values().map(|t| t.spec()).collect()
    }
}
