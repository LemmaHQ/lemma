use std::sync::Arc;

use futures::StreamExt;
use lemma_adapter::{ChatRequest, Provider, ProviderKind};
use lemma_core::{
    ContentBlock, Message, StopReason, StreamEvent, TextContent, ThinkingContent, ToolCall, Usage,
};
use lemma_session::{
    LastModel, MessageStatus, MessageUpdate, StoredMessage, TraceStore, build_context_path,
};
use lemma_tools::{ApprovalDecision, ApprovalPolicy, ExecEnv, ToolRegistry};
use uuid::Uuid;

use crate::error::AgentError;

fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_or(0, |d| d.as_millis() as i64)
}

/// Events emitted during an observed turn execution.
#[derive(Debug, Clone)]
pub enum TurnEvent {
    /// The user message has been committed to the tree.
    UserAppended {
        /// Message ID.
        id: Uuid,
    },
    /// A new assistant message node started streaming.
    AssistantStarted {
        /// Message ID.
        id: Uuid,
    },
    /// A text delta received from the provider stream.
    Delta {
        /// Incremental chunk.
        delta: String,
    },
    /// A reasoning delta received from the provider stream.
    ThinkingDelta {
        /// Incremental reasoning chunk.
        delta: String,
    },
    /// A tool call is about to be executed.
    ToolStarted {
        /// Provider-assigned call ID.
        id: String,
        /// Tool name.
        name: String,
        /// Call arguments as serialized JSON.
        arguments: String,
    },
    /// A tool call finished executing.
    ToolFinished {
        /// Provider-assigned call ID.
        id: String,
        /// Tool name.
        name: String,
        /// Tool output text.
        content: String,
        /// True when the tool reported a failure.
        is_error: bool,
    },
    /// The final assistant message has been completed and persisted.
    AssistantDone {
        /// Message ID.
        id: Uuid,
        /// Full text content.
        full_text: String,
        /// Token usage if provided.
        usage: Option<Usage>,
    },
}

/// Callback observer for real-time streaming notifications.
pub type BoxTurnObserver = Box<dyn Fn(TurnEvent) + Send + Sync>;

/// The currently open content block while accumulating a stream.
enum OpenBlock {
    Text(String),
    Thinking(String),
    ToolCall {
        id: String,
        name: String,
        arguments: String,
    },
}

impl OpenBlock {
    /// Closes the block into its canonical content form.
    fn close(self, signature: Option<String>) -> ContentBlock {
        match self {
            Self::Text(text) => ContentBlock::Text(TextContent { text }),
            Self::Thinking(thinking) => ContentBlock::Thinking(ThinkingContent {
                thinking,
                signature,
            }),
            Self::ToolCall {
                id,
                name,
                arguments,
            } => ContentBlock::ToolCall(ToolCall {
                id,
                name,
                arguments: serde_json::from_str(&arguments)
                    .unwrap_or(serde_json::Value::String(arguments)),
            }),
        }
    }
}

/// Runtime parameters passed to an agent step execution.
#[derive(Clone)]
pub struct AgentConfig {
    /// Provider kind selecting the protocol adapter.
    pub kind: ProviderKind,
    /// Provider endpoint base URL.
    pub base_url: String,
    /// Custom path override, if any.
    pub api_path: String,
    /// Plaintext API key.
    pub api_key: String,
    /// Target model identifier.
    pub model: String,
    /// Provider row the turn is dispatched to.
    pub provider_id: Uuid,
    /// Reasoning effort level, when the model exposes one.
    pub thinking_effort: Option<String>,
}

/// Tool execution wiring available to the loop: registry, environment and
/// an optional approval gate.
pub struct ToolRuntime {
    /// Tools advertised to the model and dispatched on calls.
    pub registry: ToolRegistry,
    /// Environment tool executions run inside.
    pub env: Arc<dyn ExecEnv>,
    /// Optional approval gate consulted before every execution.
    pub approval: Option<Arc<dyn ApprovalPolicy>>,
}

impl ToolRuntime {
    /// Creates a runtime without an approval gate.
    pub fn new(registry: ToolRegistry, env: Arc<dyn ExecEnv>) -> Self {
        Self {
            registry,
            env,
            approval: None,
        }
    }
}

/// Settled outcome of one provider stream: accumulated blocks, terminal
/// state, and timing marks.
struct TurnOutcome {
    blocks: Vec<ContentBlock>,
    stop_reason: StopReason,
    usage: Option<Usage>,
    first_token_at: Option<i64>,
    error: Option<String>,
}

