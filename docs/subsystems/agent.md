# Agent

English | [中文](agent.zh.md)

The agent subsystem turns one user request into a running turn and reports its progress. `lemma-agent` assembles the turn and tracks running turns for abort; `lemma-agent-loop` runs the steps; `lemma-agent-rpc` and `lemma-mobile` expose it to clients. The order of work inside a turn is described in [architecture.md](../architecture.md#the-path-of-one-turn); this page owns the types, events, and guarantees.

## Turn assembly

`Agent` holds the conversation service, the provider service, the model connector, and an optional workspaces directory. `Agent::prepare(TurnRequest)` validates the request and returns a `Turn`, or fails before any message is written:

| Check | Failure |
| --- | --- |
| content is empty after trimming | `AgentError::ContentRequired` |
| model id is empty after trimming | `AgentError::ModelRequired` |
| the provider does not belong to the user | `AgentError::ProviderNotFound` |
| the provider key cannot be opened, the database fails, or the workspace cannot be created | `Provider`, `Store`, or `Workspace` |

An empty thinking effort reuses the effort of the conversation's last model selection. With a workspaces directory, the turn gets the `read_file`, `write_file`, and `bash` tools rooted at `<workspaces_dir>/<conversation id>`; without one, the model is called without tools.

`Turn::run(observer)` runs the turn to its end and returns `TurnEnd::Done` or `TurnEnd::Aborted`; a failed stream or database returns `AgentError::Loop`. `Turn::user_message_id` is the id the user message is stored under; abort and resume address the turn by it.

## Turn events

The loop reports `TurnEvent`s to the observer in the order they happen. `lemma-agent-rpc` maps them onto `AgentEvent` and reports failures outside the model stream from the run's result:

| Source | `AgentEvent` (`lemma-agent-rpc`) | Meaning |
| --- | --- | --- |
| `UserAppended` | `started` | The user message is stored; carries its id and the client's `client_msg_id`. |
| `AssistantStarted` | `turn_started` | A step's placeholder is stored; carries the assistant message id. |
| `Delta`, `ThinkingDelta` | `delta` (`text` or `thinking`) | One chunk of the model stream. |
| `ToolStarted`, `ToolFinished` | `tool_call_started`, `tool_call_finished` | One tool call, with its arguments, then its output and error flag. |
| `AssistantDone` | `done` | The last step finished without requesting tools; carries token usage. |
| `TurnAborted` | `aborted` | The turn was aborted. |
| `TurnFailed`, non-model `Err(AgentError)` | `error` | The turn failed; carries the error text. |

Every `AgentEvent` carries the server's `occurred_at` instant. The first thinking delta sets `thinking_started_at`; the first text delta, tool call, `done`, `aborted`, or `error` event sets `thinking_finished_at`. `tool_call_started` and `tool_call_finished` set the corresponding tool instants when execution starts and its result arrives. The assistant message JSON stores these as optional `started_at` and `finished_at` fields on thinking and tool-call blocks, and the stored `Message` proto exposes them for history. Rows written before timing have no values. Replay returns the logged event unchanged.

## Abort

Each prepared turn registers a `CancelToken` under its user message id until the `Turn` is dropped. `Agent::abort(user_id, user_message_id)` cancels the token only when that user owns the turn; any other id is ignored. Cancelling interrupts a model stream at once and settles its placeholder with status `aborted`; a running tool call completes, and the turn stops before the next step. `AbortMessage` calls `Agent::abort`.

## Streams and resume

`lemma-agent-rpc` runs every turn in its own task, so a turn runs to its end whether or not a client reads its stream. Its `LiveTurns` keeps one event log per running turn, keyed by user message id:

- `SendMessage` reads the log from the start. The log is unbounded, so a slow reader receives every event.
- `ResumeStream(message_id, offset)` reads the same log from event `offset`, then follows live events. `offset` is the number of events the client already received.
- When the turn ends, the log closes and is removed. Open streams finish reading it; a later `ResumeStream`, or one from another user, fails with `ERROR_REASON_TURN_NOT_RUNNING`.

The web client counts the events it applies, resumes with that count after a broken stream, and reloads the conversation's messages on `ERROR_REASON_TURN_NOT_RUNNING`.

## Errors

`AgentService.SendMessage` reports preparation failures as RPC errors before the stream opens: `CONTENT_REQUIRED`, `MODEL_REQUIRED`, and `PROVIDER_NOT_FOUND` carry an `ErrorReason`; other failures are internal errors. Failures after the stream opens arrive as an `error` event, and the failed step's placeholder keeps status `error` with the failure text.
