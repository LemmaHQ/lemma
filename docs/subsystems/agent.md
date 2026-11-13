# Agent

English | [中文](agent.zh.md)

The agent subsystem turns one user request into a running turn and reports its progress. `lemma-agent` starts, resumes, and aborts turns over a unified running-turn registry; `lemma-agent-loop` runs the steps; `lemma-host` and `lemma-mobile` expose it to clients. The order of work inside a turn is described in [architecture.md](../architecture.md#the-path-of-one-turn); this page owns the types, events, and guarantees.

## Turn startup

`Agent` holds the session service, the provider service, a workspaces directory, and an optional web `HttpTransport`. `Agent::start(TurnRequest)` validates the request, spawns the turn in the background, and returns a live `TurnEvent` stream, or fails before any message is written:

| Check | Failure |
| --- | --- |
| content is empty after trimming | `AgentError::ContentRequired` |
| model id is empty after trimming | `AgentError::ModelRequired` |
| the provider does not exist | `AgentError::ProviderNotFound` |
| the session does not exist | `AgentError::SessionNotFound` |
| the session's bound directory no longer exists | `AgentError::DirectoryNotFound` |
| the provider key cannot be opened, the database fails, or the workspace cannot be created | `Provider`, `Store`, or `Workspace` |

`ProviderService::bind` returns the adapter with the API format the turn uses and the model's tool-calling flag; [architecture.md](../architecture.md#the-path-of-one-turn) states how it picks the format. A model with tool calling off gets no tools, and its requests leave out earlier tool calls and tool results.

Once `Agent::start` succeeds, the turn runs to its end in a spawned task; any mid-turn failure outside cancellation emits a terminal `TurnEvent::TurnFailed` on the stream. The first event (`TurnEvent::UserAppended`) carries the id the user message is stored under; `Agent::abort` and `Agent::resume` address the turn by it.

## Tools

The turn gets the `read_file`, `write_file`, and `bash` tools over a `LocalExecEnv` rooted in the session directory: the directory the session was created with, or else its workspace `<workspaces_dir>/<session id>`, which `start` creates after it has found the session, plus `web_search` and `web_fetch` when `Agent` has a web `HttpTransport` and the function's order has an enabled backend. Every model request of the turn carries a system prompt naming that directory, the operating system, and the shell.

`LocalExecEnv` confines `read_file` and `write_file` to the root:

- A relative path resolves against the root; an absolute path is accepted when it lies inside the root; a path with a `..` component is refused.
- The path resolves through symlinks: the nearest existing ancestor is canonicalized and the missing components are appended. The result must lie under the canonical root, so a link out of the root and a dangling link are both refused. Canonical paths also settle letter case, junctions, and 8.3 names on Windows.
- The write goes to the resolved path.

`bash` runs the command in `cmd /C` on Windows and `sh -c` elsewhere, starting in the root and otherwise unconfined. The call's `timeout` is 1 to 3600 seconds, 300 by default. A command that runs past it, or whose turn is aborted, stops with its whole process tree: on Unix its process group receives `SIGTERM` and, 2 seconds later, `SIGKILL`; on Windows `taskkill /T /F` ends it. Each output stream keeps its first and last 16 KB with the omitted byte count between them. The result carries `exit_code`, `stdout`, and `stderr`, plus `stopped` (`timed out after N s` or `aborted`) when the command was stopped.

## Turn events

The loop reports timestamped `TurnEvent`s to its observer in the order they happen, and `Agent` appends a terminal `TurnEvent::TurnFailed` if the loop exits with a non-model error. `lemma-host` maps each `TurnEvent` onto `AgentEvent`:

| Source | `AgentEvent` (`lemma-host`) | Meaning |
| --- | --- | --- |
| `UserAppended` | `started` | The user message is stored; carries its id. |
| `AssistantStarted` | `turn_started` | A step's placeholder is stored; carries the assistant message id. |
| `Delta`, `ThinkingDelta` | `delta` (`text` or `thinking`) | One chunk of the model stream. |
| `ToolStarted`, `ToolFinished` | `tool_call_started`, `tool_call_finished` | One tool call, with its arguments, then its output and error flag. |
| `AssistantDone` | `done` | The last step finished without requesting tools. |
| `TurnAborted` | `aborted` | The turn was aborted. |
| `TurnFailed` | `error` | The turn failed; carries the error text. |

Every `TurnEvent` carries its server instant `at`, mapped directly to `AgentEvent.occurred_at`. The first thinking delta sets `thinking_started_at`; the first text delta, tool call, `done`, `aborted`, or `error` event sets `thinking_finished_at`. `tool_call_started` and `tool_call_finished` set the corresponding tool instants when execution starts and its result arrives. The assistant message JSON stores these as optional `started_at` and `finished_at` fields on thinking and tool-call blocks, and the stored `Message` proto exposes them for history. Rows written before timing have no values. Replay returns the logged event unchanged.

## Abort

Each running turn registers a `CancelToken` alongside its event log under its user message id until its background task finishes. `Agent::abort(user_message_id)` cancels that turn's token; any other id is ignored. Cancelling interrupts a model stream at once and settles its placeholder with status `aborted`; a running `bash` command stops as described under [Tools](#tools), any other running tool call completes, and the turn stops before the next step. `AbortMessage` calls `Agent::abort`.

## Streams and resume

`Agent::start` spawns every turn in its own task, so a turn runs to its end whether or not a client reads its stream. `Agent` keeps one `TurnEvent` log per running turn, keyed by user message id:

- `SendMessage` streams `Agent::start` from event `0`. The log is unbounded, so a slow reader receives every event.
- `ResumeStream(message_id, offset)` calls `Agent::resume(message_id, offset)` to read the same log from event `offset`, then follows live events. `offset` is the number of events the client already received.
- When the turn ends, the writer drops, closing and removing the entry after draining queued events. Open streams finish reading it; a later `ResumeStream` fails with `ERROR_REASON_TURN_NOT_RUNNING`.

The web client counts the events it applies, resumes with that count after a broken stream, and reloads the session's messages on `ERROR_REASON_TURN_NOT_RUNNING`.

## Errors

`AgentService.SendMessage` reports preparation failures as RPC errors before the stream opens: `CONTENT_REQUIRED`, `MODEL_REQUIRED`, `PROVIDER_NOT_FOUND`, `SESSION_NOT_FOUND`, and `DIRECTORY_NOT_FOUND` carry an `ErrorReason`; other failures are internal errors. Failures after the stream opens arrive as an `error` event, and the failed step's placeholder keeps status `error` with the failure text.