impl TurnOutcome {
    fn full_text(&self) -> String {
        self.blocks
            .iter()
            .filter_map(ContentBlock::plain_text)
            .collect()
    }

    fn content(&self) -> Vec<ContentBlock> {
        if self
            .blocks
            .iter()
            .all(|b| matches!(b, ContentBlock::Text(_)))
        {
            vec![ContentBlock::Text(TextContent {
                text: self.full_text(),
            })]
        } else {
            self.blocks.clone()
        }
    }

    fn tool_calls(&self) -> Vec<ToolCall> {
        self.blocks
            .iter()
            .filter_map(|b| match b {
                ContentBlock::ToolCall(call) => Some(call.clone()),
                _ => None,
            })
            .collect()
    }
}

/// Executes one tool call through the approval gate and registry, returning
/// the result text and whether it represents a failure.
async fn run_tool(runtime: &ToolRuntime, call: &ToolCall) -> (String, bool) {
    let Some(tool) = runtime.registry.get(&call.name) else {
        return (format!("tool not found: {}", call.name), true);
    };
    if let Some(policy) = &runtime.approval {
        match policy.evaluate(&call.name, tool.tier(), &call.arguments) {
            ApprovalDecision::Allow => {}
            ApprovalDecision::Prompt(reason) => {
                return (format!("tool call requires approval: {reason}"), true);
            }
            ApprovalDecision::Deny(reason) => {
                return (format!("tool call denied: {reason}"), true);
            }
        }
    }
    match tool
        .execute(call.arguments.clone(), runtime.env.as_ref())
        .await
    {
        Ok(value) => match serde_json::to_string_pretty(&value) {
            Ok(text) => (text, false),
            Err(_) => (value.to_string(), false),
        },
        Err(e) => (e.to_string(), true),
    }
}

/// The core execution engine.
///
/// Drives context assembly from the session tree, dispatches calls to
/// the provider layer, executes requested tool calls, and updates the
/// trace tree.
pub struct AgentLoop {
    store: Arc<dyn TraceStore>,
    provider: Arc<dyn Provider>,
    tools: Option<ToolRuntime>,
}

impl AgentLoop {
    /// Creates a new execution engine without tool support.
    pub fn new(store: Arc<dyn TraceStore>, provider: Arc<dyn Provider>) -> Self {
        Self {
            store,
            provider,
            tools: None,
        }
    }

    /// Attaches tool execution wiring to the engine.
    pub fn with_tools(mut self, runtime: ToolRuntime) -> Self {
        self.tools = Some(runtime);
        self
    }

    /// Appends a user prompt to a conversation, executes the generation
    /// loop, and stores the resulting assistant turns without intermediate
    /// notifications.
    pub async fn run_turn(
        &self,
        conversation_id: Uuid,
        user_message: Message,
        parent_id_override: Option<Uuid>,
        config: AgentConfig,
    ) -> Result<(Uuid, String), AgentError> {
        self.run_turn_observed(
            conversation_id,
            user_message,
            parent_id_override,
            config,
            None,
        )
        .await
    }

