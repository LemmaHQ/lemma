# Agent Execution

## Summary

Agent Execution turns a user message into a streamed assistant response by running the shared agent engine against a provider API.
One platform-agnostic engine (`lemma-agent`) drives the turn; the server exposes it over RPC, embedded clients call it directly.

## Requirements

### Shared engine

- THE SYSTEM SHALL execute every turn through a single platform-agnostic engine shared by server and local modes.
- The engine SHALL depend exclusively on storage and provider domain contracts, isolating RPC types, HTTP plumbing, and concrete databases behind the abstraction layer.
- WHEN a turn starts, THE SYSTEM SHALL append the user message to the session tree and move the conversation's leaf pointer to it.
- WHEN a turn starts, THE SYSTEM SHALL record the selected provider and model on the conversation metadata.
- WHEN a turn starts, THE SYSTEM SHALL pre-create the assistant message with streaming status, so a partially generated reply is visible after an interruption.
- WHEN the provider stream settles upon direct text completion, THE SYSTEM SHALL finalize the assistant message in place with its full content, status, token usage, and timing marks.

### Streaming events

- WHEN a turn runs, THE SYSTEM SHALL emit ordered events: the initial start event, zero or more text or thinking deltas, intermediate tool events when tools execute, and exactly one terminal event (done, aborted, or error).
- Each delta event SHALL carry either a text fragment or a thinking fragment as produced by the provider stream.
- WHEN a tool call starts, THE SYSTEM SHALL emit a tool call started event containing the call identifier, tool name, and arguments.
- WHEN a tool call finishes, THE SYSTEM SHALL emit a tool call finished event containing the call identifier, tool name, output content, and failure flag.
- The terminal done event SHALL carry the turn's token usage when the provider reported it.

### Tool execution loop

- WHEN the model requests tool execution, THE SYSTEM SHALL execute each requested tool call against the workspace environment.
- WHEN evaluating a tool call, THE SYSTEM SHALL enforce configured approval policies based on the tool's execution tier before running the tool.
- WHEN a tool call finishes, THE SYSTEM SHALL append a distinct tool result message row to the session tree under the assistant turn and advance the conversation leaf pointer to that result row.
- WHEN all requested tool calls complete, THE SYSTEM SHALL re-invoke the model with the accumulated context path including the new tool results, continuing the loop until the model returns a final text response.

### Server exposure

- THE SERVER SHALL expose the engine as the `AgentService` RPC: send message, abort message, resume stream.
- WHEN a client connection drops mid-turn, THE SYSTEM SHALL let the client resume the event stream from the last received offset.
- WHEN the user aborts a running turn, THE SYSTEM SHALL stop generation immediately and mark the active assistant message as aborted.

### Branching

- WHEN the user continues from an earlier message, THE SYSTEM SHALL append the new user message under that message and move the leaf pointer to the new branch tip, leaving the old branch untouched.
- WHEN preparing input messages for the provider, THE SYSTEM SHALL traverse the branch path backwards from the active leaf pointer to the root, folding the branch nodes into a linear sequence.
