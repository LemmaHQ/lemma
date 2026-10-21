# Adapter

English | [中文](adapter.zh.md)

The adapter subsystem turns one model request into a stream of vendor-independent stream events. `lemma-model` defines the interface that the agent loop and the provider domain depend on; `lemma-adapter` implements it over HTTP for three API dialects. The loop never sees a vendor wire format, and the adapters never see stores, users, or encrypted keys.

## Interface: `lemma-model`

`lemma-model` holds only types and traits and performs no I/O.

| Type | Role |
| --- | --- |
| `ProviderKind` | The API dialect: `OpenAiCompatible`, `Anthropic`, or `Gemini`, stored as `openai`, `anthropic`, or `gemini`. |
| `Endpoint` | One provider's kind, base URL, generation path override, model-list path override, and plaintext API key. |
| `ModelRequest` | One streaming call: model id, canonical messages, tool definitions, and an optional thinking effort. |
| `Adapter` | `stream(ModelRequest)` opens the upstream call and yields `Result<StreamEvent, ModelError>` items. |
| `Connector` | `connect(Endpoint)` returns the adapter for the endpoint's kind; `list_models(Endpoint)` fetches the model ids the endpoint reports. |
| `ModelError` | Any failure, reduced to a message. |

`ProviderService::endpoint` in `lemma-provider` builds an `Endpoint` from a stored provider and decrypts its key; the provider service also calls `Connector::list_models`. An empty base URL or path selects the vendor default; an empty API key sends no credentials.

## Implementation: `lemma-adapter`

`HttpConnector` binds an endpoint to one adapter by kind. All adapters send HTTP through one injected `HttpTransport`; `ReqwestTransport` is the implementation every host uses.

| Kind | Adapter | Default request | Credentials | Thinking effort |
| --- | --- | --- | --- | --- |
| `openai` | `OpenAiCompatible` | `POST https://api.openai.com/v1/chat/completions` | `authorization: Bearer <key>` | sent verbatim as `reasoning_effort` |
| `anthropic` | `AnthropicMessages` | `POST https://api.anthropic.com/v1/messages` | `x-api-key`, with `anthropic-version: 2023-06-01` | a token budget in `thinking.budget_tokens` |
| `gemini` | `GeminiGenerate` | `POST https://generativelanguage.googleapis.com/v1beta/models/<model>:streamGenerateContent?alt=sse` | `x-goog-api-key` | a token budget in `generationConfig.thinkingConfig.thinkingBudget` |

A token budget comes from the effort: a number is used as is, `low` is 2048, `high` is 16384, and any other value is 8192. Anthropic requests set `max_tokens` to 8192, or to the budget plus 8192 when thinking is on. A Gemini path override may contain `{model}`, which is replaced by the model id.

Model lists use `GET` on `/models` under the same base URL as generation, with the same credentials and a 10-second limit. Gemini ids lose their `models/` prefix.

## Stream invariants

Each adapter parses the vendor's server-sent events into `StreamEvent`s, which [glossary.md](../glossary.md#agent-loop) defines. The shared SSE layer guarantees the event order the loop relies on:

- The stream opens with `Start`. Only `data:` lines are parsed.
- Text deltas arrive inside a `TextStart`/`TextEnd` pair. An open text block closes before a thinking block, before a tool call, and before `Done`.
- Thinking from any vendor arrives as `ThinkingStart`, deltas, and `ThinkingEnd`; Anthropic and Gemini carry the vendor signature on `ThinkingEnd` so the next request can replay the block.
- The stream ends with one `Done` carrying the stop reason and token usage; when the vendor closes the body without a terminal chunk, the layer emits `Done` from what the parser has seen.

## Failures

Adapters report every failure as a `ModelError` and never retry. The message names its source:

- `transport: <error>` when the connection or body read fails;
- `upstream <status>: <body>` when the vendor answers with a non-2xx status;
- a parse message when a response body does not match the vendor format.

The agent loop settles the step's placeholder with status `error` and this message ([architecture.md](../architecture.md#the-path-of-one-turn)).
