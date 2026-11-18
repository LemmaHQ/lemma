# Glossary

English | [中文](glossary.zh.md)

Lemma uses one term per concept. Each entry states what the term means in code and names the owning crate; behavior across crates is in [architecture.md](architecture.md), and type definitions belong to the subsystem pages in [subsystems/](subsystems/README.md).

## Session tree

- **session** — a tree of messages with a title, an active leaf, and the last model selection. Deleting a session removes it with all its messages. `lemma-session` owns the lifecycle and the tree.
- **message** — one node of the tree: a canonical `lemma_core::Message` (`user`, `assistant`, or `tool_result`) plus its parent id, optional user label, status, provider, and model. The stored form is `lemma_session::Message`.
- **leaf** — the message `leaf_id` points at; the next user message is appended under it, and every append in a turn moves it.
- **branch** — a message appended under an earlier parent instead of the leaf. Branches add nodes; they never rewrite existing ones.
- **context path** — the messages from the root to the leaf, in order, produced by `build_context_path`. It is the only history a model request contains.
- **message status** — `streaming` (a placeholder being generated), `done`, `aborted`, or `error` (with the failure text in `error`).

## Agent loop

- **turn** — the work started by one user message: one or more steps, ending when a step requests no tools, a stream fails, or the turn is aborted. `Agent` in `lemma-agent` starts, resumes, and aborts it, and `AgentLoop::run_turn` in `lemma-agent-loop` runs its steps.
- **step** — one model request and the tool calls its response requests. Each step writes one assistant message and one tool result message per tool call.
- **placeholder** — the assistant message a step appends with status `streaming` before calling the model, and settles with the final content, status, and usage afterwards.
- **stream event** — one `StreamEvent`: the closed, vendor-independent set of events every adapter emits (text, thinking, and tool-call start, delta, and end; `Done`).
- **turn event** — one `TurnEvent` the loop reports to its observer. `lemma-rpc` maps it onto the `AgentEvent` proto message.
- **content block** — one `ContentBlock` of a message: `Text`, `Thinking` (with the vendor signature needed to replay it), or `ToolCall`.
- **stop reason** — why a generation ended: `stop`, `length`, `tool_use`, or `aborted`. Only `tool_use` with at least one tool call starts another step.

## Providers and adapters

- **provider** — a model service stored by `lemma-provider` with its API key and an enabled flag. A provider is predefined or custom.
- **predefined provider** — a provider that `lemma-provider` defines in code: its name, the API formats it serves with the base URL of each, and its models with their features. Its row stores the API key, the enabled flag, and the default API format. DeepSeek is the predefined provider.
- **custom provider** — a provider configured with its own identifier, display name, one API format, base URL, API key, path overrides, and model records.
- **web provider** — a web search or fetch configuration stored in `web_providers`: its kind (`native`, `exa`, or `deepseek`), sealed API key, enabled flag, and positions in the search and fetch orders. Native fetches over local HTTP without an API key.
- **API format** — the wire format of a model request: `openai` (OpenAI chat completions and compatible APIs), `anthropic`, or `gemini`. `lemma-model` defines the one `ApiFormat` enum.
- **provider identifier** — a provider's machine name: non-empty ASCII, immutable after creation, and unique among custom providers. A predefined provider's identifier names its definition, such as `deepseek`.
- **model feature** — a property of a model that changes the requests sent to it. Tool calling is the only feature: a model with tool calling off receives no tool definitions and no earlier tool calls or tool results.
- **endpoint** — an `Endpoint`: one API format with its base URL, path overrides, and plaintext API key, as `ProviderService::bind` opens them before binding the adapter.
- **adapter** — an implementation of the `lemma_model::Adapter` trait bound to one endpoint: `OpenAiCompatible`, `AnthropicMessages`, or `GeminiGenerate`. It translates a `ModelRequest` into the vendor's wire format and the vendor's stream into stream events. `HttpConnector` binds an endpoint to the adapter for its API format and returns it as a `ModelAdapter`.
- **model list** — the model ids a custom provider's endpoint reports, fetched live by `Connector::list_models`. A custom provider row stores its own model records: each model id with its features.

## Tools

- **tool** — an implementation of `lemma_tool::Tool`: a `ToolSpec` advertised to the model and an `execute` function. The built-in tools are `read_file`, `write_file`, `bash`, `web_search`, and `web_fetch`.
- **execution environment** — an `ExecEnv`: file reads and writes, directory listings, and shell commands that tools perform. `LocalExecEnv` roots them in a session directory.
- **session directory** — the directory a session's tools run in: the absolute directory the session was created with, or else its workspace.
- **workspace** — the directory `workspaces/<session id>` under the local data directory, generated for a session created without a directory.
- **system prompt** — the instructions a `ModelRequest` sends ahead of the history. A turn with tools sends one naming the session directory, the operating system, and the shell.
- **tool runtime** — a `ToolRuntime`: the registry and environment a host attaches to the loop. A loop without one sends no tool definitions.
- **web backend** — the client of one web provider kind, implemented in `lemma-adapter`'s `web/` module over the injected `HttpTransport`. The web tools try enabled backends in configured order and move to the next backend on any error.

## Runtimes

- **server mode** — the `lemma-daemon` binary: opens `Engine` over `LEMMA_DATA_DIR` (default `./data`), listens on `127.0.0.1:1025` by default (`LEMMA_PORT`), and serves the Connect router and the embedded web build.
- **local mode** — the runtimes that keep data in the app's local directory: the desktop local engine and the Android in-process engine.
- **local engine** — `Engine` in `lemma-engine`: the Connect services over one SQLite database (`lemma.db`), `secrets.json`, and per-session `workspaces/` under one data directory. `lemma-desktop` opens it in Electron's engine process over `userData`, `lemma-mobile` opens it over Android's `filesDir`, and `lemma-daemon` opens it over `LEMMA_DATA_DIR`.
- **engine port** — the `MessagePort` between the web page and the desktop engine process. Requests, response chunks, and cancellations travel over it; it carries no session messages.
- **in-process engine** — `LemmaEngine` from `lemma-mobile`, which serves the Connect router inside the Android app; the app reaches it through UniFFI bindings.
- **sealed key** — a provider API key encrypted with AES-256-GCM by `lemma-crypto` under a key derived from `secret_key` in `secrets.json`. Changing the secret key makes every sealed key unreadable.

## Errors

- **error reason** — one value of the closed `ErrorReason` enum in `errors.proto`, attached to a Connect error as an `ErrorInfo` detail. Clients translate the reason; the English message is a fallback.
- **internal error** — a Connect error without an error reason, carrying raw diagnostic text, for infrastructure failures.
