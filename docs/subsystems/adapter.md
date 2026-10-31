# Adapter

English | [中文](adapter.zh.md)

The adapter subsystem turns one model request into a stream of vendor-independent stream events. `lemma-model` defines the interface that the agent loop and the provider domain depend on; `lemma-adapter` implements it over HTTP for three API dialects. The loop never sees a vendor wire format, and the adapters never see stores, users, or encrypted keys.

## Interface: `lemma-model`

`lemma-model` holds only types and traits and performs no I/O.

| Type | Role |
| --- | --- |
| `ProviderKind` | The API dialect: `OpenAiCompatible`, `Anthropic`, or `Gemini`, stored as `openai`, `anthropic`, or `gemini`. |
| `Endpoint` | One provider's kind, base URL, generation path override, model-list path override, and plaintext API key. |
| `ModelRequest` | One streaming call: model id, canonical messages, and tool definitions. |
| `Adapter` | `stream(ModelRequest)` opens the upstream call and yields `Result<StreamEvent, ModelError>` items. |
| `Connector` | `connect(Endpoint)` returns the connector's `Adapter` type bound to the endpoint; `list_models(Endpoint)` fetches the model ids the endpoint reports. |
| `ModelError` | Any failure, reduced to a message. |

`ProviderService::adapter` in `lemma-provider` builds an `Endpoint` from a stored provider, decrypts its key, and binds it through `Connector::connect`; the provider service also calls `Connector::list_models`. An empty base URL or path selects the vendor default; an empty API key sends no credentials.

## Implementation: `lemma-adapter`

`HttpConnector` binds an endpoint to one adapter by kind and returns it as a `ModelAdapter` variant. All adapters send HTTP through one injected `HttpTransport`; `ReqwestTransport` is the implementation every host uses.

| Kind | Adapter | Default request | Credentials |
| --- | --- | --- | --- |
| `openai` | `OpenAiCompatible` | `POST https://api.openai.com/v1/chat/completions` | `authorization: Bearer <key>` |
| `anthropic` | `AnthropicMessages` | `POST https://api.anthropic.com/v1/messages` | `x-api-key`, with `anthropic-version: 2023-06-01` |
| `gemini` | `GeminiGenerate` | `POST https://generativelanguage.googleapis.com/v1beta/models/<model>:streamGenerateContent?alt=sse` | `x-goog-api-key` |

The base URL takes the form the vendor SDK uses: the version segment belongs to the base URL for `openai` and to the default path for `anthropic` and `gemini`.

Anthropic requests set `max_tokens` to 8192. A Gemini path override may contain `{model}`, which is replaced by the model id.

Model lists use `GET` under the same base URL as generation, with the same credentials and a 10-second limit: `/models` for `openai`, `/v1/models` for `anthropic`, `/v1beta/models` for `gemini`. Gemini ids lose their `models/` prefix.

## Stream invariants

Each adapter parses the vendor's server-sent events into `StreamEvent`s, which [glossary.md](../glossary.md#agent-loop) defines. The shared SSE layer guarantees the event order the loop relies on:

- Only `data:` lines are parsed.
- Text deltas arrive inside a `TextStart`/`TextEnd` pair. An open text block closes before a thinking block, before a tool call, and before `Done`.
- Thinking from any vendor arrives as `ThinkingStart`, deltas, and `ThinkingEnd`; Anthropic and Gemini carry the vendor signature on `ThinkingEnd` so the next request can replay the block.
- The stream ends with one `Done` carrying the stop reason and token usage; when the vendor closes the body without a terminal chunk, the layer emits `Done` from what the parser has seen.

## Failures

Adapters report every failure as a `ModelError` and never retry. The message names its source:

- `transport: <error>` when the connection or body read fails;
- `upstream <status>: <body>` when the vendor answers with a non-2xx status;
- a parse message when a response body does not match the vendor format.

The agent loop settles the step's placeholder with status `error` and this message ([architecture.md](../architecture.md#the-path-of-one-turn)).
