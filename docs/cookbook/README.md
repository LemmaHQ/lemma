# Cookbook

English | [中文](README.zh.md)

Step-by-step how-tos for recurring changes. Each recipe is a tutorial: an ordered path from a clean checkout to a working, verified change.

## Recipe format

- File names follow `adding-a-<thing>.md` (or `adding-an-<thing>.md`).
- A recipe opens with the outcome and its prerequisites.
- Steps are numbered; each step ends with a verify step that names the command to run and the result that proves the step.
- Design rationale lives in the owning Agent Note, which the recipe links.
- Type definitions and semantics live in [subsystems/](../subsystems/README.md); a recipe links the page it touches.

## Recipes

| Recipe | Outcome |
|---|---|
| `adding-a-provider-adapter.md` | a new LLM provider wired through `lemma-adapter` and selectable from the clients |
| `adding-a-tool.md` | a new agent tool registered in `lemma-tools` with its execution tier |
| `adding-an-rpc-service.md` | a new `proto/lemma/v1` service served by `lemma-server` and called from the web client |
| `adding-a-migration.md` | a schema change applied to both the SQLite and PostgreSQL backends |
