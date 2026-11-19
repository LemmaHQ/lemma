# Glossary

English | [中文](glossary.zh.md)

Lemma uses one term per concept across code, wire contracts, and docs. Cross-crate behavior lives in [architecture.md](architecture.md); Rust type details live in each crate's doc comments.

## Session tree

- **session** — a tree of messages with a title, an active leaf, and the last model selection, owned by `lemma-session`. Deleting a session removes all its messages.
- **leaf** — the active node `leaf_id` points at; the next user message appends under it, and every append in a turn moves it.
- **branch** — a message appended under an earlier turn boundary (or root) instead of the leaf; branches never rewrite existing nodes.
- **context path** — the root-to-leaf message sequence sent to a model request, excluding sibling branches and unanswered tool calls from earlier interrupted turns.
- **message status** — `streaming`, `done`, `aborted`, or `error`.

## Agent loop

- **turn** — the work started by one user message: one or more steps ending when the model requests no tools, a stream fails, or the turn is aborted (`lemma-agent` / `lemma-agent-loop`).
- **step** — one model request plus the tool calls it requests.
- **placeholder** — the assistant message appended with status `streaming` before calling the model and settled with final content, status, usage, and timings afterwards.
- **stop reason** — why a generation ended (`stop`, `length`, `tool_use`, or `aborted`); only `tool_use` with at least one tool call starts another step.

## Providers and adapters

- **predefined provider** — a model provider whose metadata and model definitions live in `lemma-provider` code while its database row stores only the API key, enabled flag, and default API format.
- **custom provider** — a user-defined provider row storing its own identifier, display name, single API format, base URL, API key, path overrides, and model records.
- **web provider** — a web search or fetch backend configuration (`native`, `exa`, or `deepseek`) with its enabled flag, optional sealed key, and ordering in search/fetch fallback chains.
- **API format** — the wire protocol of a model request (`openai`, `anthropic`, or `gemini`), defined by `lemma_model::ApiFormat`.
- **model feature** — a model capability flag (such as tool calling) that alters the requests sent to that model.
- **adapter** — a `lemma_model::Adapter` implementation in `lemma-adapter` translating between canonical requests/events and one vendor wire format.

## Tools

- **session directory** — the root directory a session's file and shell tools run in: either the absolute directory bound when creating the session, or its per-session workspace.
- **workspace** — the generated `workspaces/<session id>` directory under the local data directory for a session created without a bound directory.
- **web backend** — one web provider's HTTP client in `lemma-adapter`; web tools try enabled backends in configured order and fall back on any error.

## Runtimes and errors

- **engine** — `Engine` in `lemma-engine`: the Connect services assembled over one data directory (`lemma.db`, `secrets.json`, `workspaces/`).
- **in-process engine** — `InProcessEngine` in `lemma-engine`: an engine invoked directly through `InProcessTransport` without a network listener (used by desktop and Android).
- **engine port** — the `MessagePort` connecting the Electron renderer directly to the desktop engine utility process.
- **sealed key** — a provider API key encrypted with AES-256-GCM by `lemma-crypto` under a key derived from `secret_key` in `secrets.json`.
- **error reason** — a closed `ErrorReason` value in `errors.proto` attached as an `ErrorInfo` detail for localized business errors; infrastructure failures omit it (internal errors).
