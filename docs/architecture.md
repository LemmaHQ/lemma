# Lemma Architecture

English | [中文](architecture.zh.md)

Read this before changing anything under `crates/`. It maps the crate layers, the three runtimes, wire boundaries, the path of one turn, and persistence invariants. Terms follow the [glossary](glossary.md); single-crate contracts live in each crate's `//!` and `///` doc comments.

## Crate layers

Lemma is one Rust workspace. Each crate depends only on crates in its own layer or layers above it; `lemma-core` defines the canonical types shared across every layer.

| Layer     | Crates                                                        | Responsibility                                                                               |
| --------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Contracts | `lemma-proto`, `lemma-core`, `lemma-model`                    | Wire bindings and coded error helpers; canonical trace types; vendor-neutral model interface |
| Domains   | `lemma-db`, `lemma-session`, `lemma-provider`, `lemma-crypto` | SQLite setup and migrations; session message trees; provider/model catalog; API-key sealing  |
| Execution | `lemma-adapter`, `lemma-tool`, `lemma-agent-loop`             | Vendor wire formats and web backends; tools and execution environment; turn loop             |
| Agent     | `lemma-agent`                                                 | Turn lifecycle (start, resume, abort), session-directory tool wiring, replayable event logs  |
| RPC       | `lemma-rpc`                                                   | ConnectRPC handlers assembled into one router                                                |
| Engine    | `lemma-engine`                                                | Data-directory engine assembly and in-process transport                                      |
| Hosts     | `lemma-daemon`, `lemma-napi`, `lemma-uniffi`                  | Daemon binary, Electron Node-API addon, and Android UniFFI facade                            |

Execution and agent crates access persistence only through `lemma-session` and `lemma-provider`, and reach models only through `lemma-model` traits. Crates under `crates/shared/` build for every runtime including Android; crates under `daemon/`, `napi/`, and `uniffi/` build only into their host ([crates/AGENTS.md](../crates/AGENTS.md#layout)).

## Runtimes

The same domain services and turn loop run in three hosts; the core does not know which client calls it.

| Runtime | Host                                                                                   | Storage                               | Tools                                    | Stored API keys                            |
| ------- | -------------------------------------------------------------------------------------- | ------------------------------------- | ---------------------------------------- | ------------------------------------------ |
| Daemon  | `lemma-daemon` (`127.0.0.1:1025` by default; serves embedded `web/dist`)               | SQLite at `<LEMMA_DATA_DIR>/lemma.db` | bound directory or per-session workspace | sealed with `secret_key` in `secrets.json` |
| Desktop | `lemma-napi` in Electron's utility process ([desktop/AGENTS.md](../desktop/AGENTS.md)) | SQLite at `<userData>/lemma.db`       | bound directory or per-session workspace | sealed with `secret_key` in `secrets.json` |
| Android | `lemma-uniffi` in-process via OkHttp ([mobile/AGENTS.md](../mobile/AGENTS.md))         | SQLite at `<filesDir>/lemma.db`       | per-session workspace                    | sealed with `secret_key` in `secrets.json` |

All three hosts share one data-directory layout: `lemma.db` (SQLite in WAL mode with foreign keys), `secrets.json` (generated on first run with `secret_key` for AES-256-GCM sealing), and `workspaces/`. Backups must keep `lemma.db` and `secrets.json` together, because sealed API keys in the database open only with the `secret_key` in `secrets.json`.

## Contracts across the wire

`proto/lemma/v1` is the single wire contract for all three clients ([proto/AGENTS.md](../proto/AGENTS.md)).

- **Business vs. infrastructure errors:** business errors carry a closed `ErrorReason` from `errors.proto` attached as an `ErrorInfo` detail so clients localize by code; infrastructure failures (database, decryption, upstream) return an internal Connect error with a raw English message and no reason.
- **Pre-stream vs. mid-stream turn errors:** `AgentService.SendMessage` reports validation and preparation failures (empty input, busy session, missing session/message/provider/directory, invalid branch point) as RPC errors before the stream opens, writing no messages. Once the stream opens, mid-turn failures arrive as a terminal `error` stream event and settle the failed step's assistant placeholder with status `error` and the failure text.
- **Trust model:** Lemma runs as a single-owner local node with no user accounts or authentication layer.

## The path of one turn

A **turn** starts from one user message and ends when the model stops without requesting tools, its stream fails, or the turn is aborted. A **step** is one model request; a turn with tool calls runs several steps. `Agent` in `lemma-agent` runs `AgentLoop::run_turn` in a background task and `lemma-rpc` maps its `TurnEvent`s onto `AgentEvent`s.

```text
AgentService.SendMessage(session, provider, model, content, parent_id?)
  claim session slot; resolve branch parent and API format from nearest assistant above it
  ProviderService::bind -> open key, bind adapter
  open session directory and register tools
  append user message; move leaf; record model selection                  -> started
  step:
    aborted -> end turn                                                   -> aborted
    fold root-to-leaf context path (omit tool calls/results if tool calling off)
    append assistant placeholder (status streaming); move leaf            -> turn_started
    Adapter::stream(ModelRequest) -> StreamEvent*                         -> delta (text | thinking)
    settle placeholder (content, stop reason, usage, status, timings)
    aborted during stream -> end turn                                     -> aborted
    stream failed -> end turn                                             -> error
    no tools, stop reason != tool_use, or no tool calls -> end turn       -> done
    for each tool call:                                                   -> tool_call_started
      Tool::execute in session directory                                  -> tool_call_finished
      append tool result message; move leaf
    next step
```

- **Durability and ordering:** the user message and each assistant placeholder persist before the model call, and each tool result persists before the next step.
- **Timings:** every `AgentEvent` carries server `occurred_at` (preserved by replay); assistant JSON persists thinking and tool `started_at`/`finished_at` for history, omitted from provider requests.
- **API format selection:** a predefined provider serving multiple formats uses the format of the nearest assistant message on the context path when supported, otherwise its configured default.
- **Tools and failures:** file and shell tools run in a `LocalExecEnv` rooted at the session directory (path confinement and process-tree kill contracts live in `lemma-tool`); web tools resolve their backend order at turn assembly so settings changes apply to the next turn, falling back across enabled backends with query and result count. Unknown tools and tool execution failures become error tool results for the next step rather than ending the turn. Models with tool calling off receive no tool definitions and no prior tool calls/results in requests while stored messages keep them.
- **Cancellation and resume:** turns run to completion regardless of whether a client reads the stream. `Agent` keeps an unbounded per-turn event log and cancellation token keyed by the user message id from `started`. `ResumeStream(message_id, offset)` replays missed events and follows live events; once the turn ends it fails with `ERROR_REASON_TURN_NOT_RUNNING` and the client reads settled messages instead. `AbortMessage` cancels the token, settles any streaming placeholder as `aborted`, stops a running `bash` process tree (other running tools finish), and ends the turn before the next step.

## Persistence

`lemma-db` runs SQLite migrations on pool open (`lemma_db::open`). Only `SessionService` touches `sessions` and `messages`, and only `ProviderService` touches `providers` and `web_providers`.

- **Append-only message trees:** branching appends a node under an earlier turn boundary or root without rewriting history. Model context is always the root-to-leaf path (omitting unanswered tool calls from earlier interrupted turns), so sibling branches never reach the model.
- **Decoupled provider references:** `messages.provider_id` intentionally has no foreign key so deleting a provider preserves historical sessions and messages.
- **Predefined and web rows:** listing providers or web providers inserts any missing predefined rows automatically. `ProviderService` seals every nonempty API key with AES-256-GCM under a key derived from `secret_key` in `secrets.json`.
