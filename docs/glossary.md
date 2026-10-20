# Glossary

English | [中文](glossary.zh.md)

Lemma uses one term per concept. Each entry states what the term means in code and names the owning crate; behavior across crates is in [architecture.md](architecture.md), and type definitions belong to the planned subsystem pages in [subsystems/](subsystems/README.md).

## Conversation tree

- **conversation** — a user-owned tree of messages with a title, a status (`active` or `archived`), an active leaf, and the last model selection. Archiving flips the status and keeps every message; only archived conversations can be deleted. `lemma-conversation` owns the lifecycle; `lemma-session` owns the tree.
- **message** — one node of the tree: a canonical `lemma_core::Message` (`user`, `assistant`, or `tool_result`) plus its parent id, status, provider, model, and timing marks. The stored form is `StoredMessage`.
- **leaf** — the message `leaf_id` points at; the next user message is appended under it, and every append in a turn moves it.
- **branch** — a message appended under an earlier parent instead of the leaf. Branches add nodes; they never rewrite existing ones.
- **context path** — the messages from the root to the leaf, in order, produced by `build_context_path`. It is the only history a model request contains.
- **message status** — `streaming` (a placeholder being generated), `done`, `aborted`, or `error` (with the failure text in `error`).

## Agent loop

- **turn** — the work started by one user message: one or more steps, ending when a step requests no tools or a stream fails. `Agent` in `lemma-agent` assembles it and `AgentLoop::run_turn` in `lemma-agent-loop` runs it.
- **step** — one model request and the tool calls its response requests. Each step writes one assistant message and one tool result message per tool call.
- **placeholder** — the assistant message a step appends with status `streaming` before calling the model, and settles with the final content, status, and usage afterwards.
- **stream event** — one `StreamEvent`: the closed, vendor-independent set of events every adapter emits (text, thinking, and tool-call start, delta, and end; `Done`; `Error`).
- **turn event** — one `TurnEvent` the loop reports to its observer. `lemma-agent-rpc` maps it onto the `AgentEvent` proto message; `lemma-mobile` maps it onto `MobileAgentEvent`.
- **content block** — one `ContentBlock` of a message: `Text`, `Thinking` (with the vendor signature needed to replay it), `ToolCall`, or `Image`.
- **stop reason** — why a generation ended: `stop`, `length`, `tool_use`, `error`, or `aborted`. Only `tool_use` with at least one tool call starts another step.
- **thinking effort** — the reasoning setting forwarded to the vendor's thinking control (`low`, `medium`, `high`, or a numeric budget). An empty value in `SendMessage` reuses the conversation's last setting.

## Providers and adapters

- **provider** — a user-configured model endpoint stored by `lemma-provider`: kind, identifier, display name, base URL, API key, path overrides, cached model ids, and an enabled flag.
- **provider kind** — the API dialect of a provider: `openai` (OpenAI chat completions and compatible APIs), `anthropic`, or `gemini`. `lemma-model` defines the one `ProviderKind` enum.
- **provider identifier** — a provider's machine name: non-empty ASCII, unique per user, immutable after creation.
- **endpoint** — an `Endpoint`: a provider's kind, base URL, path overrides, and plaintext API key, as `ProviderService::endpoint` opens them.
- **adapter** — an implementation of the `lemma_model::Adapter` trait bound to one endpoint: `OpenAiCompatible`, `AnthropicMessages`, or `GeminiGenerate`. It translates a `ModelRequest` into the vendor's wire format and the vendor's stream into stream events. `HttpConnector` binds an endpoint to the adapter for its kind.
- **model list** — the model ids a provider's endpoint reports, fetched live by `Connector::list_models`. A provider row stores its own list of model ids.

## Tools

- **tool** — an implementation of `lemma_tools::Tool`: a `ToolSpec` advertised to the model, a tier, and an `execute` function. The built-in tools are `read_file`, `write_file`, and `bash`.
- **tool tier** — the capability class of a tool: `Read`, `Write`, or `Exec`. An approval policy receives it with every call.
- **approval policy** — an `ApprovalPolicy` that returns `Allow`, `Prompt`, or `Deny` for each tool call. `Prompt` and `Deny` turn the call into an error tool result.
- **execution environment** — an `ExecEnv`: file reads and writes, directory listings, and shell commands that tools perform. `LocalExecEnv` roots them in a workspace.
- **workspace** — the directory `workspaces/<conversation id>` under the local data directory where a conversation's tools run.
- **tool runtime** — a `ToolRuntime`: the registry, environment, and optional approval policy a host attaches to the loop. A loop without one sends no tool definitions.

## Runtimes and accounts

- **server mode** — `lemma-server` started without `LEMMA_LOCAL_MODE`: configured by environment variables or `.env`, listening on port 1025, without tools.
- **local mode** — the runtimes that keep data on the device: the desktop local engine and the Android in-process engine.
- **local engine** — `lemma-server` started by Electron with `LEMMA_LOCAL_MODE` and `LEMMA_DATA_DIR`, announcing itself with a `LEMMA_READY <json>` line.
- **in-process engine** — `LemmaEngine` from `lemma-mobile`, called by the Android app through UniFFI bindings.
- **default local account** — the account local mode provides without sign-up, created on first need, username `lemma` with a fixed public password (`lemma_auth::local`). Accounts users register carry their own passwords.
- **skip credentials** — the default local account's username and password plus the engine URL, which the desktop shell hands to the web client so sign-in can be skipped.
- **access token** — a JWT signed with the JWT secret, valid for 15 minutes, carrying the user id in `sub`.
- **refresh token** — a random token valid for 30 days; the store keeps only its SHA-256 hash, and each refresh revokes it and issues a new pair.
- **cookie mode** — the browser client's authentication when the API shares its origin: tokens travel in the `lemma_access` and `lemma_refresh` cookies instead of an `Authorization` header.
- **sealed key** — a provider API key encrypted with AES-256-GCM by `lemma-crypto` under a key derived from the secret key. Changing the secret key makes every sealed key unreadable.

## Errors

- **error reason** — one value of the closed `ErrorReason` enum in `errors.proto`, attached to a Connect error as an `ErrorInfo` detail. Clients translate the reason; the English message is a fallback.
- **internal error** — a Connect error without an error reason, carrying raw diagnostic text, for infrastructure failures.