    /// Appends a user prompt to a conversation, runs the generation loop
    /// (model stream, tool execution, re-dispatch until a plain stop),
    /// streams delta events to `observer`, and persists every turn.
    pub async fn run_turn_observed(
        &self,
        conversation_id: Uuid,
        user_message: Message,
        parent_id_override: Option<Uuid>,
        config: AgentConfig,
        observer: Option<Arc<dyn Fn(TurnEvent) + Send + Sync>>,
    ) -> Result<(Uuid, String), AgentError> {
        let meta = self
            .store
            .get_conversation(conversation_id)
            .await?
            .ok_or_else(|| {
                AgentError::NotFound(format!("conversation {conversation_id} not found"))
            })?;

        let user_parent_id = parent_id_override.or(meta.leaf_id);

        let user_msg_id = Uuid::new_v4();
        let now = now_ms();
        let user_entry = StoredMessage {
            id: user_msg_id,
            conversation_id,
            parent_id: user_parent_id,
            message: user_message,
            status: MessageStatus::Done,
            error: None,
            model: None,
            provider_id: None,
            started_at: now,
            created_at: now,
        };

        self.store.append_message(user_entry).await?;
        self.store.update_leaf(conversation_id, user_msg_id).await?;

        if let Some(obs) = &observer {
            obs(TurnEvent::UserAppended { id: user_msg_id });
        }

        self.store
            .update_conversation_model(
                conversation_id,
                LastModel {
                    provider_id: config.provider_id,
                    model: config.model.clone(),
                    thinking_effort: config.thinking_effort.clone(),
                },
            )
            .await?;

        let tool_specs = self
            .tools
            .as_ref()
            .map(|runtime| runtime.registry.specs())
            .unwrap_or_default();

        let mut leaf_id = user_msg_id;

        loop {
            let entries = self.store.list_messages(conversation_id).await?;
            let linear_context = build_context_path(&entries, leaf_id)?;

            let assistant_msg_id = Uuid::new_v4();
            let started_at = now_ms();
            let assistant_entry = StoredMessage {
                id: assistant_msg_id,
                conversation_id,
                parent_id: Some(leaf_id),
                message: Message::Assistant {
                    content: vec![ContentBlock::Text(TextContent {
                        text: String::new(),
                    })],
                    stop_reason: StopReason::Stop,
                    usage: None,
                },
                status: MessageStatus::Streaming,
                error: None,
                model: Some(config.model.clone()),
                provider_id: Some(config.provider_id),
                started_at,
                created_at: started_at,
            };
            self.store.append_message(assistant_entry).await?;
            self.store
                .update_leaf(conversation_id, assistant_msg_id)
                .await?;
            if let Some(obs) = &observer {
                obs(TurnEvent::AssistantStarted {
                    id: assistant_msg_id,
                });
            }

            let req = ChatRequest {
                kind: config.kind,
                base_url: config.base_url.clone(),
                api_path: config.api_path.clone(),
                api_key: config.api_key.clone(),
                model: config.model.clone(),
                thinking_effort: config.thinking_effort.clone(),
                messages: linear_context,
                tools: tool_specs.clone(),
            };

            let outcome = self.stream_turn(req, started_at, observer.as_deref()).await;
            let full_text = outcome.full_text();

            self.store
                .update_message(
                    assistant_msg_id,
                    MessageUpdate {
                        message: Message::Assistant {
                            content: outcome.content(),
                            stop_reason: outcome.stop_reason,
                            usage: outcome.usage,
                        },
                        status: if outcome.error.is_none() {
                            MessageStatus::Done
                        } else {
                            MessageStatus::Error
                        },
                        error: outcome.error.clone(),
                        first_token_at: outcome.first_token_at,
                        finished_at: now_ms(),
                    },
                )
                .await?;

            if let Some(error) = outcome.error {
                return Err(AgentError::Provider(error));
            }

            let tool_calls = outcome.tool_calls();
            let Some(runtime) = self.tools.as_ref() else {
                self.notify_done(&observer, assistant_msg_id, &full_text, outcome.usage);
                return Ok((assistant_msg_id, full_text));
            };
            if outcome.stop_reason != StopReason::ToolUse || tool_calls.is_empty() {
                self.notify_done(&observer, assistant_msg_id, &full_text, outcome.usage);
                return Ok((assistant_msg_id, full_text));
            }

            leaf_id = assistant_msg_id;
            for call in &tool_calls {
                if let Some(obs) = &observer {
                    obs(TurnEvent::ToolStarted {
                        id: call.id.clone(),
                        name: call.name.clone(),
                        arguments: serde_json::to_string(&call.arguments).unwrap_or_default(),
                    });
                }
                let (text, is_error) = run_tool(runtime, call).await;
                if let Some(obs) = &observer {
                    obs(TurnEvent::ToolFinished {
                        id: call.id.clone(),
                        name: call.name.clone(),
                        content: text.clone(),
                        is_error,
                    });
                }
                let now = now_ms();
                let result_id = Uuid::new_v4();
                let result_entry = StoredMessage {
                    id: result_id,
                    conversation_id,
                    parent_id: Some(leaf_id),
                    message: Message::ToolResult {
                        tool_call_id: call.id.clone(),
                        tool_name: call.name.clone(),
                        content: vec![ContentBlock::Text(TextContent { text })],
                        is_error,
                    },
                    status: MessageStatus::Done,
                    error: None,
                    model: None,
                    provider_id: None,
                    started_at: now,
                    created_at: now,
                };
                self.store.append_message(result_entry).await?;
                self.store.update_leaf(conversation_id, result_id).await?;
                leaf_id = result_id;
            }
        }
    }

