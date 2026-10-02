# Agent Execution

## Summary

Agent Execution turns a user message into a streamed assistant response by running the shared agent engine against a provider API.
One platform-agnostic engine (`lemma-agent`) drives the turn; the server exposes it over RPC, embedded clients call it directly.

## Requirements

### Shared engine

- THE SYSTEM SHALL execute every turn through a single platform-agnostic engine shared by server and local modes.
- The engine SHALL depend only on storage and provider contracts, never on RPC types, HTTP plumbing, or a concrete database.
- WHEN a turn starts, THE SYSTEM SHALL append the user message to the session tree and move the conversation's leaf pointer to it.
- WHEN a turn starts, THE SYSTEM SHALL pre-create the assistant message with streaming status, so a partially generated reply is visible after an interruption.
- WHEN the provider stream settles, THE SYSTEM SHALL finalize the assistant message in place with its full content, status, token usage, and timing marks.

### Streaming events

- WHEN a turn runs, THE SYSTEM SHALL emit ordered events: the user message commit, zero or more text deltas, and exactly one terminal event (done or error).
- Each delta event SHALL carry one text fragment as produced by the provider stream.
- The terminal done event SHALL carry the turn's token usage when the provider reported it.

### Server exposure

- THE SERVER SHALL expose the engine as the `AgentService` RPC: send message, abort message, resume stream.
- WHEN a client connection drops mid-turn, THE SYSTEM SHALL let the client resume the event stream from the last received offset.
- WHEN the user aborts a running turn, THE SYSTEM SHALL stop the generation and mark the assistant message as aborted.

### Branching

- WHEN the user continues from an earlier message, THE SYSTEM SHALL append the new user message under that message and move the leaf pointer to the new branch tip, leaving the old branch untouched.
