# Lemma Architecture

English | [中文](architecture.zh.md)

Read this before changing anything under `crates/`. It maps the crate layers, the three runtimes that host them, the path of one turn, and where new behavior attaches. Terms follow the [glossary](glossary.md); type definitions live on the subsystem pages listed in [subsystems/](subsystems/README.md).

## Crate layers

Lemma is one Rust workspace. A crate depends only on crates in its own layer or the layers above it in this table; `lemma-core` is the language every layer speaks.

| Layer     | Crates                                                        | Owns                                                                                                                                                                                                                                           |
| --------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contracts | `lemma-proto`, `lemma-core`, `lemma-model`                    | Rust bindings for `proto/lemma/v1` and the coded error helpers; the canonical trace types: `Message`, `ContentBlock`, `StreamEvent`, `ToolSpec`, `Usage`; the model interface: `Adapter`, `Connector`, `ModelRequest`, `Endpoint`, `ApiFormat` |
| Domains   | `lemma-db`, `lemma-session`, `lemma-provider`, `lemma-crypto` | SQLite pool setup and schema migrations; sessions, the message tree, and `SessionService`; predefined, custom, and web providers, model lists, and `ProviderService`; API-key sealing                                                          |
| Engine    | `lemma-adapter`, `lemma-tool`, `lemma-agent-loop`             | Vendor wire formats, model lists, and web backend clients; the tool registry, execution environment, and web tools; the turn loop and its cancellation                                                                                         |
| Agent     | `lemma-agent`                                                 | Starting, resuming, and aborting turns over a session, a bound provider adapter, and the session directory's tools, with per-turn replayable event logs                                                                                        |
| RPC       | `lemma-rpc`, `lemma-engine`                                   | The ConnectRPC service handlers (`ProviderService`, `SessionService`, `AgentService`) assembled into one router; `Engine` over a data directory, `InProcessEngine`, and `InProcessTransport`                                                   |
| Hosts     | `lemma-server`, `lemma-desktop`, `lemma-mobile`               | The server binary; the Node-API addon for the desktop engine; the UniFFI facade for Android                                                                                                                                                    |

`lemma-session` and `lemma-provider` run parameterized `sqlx` queries over `SqlitePool`; `lemma-db` owns the SQLite migrations in `crates/shared/lemma-db/migrations/`. The engine and agent layers reach the data only through those services. `lemma-agent-loop` and `lemma-provider` reach models only through the `lemma-model` traits; `HttpConnector` in `lemma-adapter` implements them and sends HTTP through the injectable `HttpTransport` trait, with `ReqwestTransport` as the default.