    /// Emits the terminal `AssistantDone` notification.
    fn notify_done(
        &self,
        observer: &Option<Arc<dyn Fn(TurnEvent) + Send + Sync>>,
        id: Uuid,
        full_text: &str,
        usage: Option<Usage>,
    ) {
        if let Some(obs) = observer {
            obs(TurnEvent::AssistantDone {
                id,
                full_text: full_text.to_string(),
                usage,
            });
        }
    }

    /// Runs one provider stream to completion, accumulating content blocks
    /// and forwarding deltas to the observer.
    async fn stream_turn(
        &self,
        req: ChatRequest,
        started_at: i64,
        observer: Option<&(dyn Fn(TurnEvent) + Send + Sync)>,
    ) -> TurnOutcome {
        let mut blocks: Vec<ContentBlock> = Vec::new();
        let mut open: Option<OpenBlock> = None;
        let mut final_usage = None;
        let mut final_stop = StopReason::Stop;
        let mut first_token_at: Option<i64> = None;

        let stream_result: Result<(), AgentError> = async {
            let mut stream = self.provider.stream(req).await?;
            while let Some(ev_res) = stream.next().await {
                let ev = ev_res?;
                match ev {
                    StreamEvent::Start => {}
                    StreamEvent::TextStart => {
                        if let Some(prev) = open.take() {
                            blocks.push(prev.close(None));
                        }
                        open = Some(OpenBlock::Text(String::new()));
                    }
                    StreamEvent::TextDelta { delta } => {
                        if first_token_at.is_none() {
                            first_token_at = Some(now_ms());
                        }
                        if !matches!(open, Some(OpenBlock::Text(_))) {
                            if let Some(prev) = open.take() {
                                blocks.push(prev.close(None));
                            }
                            open = Some(OpenBlock::Text(String::new()));
                        }
                        if let Some(OpenBlock::Text(text)) = &mut open {
                            text.push_str(&delta);
                        }
                        if let Some(obs) = observer {
                            obs(TurnEvent::Delta { delta });
                        }
                    }
                    StreamEvent::TextEnd => {
                        if let Some(prev) = open.take() {
                            blocks.push(prev.close(None));
                        }
                    }
                    StreamEvent::ThinkingStart => {
                        if let Some(prev) = open.take() {
                            blocks.push(prev.close(None));
                        }
                        open = Some(OpenBlock::Thinking(String::new()));
                    }
                    StreamEvent::ThinkingDelta { delta } => {
                        if !matches!(open, Some(OpenBlock::Thinking(_))) {
                            if let Some(prev) = open.take() {
                                blocks.push(prev.close(None));
                            }
                            open = Some(OpenBlock::Thinking(String::new()));
                        }
                        if let Some(OpenBlock::Thinking(thinking)) = &mut open {
                            thinking.push_str(&delta);
                        }
                        if let Some(obs) = observer {
                            obs(TurnEvent::ThinkingDelta { delta });
                        }
                    }
                    StreamEvent::ThinkingEnd { signature } => {
                        if let Some(prev) = open.take() {
                            blocks.push(prev.close(signature));
                        }
                    }
                    StreamEvent::ToolCallStart { id, name } => {
                        if let Some(prev) = open.take() {
                            blocks.push(prev.close(None));
                        }
                        open = Some(OpenBlock::ToolCall {
                            id,
                            name,
                            arguments: String::new(),
                        });
                    }
                    StreamEvent::ToolCallDelta { delta, .. } => {
                        if let Some(OpenBlock::ToolCall { arguments, .. }) = &mut open {
                            arguments.push_str(&delta);
                        }
                    }
                    StreamEvent::ToolCallEnd { call } => {
                        match open.take() {
                            Some(OpenBlock::ToolCall { ref id, .. }) if *id == call.id => {}
                            Some(prev) => blocks.push(prev.close(None)),
                            None => {}
                        }
                        blocks.push(ContentBlock::ToolCall(call));
                    }
                    StreamEvent::Done {
                        stop_reason,
                        usage,
                        ttft_ms,
                    } => {
                        final_stop = stop_reason;
                        final_usage = usage;
                        if let Some(ttft) = ttft_ms {
                            first_token_at = Some(started_at + ttft as i64);
                        }
                    }
                    StreamEvent::Error { message } => {
                        return Err(AgentError::Provider(message));
                    }
                }
            }
            Ok(())
        }
        .await;

        if let Some(prev) = open.take() {
            blocks.push(prev.close(None));
        }

        TurnOutcome {
            blocks,
            stop_reason: final_stop,
            usage: final_usage,
            first_token_at,
            error: stream_result.as_ref().err().map(|e| e.to_string()),
        }
    }
}
