# 1. Name the execution surface "agent", not "chat"

- Status: accepted
- Date: 2026-10-03

## Context

The RPC crate driving agent turns was called `lemma-chat`, and the wire contract was `lemma.v1.ChatService`.
The crate contained no chat domain: it authenticated requests, loaded provider configuration, and translated engine events onto a proto stream.
Meanwhile the execution engine lives in `lemma-agent`, and the product's folder/module vocabulary had already settled on "agent".
Three names (`chat` in RPC, `agent` in engine, `conversation` in lifecycle) described two concepts.

## Decision

- Drop `chat` from the Rust and proto vocabulary: the crate becomes `lemma-agent-rpc`, the wire service becomes `lemma.v1.AgentService`, and the event types become `AgentEvent` and friends.
- RPC method names stay `SendMessage`, `AbortMessage`, `ResumeStream`; they describe operations and carry no stale term.
- RPC adapter crates live under `crates/server/rpc/` and are named after the domain they expose (`lemma-provider-rpc`, `lemma-agent-rpc`, later `lemma-conversation-rpc`).
- UI copy and component names keep whatever vocabulary reads best; the rename binds the engine, the RPC crates, and the wire contract only.

## Consequences

- Each RPC adapter crate is thin: authentication, request validation, and event translation. Everything else lives in the shared domain crates.
- The wire change is breaking; made now while the project is pre-release and has no compatibility burden.
