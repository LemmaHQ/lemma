# Lemma Architecture

English | [中文](architecture.zh.md)

Read this before changing anything under `crates/`. It maps the crate layers, the three runtimes that host them, the path of one turn, and where new behavior attaches. Terms follow the [glossary](glossary.md); type definitions live on the planned subsystem pages listed in [subsystems/](subsystems/README.md).

## Crate layers

Lemma is one Rust workspace. A crate depends only on crates in its own layer or the layers above it in this table; `lemma-core` is the language every layer speaks.

| Layer | Crates | Owns |
| --- | --- | --- |
| Contracts | `lemma-proto`, `lemma-core`, `lemma-model` | Rust bindings for `proto/lemma/v1` and the coded error helpers; the canonical trace types: `Message`, `ContentBlock`, `StreamEvent`, `ToolSpec`, `Usage`; the model interface: `Adapter`, `Connector`, `ModelRequest`, `Endpoint`, `ProviderKind` |
| Domains | `lemma-auth`, `lemma-conversation`, `lemma-provider`, `lemma-crypto` | Accounts and tokens; conversations, the message tree, and their `ConversationStore` trait; provider configuration and model lists; API-key sealing |
| Engine | `lemma-adapter`, `lemma-tools`, `lemma-agent-loop` | Vendor wire formats and model lists; the tool registry, approval policy, and execution environment; the turn loop and its cancellation |
| Agent | `lemma-agent` | Assembling one turn from a request (provider endpoint, adapter, conversation store, workspace tools), running it, and aborting running turns |
| Storage | `lemma-db-sqlite`, `lemma-db-pgsql` | Migrations, SQL, and one implementation of each store trait per backend |
| RPC | `crates/rpc/*`, including `lemma-host` | One ConnectRPC service per proto service; `lemma-host` assembles them into one router over a storage backend, opens the local engine from its data directory, and serves the router in-process through `InProcessTransport` |
| Hosts | `lemma-server`, `lemma-desktop`, `lemma-mobile` | The server binary; the Node-API addon for the desktop engine; the UniFFI facade for Android |

The domain, engine, and agent layers contain no SQL. They define store traits (`ConversationStore`, `ProviderStore`, `AuthStore`), and each host passes in the SQLite or PostgreSQL implementation. `lemma-agent-loop` and `lemma-provider` reach models only through the `lemma-model` traits; `HttpConnector` in `lemma-adapter` implements them and sends HTTP through the injectable `HttpTransport` trait, with `ReqwestTransport` as the default.

