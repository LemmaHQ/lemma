# Feature Catalog

`docs/features/` is the single source of truth for what Lemma does and how far each client (web / desktop / android) has implemented it.
It replaces PRDs and standing tech-design documents.
Each feature is one directory; the directory name is the feature id.

Prose in this directory uses one sentence per line.

## Directory layout

```
<feature-id>/
  feature.yaml     # Identity, lifecycle, per-client status. Machine-checked.
  spec.md          # WHAT: behavioral contract. RFC 2119 + EARS requirements.
  design.md        # HOW: current implementation approach. May go stale; rewrite, don't archive.
  decisions/       # Optional. Irreversible trade-offs, MADR format, append-only.
  scenarios/       # Acceptance scenarios: Gherkin semantics in YAML form.
```

Only `feature.yaml` and `spec.md` are required.
Create `design.md`, `decisions/`, and `scenarios/` only when there is real content for them.

## feature.yaml

```yaml
id: offline-sync               # MUST equal the directory name
title: Offline Synchronization
status: in-progress            # draft | approved | in-progress | done | deprecated
owners: [core]
api:
  proto: [lemma.sync.v1]       # Optional; every listed package MUST exist under proto/
clients:
  web:     { status: supported, since: "0.8.0" }
  desktop: { status: inherited, inherits: web }
  android: { status: partial, since: "0.9.0", tracking: 123 }
links:
  plan: docs/plans/2026-09-19-offline-sync.md   # Optional; the file MUST exist
```

`status` (top level) is the single lifecycle axis: `draft → approved → in-progress → done`, plus `deprecated` for retired features.
There is no separate maturity field.

Per-client `status` is a closed set:

- `planned` — agreed to build, not started
- `in-progress` — actively being built
- `partial` — some of the spec's requirements work; list the gaps in spec.md
- `supported` — the full spec is implemented
- `inherited` — the client ships another client's implementation; requires `inherits` (desktop is an Electron shell of web and is usually `inherited`)
- `n/a` — the capability does not apply to this client by design

`since` is the first release version shipping that status.
`tracking` is the GitHub issue number for the remaining work.
Status fields are updated in the same PR that lands the implementation.

## Writing spec.md

spec.md states the behavioral contract — WHAT the feature does, never how it is implemented.
Keep it short; ten lines of requirements is a fine spec.

- Normative constraints use RFC 2119 keywords: MUST / SHOULD / MAY.
- Individual requirements use EARS: `WHEN <trigger> THE SYSTEM SHALL <response>`.
- Write in English. This repository is public.

## Writing scenarios/

Each YAML file is one acceptance scenario using Gherkin semantics:

```yaml
name: Queued message sends after reconnect
given:
  - the user is offline
  - a message was composed and queued
when:
  - connectivity returns
then:
  - the client sends the queued message
  - the message appears in the conversation with status sent
```

Scenarios are human-readable documentation in Phase 1; a test runner consuming them is a later increment.
Write them in the format above so no rewrite is needed when the runner lands.

## What does not belong here

- **Transient work artifacts**: implementation plans live in `docs/plans/`, tasks live in GitHub issues and the org project board.
  `feature.yaml` links to them via `links`; it does not embed them.
- **Historical changelogs**: `design.md` describes the present.
  When the implementation changes, rewrite it.
  Irreversible decisions go to `decisions/` and are never edited after merge.
- **Non-feature work**: refactors, dependency upgrades, and CI changes have no feature directory; they follow the plain `docs/plans/` approval flow.

## Workflow

1. New feature: copy `_template/` to `<feature-id>/`, set `id` and `title`, write spec.md, open the PR with `status: draft`.
2. Approval: `status: approved` after review.
3. Implementation: flip to `in-progress`, update per-client status in the same PR that ships the code.
4. Complete: `status: done` when every applicable client is `supported` (or explicitly `n/a`).

`just check-features` validates the catalog and runs in CI.
