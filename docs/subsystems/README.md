# Subsystems

English | [中文](README.zh.md)

One page per subsystem of Lemma: what it is, the data structures it moves, and the invariants it holds. The folder complements [architecture.md](../architecture.md), which describes *behavior* across subsystems (the crate layers, server and local modes, the path of one turn); each page here is the reference for one subsystem's types and wiring.

| Page | Owns |
| --- | --- |
| [agent.md](agent.md) | the agent in `lemma-agent` and the turn loop in `lemma-agent-loop`, with its `AgentService` exposure: turn assembly, ordered stream events, abort and resume |
| [adapter.md](adapter.md) | the model interface in `lemma-model` and the adapters in `lemma-adapter`: request assembly, the connector, transport, model lists, and SSE parsing for OpenAI, Anthropic, and Gemini |

Type declarations on these pages match their source declarations. The owning page updates in the same change that reshapes a documented type ([writing rules](../AGENTS.md#writing-rules)).