Crates under `crates/shared/` build for every runtime, including Android; `crates/rpc/` holds the Connect services; crates under `crates/server/`, `crates/desktop/`, and `crates/mobile/` build only into their host ([crates/AGENTS.md](../crates/AGENTS.md#layout)).

## Runtimes

The same domain services and turn loop run in three hosts. Clients choose a host; the core does not know which client is calling.

| Runtime | Host | Storage | Tools | Stored API keys |
| --- | --- | --- | --- | --- |
| Server mode | `lemma-server`, port 1025 | PostgreSQL, or SQLite for a `sqlite:` `DATABASE_URL` | none | sealed with `LEMMA_SECRET_KEY` |
| Local engine | `lemma-server` with `LEMMA_LOCAL_MODE`, loopback port chosen by the OS | SQLite at `<LEMMA_DATA_DIR>/lemma.db` | per-conversation workspace | sealed with an engine-generated key |
| In-process | `LemmaEngine` in `lemma-mobile`, loaded into the Android app | SQLite at `<filesDir>/lemma.db` | per-conversation workspace | plaintext |

**Server mode** reads `DATABASE_URL`, `LEMMA_JWT_SECRET`, and `LEMMA_SECRET_KEY` from the environment, runs the backend's migrations at startup, and serves the four ConnectRPC services plus the web build embedded from `web/dist` at compile time. The browser client reaches it over HTTP; when the API shares the page's origin, the browser authenticates with the `lemma_access` and `lemma_refresh` cookies instead of bearer tokens.

**The local engine** is the desktop runtime. Electron starts `lemma-server` as a child process; the engine stores its JWT and sealing secrets in `secrets.json` under the data directory, creates the default local account, and prints one `LEMMA_READY <json>` line carrying its port and that account's credentials. It exits when its stdin closes. The renderer is the same web client, pointed at the engine's loopback URL ([desktop/AGENTS.md](../desktop/AGENTS.md#engine-and-renderer)).

**In-process** is the Android local mode. Kotlin opens `LemmaEngine` through generated UniFFI bindings and calls the domain services directly, with no RPC hop; turn events arrive through the `AgentEventListener` callback. The same Android app has a remote mode that talks to a server through Connect Kotlin. Both modes implement the Kotlin `LemmaClient` interface (`RemoteLemmaClient`, `LocalLemmaClient`).

The web client fetches conversations and messages from the host on each view. The Android client keeps a SQLDelight cache of the messages it has shown; the cache belongs to the client, and the host's store remains the record.

## Contracts across the wire

`proto/lemma/v1` is the single contract for every remote client: `AuthService`, `ProviderService`, `ConversationService`, and `AgentService`, plus `errors.proto`. Rust compiles it in `lemma-proto/build.rs`, the web npm scripts generate the web TypeScript, and the Gradle build generates the Android Kotlin ([proto/AGENTS.md](../proto/AGENTS.md)).

A business error carries an `ErrorReason` from the closed enum in `errors.proto`, attached as an `ErrorInfo` detail by `lemma_proto::app_error`; clients localize by reason code. Infrastructure failures (database, decryption, upstream) return an internal Connect error with a raw English message and no reason.

`AuthService.Me` and every RPC of the other three services resolve the caller with `require_user`: a `Bearer` access token, else the `lemma_access` cookie. Each request then works only on rows owned by that user id.

## The path of one turn

A **turn** starts from one user message and ends when the model stops without requesting tools, its stream fails, or the turn is aborted. A **step** is one model request; a turn with tool calls runs several steps. `Agent` in `lemma-agent` assembles each turn and both hosts call only it; the loop is `AgentLoop::run_turn` in `lemma-agent-loop`. The RPC host maps its `TurnEvent`s onto `AgentEvent` messages, and the mobile host maps them onto `MobileAgentEvent`.

```text
AgentService.SendMessage(conversation, provider, model, content, thinking_effort)
  require_user -> user id
  ProviderService::adapter opens the provider's API key and binds the adapter for its kind
  thinking_effort: the request's value, else the conversation's last model
  append the user message under the active leaf; move the leaf            -> started
  record the model selection on the conversation
  step:
    aborted -> end the turn                                               -> aborted
    fold the path from root to leaf into Vec<Message>
    append an assistant placeholder, status streaming; move the leaf      -> turn_started
    Adapter::stream(ModelRequest) -> StreamEvent*                         -> delta (text | thinking)
    settle the placeholder: content, stop reason, usage, status, timings
    aborted during the stream -> end the turn                             -> aborted
    stream failed -> end the turn                                         -> error
    no tools, stop reason not tool_use, or no tool calls -> end the turn  -> done
    for each tool call:                                                   -> tool_call_started
      approval policy -> Tool::execute in the workspace                   -> tool_call_finished
      append the tool result message; move the leaf
    next step
```

Messages persist as they happen: the user message and each placeholder are written before the model call, and every tool result is written before the next step. A failed stream leaves its placeholder with status `error` and the failure text.

The adapter layer normalizes every vendor stream into `StreamEvent`: `HttpConnector` binds each provider endpoint to `OpenAiCompatible`, `AnthropicMessages`, or `GeminiGenerate` by `ProviderKind`, each adapter parses the vendor's server-sent events, and the time to first content delta is measured in the adapter. Thinking from any vendor becomes a `Thinking` content block beside the text.

Tools run only when the loop has a `ToolRuntime`. `Agent` attaches one when its host gives it a workspaces directory: the local engine and the Android engine register `read_file`, `write_file`, and `bash` over a `LocalExecEnv` rooted at `workspaces/<conversation id>` under the data directory; server mode attaches no tools. An unknown tool, a `Prompt` or `Deny` approval decision, and a tool failure all become an error tool result that the model sees in the next step; none of them ends the turn.

`AbortMessage` takes the user message id from the `started` event and cancels that user's running turn. A streaming placeholder settles with status `aborted` and stop reason `aborted`; a running tool call completes and the turn stops before its next step; the stream ends with `aborted`. `LemmaEngine::abort_message` aborts a turn of the Android engine the same way.

A turn runs to its end whether or not a client reads its stream. `lemma-agent-rpc` records each running turn's `AgentEvent`s; `SendMessage` and `ResumeStream` both read that record, so a slow client misses no event. A client that loses its stream calls `ResumeStream` with the user message id and the number of events it already received, and gets the rest followed by the live events. Once the turn ends, `ResumeStream` fails with `ERROR_REASON_TURN_NOT_RUNNING`, and the client reads the settled messages instead.

## Persistence

Both backends share one logical schema: `users`, `auth_credentials`, `refresh_tokens`, `providers`, `conversations`, and `messages`. Each backend owns a `migrations/` directory of reversible pairs, and a schema change adds a migration to both ([crates/AGENTS.md](../crates/AGENTS.md#layout)). Every host runs migrations when it opens its pool.

A conversation is a tree of messages. Each message row stores its `parent_id`, the serialized canonical message with its token usage, its status (`streaming`, `done`, `aborted`, `error`), and the provider and model that produced it. The conversation row stores the active `leaf_id` and the last model selection. `ConversationStore` in `lemma-conversation` is the only trait over these tables; the turn loop appends, settles, and moves the leaf through it, and the conversation service creates, renames, deletes, and pages through it. Every operation on a conversation takes the caller's user id and touches only that user's rows.

A branch is a message appended under an earlier parent; past messages are never rewritten. Every turn continues from the active leaf. Model context is always the path from the root to the leaf, so sibling branches never reach the model.

Provider API keys pass through `ProviderService`, which seals them with AES-256-GCM under a key derived from the configured secret when it has one, and stores plaintext when it has none (the Android engine). Refresh tokens are stored as SHA-256 hashes; passwords as Argon2 hashes.

## Where new behavior goes

New behavior attaches to one of these points. Changing the turn loop itself updates this map.

| Goal | Mechanism |
| --- | --- |
| Add a vendor protocol | add a `ProviderKind` variant in `lemma-model`, implement `Adapter` and its model list in `lemma-adapter`, and bind it in `HttpConnector` |
| Add a model-facing tool | implement `Tool` in `lemma-tools` and register it where `Agent` builds its `ToolRegistry` (`lemma-agent`) |
| Gate tool calls | implement `ApprovalPolicy` and set it on the `ToolRuntime` |
| Run tools somewhere else | implement `ExecEnv` |
| Send provider traffic through another stack | implement `HttpTransport` and construct the `HttpConnector` with it |
| Add an RPC | change the `.proto`, implement it in the matching `crates/rpc/` crate, and regenerate the clients |
| Add an RPC service | add a `.proto` and a new crate under `crates/rpc/`, list the file in `lemma-proto/build.rs`, and route it in `lemma-host` |
| Add a user-facing error | add an `ErrorReason`, map it in `lemma-proto/src/error.rs`, and add its locale key in `web/src/data/rpc/errors.ts` and both locale files |
| Change the schema | add a migration pair to both `lemma-db-sqlite` and `lemma-db-pgsql`, then update the stores |
| Add a storage backend | implement the three store traits and wire them in each host |
| Expose a capability to Android local mode | add a method to `LemmaEngine`; its signature is a Kotlin API ([mobile/AGENTS.md](../mobile/AGENTS.md#modules-and-generated-code)) |
| Reach a desktop capability from the web client | extend the preload bridge and the adapter in `web/src/platform/` ([web/AGENTS.md](../web/AGENTS.md#layout)) |