Crates under `crates/shared/` build for every runtime, including Android; crates under `crates/server/`, `crates/desktop/`, and `crates/mobile/` build only into their host ([crates/AGENTS.md](../crates/AGENTS.md#layout)).

## Runtimes

The same domain services and turn loop run in three hosts. Clients choose a host; the core does not know which client is calling.

| Runtime      | Host                                                                         | Storage                               | Tools                                    | Stored API keys                            |
| ------------ | ---------------------------------------------------------------------------- | ------------------------------------- | ---------------------------------------- | ------------------------------------------ |
| Server mode  | `lemma-server`, listening on `127.0.0.1:1025` by default                     | SQLite at `<LEMMA_DATA_DIR>/lemma.db` | bound directory or per-session workspace | sealed with `secret_key` in `secrets.json` |
| Local engine | `lemma-desktop` in the Electron engine process, reached over a `MessagePort` | SQLite at `<userData>/lemma.db`       | bound directory or per-session workspace | sealed with `secret_key` in `secrets.json` |
| In-process   | `lemma-mobile` in the Android app process                                    | SQLite at `<filesDir>/lemma.db`       | per-session workspace                    | sealed with `secret_key` in `secrets.json` |

**Server mode** reads `LEMMA_DATA_DIR` (default `./data`) and `LEMMA_PORT` (default `1025`) from the environment, opens `Engine` over that data directory, listens on `127.0.0.1:<port>`, and serves the ConnectRPC services plus the web build embedded from `web/dist` at compile time. The browser client reaches it over HTTP.

**The local engine** is the desktop runtime. Electron runs the `lemma-desktop` addon in a utility process; the addon opens `Engine` over Electron's `userData` directory. The renderer is the same web client; its requests travel over a `MessagePort` to the engine process, which serves them on the Connect router in-process, with no network listener ([desktop/AGENTS.md](../desktop/AGENTS.md#engine-and-renderer)).

**In-process** is the Android local mode. Kotlin opens `LemmaEngine` from `lemma-mobile` through generated UniFFI bindings; it opens `Engine` over the app's `filesDir` and serves the Connect router in-process. The app talks to it through an OkHttp interceptor that hands each request to the engine instead of the network ([mobile/AGENTS.md](../mobile/AGENTS.md#modules-and-generated-code)).

All three hosts share one data-directory layout: `lemma.db` (SQLite in WAL mode with foreign keys), `secrets.json` (generated on first run with `secret_key` for AES-256-GCM sealing), and `workspaces/`. Both clients read sessions and messages directly from the engine; backups keep `lemma.db` and `secrets.json` together, because sealed keys in the database open only with `secret_key` in `secrets.json`.

## Contracts across the wire

`proto/lemma/v1` is the single contract for every client: `ProviderService`, `SessionService`, and `AgentService`, plus `errors.proto`. `ProviderService` covers model providers and web providers: it unseals stored API keys for read responses, seals written keys at rest, checks saved providers and fetches custom model lists by provider id, and sets the web search and fetch backend orders. `SessionService` manages sessions, returns a session's complete message tree with its active `leaf_id` and running `active_message_id`, switches the active leaf, and updates node labels. Rust compiles the contracts in `lemma-proto/build.rs`, the web npm scripts generate the web TypeScript, and the Gradle build generates the Android Kotlin ([proto/AGENTS.md](../proto/AGENTS.md)).

A business error carries an `ErrorReason` from the closed enum in `errors.proto`, attached as an `ErrorInfo` detail by `lemma_proto::app_error`; clients localize by reason code. Infrastructure failures (database, decryption, upstream) return an internal Connect error with a raw English message and no reason.

Lemma runs as a single-owner local node with no user accounts or authentication layer; every RPC operates directly on the node's local database.

## The path of one turn

A **turn** starts from one user message and ends when the model stops without requesting tools, its stream fails, or the turn is aborted. A **step** is one model request; a turn with tool calls runs several steps. `Agent` in `lemma-agent` starts, resumes, and aborts turns, running `AgentLoop::run_turn` in `lemma-agent-loop` in a background task; `lemma-rpc` calls only `Agent` and maps its `TurnEvent`s onto `AgentEvent` messages.

```text
AgentService.SendMessage(session, provider, model, content, parent_id?)
  Agent::start claims the session slot and resolves the target branch parent and the API format of the nearest assistant message above it
  ProviderService::bind picks the API format, opens the API key, and binds the adapter
  open the session directory and register its tools
  append the user message under the resolved branch parent; move the leaf -> started
  record the model selection on the session
  step:
    aborted -> end the turn                                               -> aborted
    fold the path from root to leaf into Vec<Message>
    tool calling off -> leave tool calls and tool results out of the request
    append an assistant placeholder, status streaming; move the leaf      -> turn_started
    Adapter::stream(ModelRequest) -> StreamEvent*                         -> delta (text | thinking)
    settle the placeholder: content, stop reason, usage, status, timings
    aborted during the stream -> end the turn                             -> aborted
    stream failed -> end the turn                                         -> error
    no tools, stop reason not tool_use, or no tool calls -> end the turn  -> done
    for each tool call:                                                   -> tool_call_started
      Tool::execute in the session directory                              -> tool_call_finished
      append the tool result message; move the leaf
    next step
```

Messages persist as they happen: the user message and each placeholder are written before the model call, and every tool result is written before the next step. A failed stream leaves its placeholder with status `error` and the failure text.

Every `AgentEvent` carries the server's `occurred_at` instant, preserved by replay. Assistant JSON bodies persist thinking and tool start/finish instants for history; old rows leave them absent, and adapters omit these server-only fields from provider requests. [Agent events](subsystems/agent.md#turn-events) define the timing points.

The adapter layer normalizes every vendor stream into `StreamEvent`: `HttpConnector` binds each provider endpoint to `OpenAiCompatible`, `AnthropicMessages`, or `GeminiGenerate` by `ApiFormat`, each adapter parses the vendor's server-sent events, and the time to first content delta is measured in the adapter. Thinking from any vendor becomes a `Thinking` content block beside the text.

A custom provider has one API format. A predefined provider serves several, and `ProviderService::bind` picks one for the whole turn: the format recorded on the nearest assistant message of the context path when the provider serves it, otherwise the provider's default format.

Tools run only when the loop has a `ToolRuntime`. `Agent` attaches one over the host's workspaces directory: all three hosts register `read_file`, `write_file`, and `bash` over a `LocalExecEnv` rooted in the session directory, which is the directory the session was created with or else `workspaces/<session id>` under the data directory, and tell the model that directory, the operating system, and the shell in a system prompt. [Tools](subsystems/agent.md#tools) defines path confinement and command limits. When the host also passes a web transport, the registry gains `web_search` when the search order has an enabled provider and `web_fetch` when the fetch order has one. Their backends come from the web provider orders at turn assembly, so a settings change applies to the next turn. `web_search` exposes the first search backend's full parameter set; a failed backend call moves to the next provider in the order, carrying over only the query and result count, and the normalized result records the backend that answered. An unknown tool and a tool failure both become an error tool result that the model sees in the next step; neither ends the turn. A model with tool calling off gets no tool definitions, and its requests leave out the tool calls and tool results of earlier steps; the stored messages keep them.

`AbortMessage` takes the user message id from the `started` event and cancels that running turn. A streaming placeholder settles with status `aborted` and stop reason `aborted`; a running `bash` command stops with its process tree, any other running tool call completes, and the turn stops before its next step; the stream ends with `aborted`.

A turn runs to its end whether or not a client reads its stream. `Agent` in `lemma-agent` records each running turn's `TurnEvent`s alongside its cancellation token; `SendMessage` and `ResumeStream` both read that log, so a slow client misses no event. A client that loses its stream calls `ResumeStream` with the user message id and the number of events it already received, and gets the rest followed by the live events. Once the turn ends, `ResumeStream` fails with `ERROR_REASON_TURN_NOT_RUNNING`, and the client reads the settled messages instead.

## Persistence

`lemma-db` owns the SQLite schema in `crates/shared/lemma-db/migrations/` and runs pending migrations when opening a pool (`Engine` calls `lemma_db::open`): `sessions` and `messages` for `lemma-session`, and `providers` and `web_providers` for `lemma-provider` ([crates/AGENTS.md](../crates/AGENTS.md#layout)).

A session is a tree of messages. Each message row stores its `parent_id`, optional user `label`, the canonical message with its token usage as a JSON body, its status (`streaming`, `done`, `aborted`, `error`), and the provider, model, and API format that produced it; the provider id is a plain id without a foreign key, so deleting a provider changes no message or session. The session row stores the active `leaf_id` and the last model selection. `SessionService` in `lemma-session` is the only code over these tables; the turn loop appends, settles, and moves the leaf through it, and it also creates, renames, and deletes sessions, reads the full message tree, validates and switches `leaf_id`, and sets message labels.

A branch is a message appended under an earlier turn boundary (or at the root); past messages are never rewritten. A turn continues from the active leaf by default or branches from an explicit target parent. Model context is always the path from the root to the turn's leaf, with unanswered tool calls from earlier interrupted turns omitted, so sibling branches never reach the model.

A `providers` row is predefined or custom. A custom row holds the whole configuration. A predefined row holds the API key, the enabled flag, and the default API format; `lemma-provider` reads the name, base URLs, and models from its definition in code, and listing providers inserts missing predefined rows. A `web_providers` row is a web service entry: its kind (`native`, `exa`, or `deepseek`), sealed API key, enabled flag, and positions in the search and fetch orders; Native needs no key, and listing inserts missing rows as well. `ProviderService` seals every nonempty provider API key with AES-256-GCM under a key derived from `secret_key` in `secrets.json`.

## Where new behavior goes

New behavior attaches to one of these points. Changing the turn loop itself updates this map.

| Goal                                           | Mechanism                                                                                                                                     |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Add a vendor protocol                          | add an `ApiFormat` variant in `lemma-model`, implement `Adapter` and its model list in `lemma-adapter`, and bind it in `HttpConnector`        |
| Add a predefined provider                      | add its definition to the predefined providers of `lemma-provider`                                                                            |
| Add a web backend                              | add its kind to the web catalog of `lemma-provider` and its client to `lemma-adapter`'s `web/` module                                         |
| Add a model-facing tool                        | implement `Tool` in `lemma-tool` and register it where `Agent` builds its `ToolRegistry` (`lemma-agent`)                                      |
| Run tools somewhere else                       | implement `ExecEnv`                                                                                                                           |
| Send provider traffic through another stack    | implement `HttpTransport` and construct the `HttpConnector` with it                                                                           |
| Add an RPC                                     | change the `.proto`, implement it in the matching RPC module of `crates/shared/lemma-rpc`, and regenerate the clients                         |
| Add an RPC service                             | add a `.proto`, list it in `lemma-proto/build.rs`, implement its handler in `crates/shared/lemma-rpc`, and mount it in `router`               |
| Add a user-facing error                        | add an `ErrorReason`, map it in `lemma-proto/src/error.rs`, and add its locale key in `i18n/errors.yaml` followed by `just i18n-gen`          |
| Change the schema                              | add a SQL migration to `crates/shared/lemma-db/migrations/`; `lemma_db::open` and `lemma_db::in_memory` run it when opening the pool          |
| Reach a desktop capability from the web client | extend `desktop/src/desktop-bridge.ts`, the preload bridge, and the adapter in `web/src/platform/` ([web/AGENTS.md](../web/AGENTS.md#layout)) |
