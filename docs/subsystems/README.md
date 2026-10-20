# Subsystems

English | [中文](README.zh.md)

One page per subsystem of Lemma: what it is, the data structures it moves, and the invariants it holds. The folder complements [architecture.md](../architecture.md), which describes *behavior* across subsystems (the crate layers, server and local modes, the path of one turn); each page here is the reference for one subsystem's types and wiring.

| Page | Owns |
| --- | --- |
| `core.md` | the shared domain types in `lemma-core`: messages, content blocks, stream events, tool calls, token usage |
| `agent.md` | the agent in `lemma-agent` and the turn loop in `lemma-agent-loop`, with its `AgentService` exposure: turn assembly, ordered stream events, abort and resume |
| `adapter.md` | the model interface in `lemma-model` and the adapters in `lemma-adapter`: request assembly, the connector, transport, model lists, and SSE parsing for OpenAI, Anthropic, and Gemini |
| `tools.md` | the tool registry in `lemma-tools`: tool definitions, execution tiers, approval policy, the workspace environment, built-in tools |
| `conversation.md` | conversation records, the message tree (the leaf pointer, branching, and the context path), the `ConversationStore` trait, and the conversation service in `lemma-conversation` |
| `provider.md` | provider records, model catalogs, and stored credentials in `lemma-provider` |
| `auth.md` | accounts, password hashing, JWT issuance, local-mode accounts, and secret encryption in `lemma-auth` and `lemma-crypto` |
| `storage.md` | the store traits and their SQLite and PostgreSQL backends in `lemma-db-sqlite` and `lemma-db-pgsql` |
| `rpc.md` | the `proto/lemma/v1` contracts, ConnectRPC services under `crates/server/rpc/`, and the error model in `lemma-proto` |
| `server.md` | `lemma-server`: configuration, routing, embedded web assets, server and local modes |
| `web-client.md` | the React client in `web/`: RPC clients, stores, the conversation view |
| `desktop-engine.md` | the Electron shell in `desktop/` and its sidecar engine lifecycle |
| `mobile-bridge.md` | the UniFFI bindings in `lemma-mobile` and the Android client in `mobile/` |

Type declarations on these pages match their source declarations. The owning page updates in the same change that reshapes a documented type ([writing rules](../AGENTS.md#writing-rules)).
