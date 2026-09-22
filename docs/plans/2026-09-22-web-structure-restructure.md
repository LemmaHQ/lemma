# Web Structure Restructure: Feature-Based Ownership

Date: 2026-09-22.
Status: Draft, awaiting approval.
Source: the read-only architecture review `Lemma-Web-工程结构审查与重组方案-2026-09-18.md` (user Desktop, not a repo file), adapted to the post-restructure core vocabulary.

## Scope

Restructure `web/src` from top-level technical buckets (`components / stores / hooks / lib`) into business-aggregated ownership (`app / features / data / platform`).
Desktop is entirely out of scope: no `desktop/` changes, no Desktop-specific extractions (`platform/desktop.ts`, `styles/desktop.css`), no Desktop acceptance work, no icon wiring.
URLs, storage keys, IndexedDB name/version, request order, resume offset units, cursor semantics, i18n keys, and every visible interaction stay byte-identical.
No tech-stack, state-framework, repository-layer, FSD, or shared-package changes.

## Naming Alignment With the New Core

The report predates the portable-agent-core restructure; its vocabulary is replaced as follows.

| Report name | Plan name | Reason |
| --- | --- | --- |
| `features/chat/` | `features/agent/` | Aligns with `lemma-agent`; `chat` remains only the wire contract (`chat.proto`, `chatClient`) |
| `data/session.ts` (token storage) | `data/credentials.ts` | Frees `session` for the core's agent session-tree meaning (`lemma-session`) |
| `app/cross-tab-session.ts` | `app/cross-tab-account.ts` | It watches account switches, not session trees |
| `app/useSessionLifecycle.ts` | `app/useAccountRuntime.ts` | Owns the signed-in user's cache/sync runtime |
| `lib/sessionGrouping.ts` | `features/conversations/grouping.ts` | Ends the session/conversation confusion |
| `ChatItem` and store-local chat types | `AgentItem`, etc. | Types follow their owner; all callsites migrate in the same commit, no aliases |
| `conversations`, `data/cache`, `data/sync` | unchanged | Already match `lemma-conversations` / `lemma-db-client` / `lemma-sync` roles |

`features/agent` must not hardcode linear-list assumptions into new component APIs: `MessageList` receives an already-ordered visible path, leaving room for the tree pointers (`leaf_id` / `parent_id`) the core now exposes.

## Target Structure

```text
web/src/
├── main.tsx
├── index.css
├── app/
│   ├── App.tsx
│   ├── routes.tsx
│   ├── RequireAuth.tsx
│   ├── useAccountRuntime.ts
│   ├── cross-tab-account.ts
│   ├── pages/
│   │   ├── LoginPage.tsx
│   │   ├── ChatPage.tsx
│   │   └── settings/
│   │       ├── SettingsPage.tsx
│   │       ├── SettingsNav.tsx
│   │       ├── sections.ts
│   │       └── sections.test.ts
│   └── shell/
│       ├── AppSidebar.tsx
│       └── SyncIndicator.tsx
├── features/
│   ├── auth/                     # AuthCard.tsx, store.ts
│   ├── agent/                    # store.ts(+test), useModelSelection.ts, components/
│   ├── conversations/            # store.ts(+test), useConversations.ts, grouping.ts(+test), ConversationList.tsx
│   ├── providers/                # store.ts, useProviders.ts, ProvidersPanel.tsx, components/
│   ├── storage/                  # StoragePanel.tsx, useStorageSettings.ts
│   └── preferences/              # AppearancePanel.tsx, ThemeToggle.tsx, LanguageToggle.tsx, theme.ts
├── data/
│   ├── rpc/                      # transport.ts, clients.ts, errors.ts(+test)
│   ├── credentials.ts
│   ├── cache/                    # database.ts, records.ts, cache.test.ts
│   └── sync/                     # engine.ts(+test), status.ts
├── platform/
│   ├── environment.ts
│   └── environment.test.ts
├── components/ui/                # unchanged shadcn base components
├── lib/utils.ts                  # unchanged
├── i18n/                         # unchanged: index.ts, i18next.d.ts, locales/*.json
├── styles/                       # unchanged, tokens.css stays generated
├── assets/fonts/                 # unchanged
└── gen/                          # unchanged buf output anchor
```

Dependency direction: `main → app → features → data`; `data/sync → data/rpc + data/cache`; `platform` is a leaf consumed by rpc/ui; nothing in `data/` or `platform/` imports features or pages.
No new path aliases: `@/features/...` etc. are sufficient.

## Phase 1: File Relocation (Zero Behavior Risk)

Move with LSP `rename_file`, migrate every caller in the same commit, leave no re-export shims.

- `stores/auth.ts` → `features/auth/store.ts`; `components/auth/AuthCard.tsx` → `features/auth/AuthCard.tsx`.
- `stores/chat.ts(.test.ts)` → `features/agent/store.ts(.test.ts)`, renaming `ChatItem`-family types to `AgentItem` in the same pass.
- `components/chat/{HomeView,ChatComposer,MessageItem,MessageContent,EmptyState,ModelSwitcher}.tsx` → `features/agent/components/`.
- `hooks/useChat.ts` → delete; callers import the agent store directly.
- `stores/conversations.ts(.test.ts)` → `features/conversations/`; `hooks/useConversations.ts` → `features/conversations/useConversations.ts`; `lib/sessionGrouping.ts(.test.ts)` → `features/conversations/grouping.ts(.test.ts)`.
- `stores/providers.ts` → `features/providers/store.ts`; `hooks/useProviders.ts` → `features/providers/useProviders.ts`; `components/providers/{ProviderListPane,NewProviderForm,ProviderDetail}.tsx` → `features/providers/components/`.
- `lib/providerKind.ts` → delete after a fresh full-repo reference check.
- `components/{ThemeToggle,LanguageToggle}.tsx`, `components/providers/AppearancePanel.tsx`, `lib/theme.ts` → `features/preferences/`.
- `components/providers/StoragePanel.tsx` → `features/storage/StoragePanel.tsx` (hook extraction is Phase 4).
- `lib/{clients,transport,errors}.ts` + `errors.test.ts` → `data/rpc/`.
- `lib/session.ts` token read/write → `data/credentials.ts` (cross-tab listener stays until Phase 3).
- `lib/server-url.ts(.test.ts)` → `platform/environment.ts(.test.ts)`, contents unchanged.
- `lib/sync.ts(.test.ts)` → `data/sync/engine.ts(.test.ts)`; `stores/sync.ts` → `data/sync/status.ts`.
- `lib/db.ts(.test.ts)` → `data/cache/database.ts(.test.ts)` intact; the `records.ts` split is Phase 4.

Test mock paths (`vi.mock` string literals) are checked by hand since symbol renames do not cover them.

## Phase 2: Settings Center

- `pages/ProvidersPage.tsx` → `app/pages/settings/SettingsPage.tsx`: route shell only, no provider state.
- New `features/providers/ProvidersPanel.tsx` owns `useProviders`, `selectedId`, `creating`, and the save/delete callbacks extracted from the old page.
- `components/providers/SettingsNav.tsx` → `app/pages/settings/SettingsNav.tsx`; `lib/settingsSection.ts(.test.ts)` → `app/pages/settings/sections.ts(.test.ts)`.

Observable result: mounting appearance/storage settings no longer triggers provider loading; the providers section keeps identical behavior.

## Phase 3: App Lifecycle and Shell

- `App.tsx` → `app/App.tsx` (providers + router mount only).
- Route tree → `app/routes.tsx`; auth guard → `app/RequireAuth.tsx`; lazy/Suspense semantics unchanged.
- The userId-driven cache/sync effects → `app/useAccountRuntime.ts`, keeping the exact open → hydrate → onSynced → startSync order and the single-owner cleanup.
- `lib/session.ts` cross-tab listener + `userIdOf` → `app/cross-tab-account.ts`; the account-switch-only reload condition is not broadened.
- `pages/{LoginPage,ChatPage}.tsx` → `app/pages/`.
- `components/chat/AppSidebar.tsx` → `app/shell/AppSidebar.tsx` (chrome, user menu, preferences entries) with the session rows extracted to `features/conversations/ConversationList.tsx`; navigation decisions stay with the shell/page.
- `components/SyncIndicator.tsx` → `app/shell/SyncIndicator.tsx`.

## Phase 4: Local Complexity Reduction

- `features/agent/useModelSelection.ts`: model persistence, validity check, fallback, extracted from ChatPage; the page passes available providers in.
- `ModelSwitcher` becomes props-driven (options, current selection, callback); empty-option disabling unchanged.
- `features/agent/components/MessageList.tsx`: scroll container + list rendering extracted; auto-scroll rules untouched.
- `features/providers/components/ModelList.tsx` extracted from `ProviderDetail` (search, remote fetch, merge-dedupe, manual add, delete).
- `features/storage/useStorageSettings.ts`: config load, drafts, save/test/delete, pending migration, stream progress; secret-no-refill and final-frame error handling preserved.
- `data/cache/`: `database.ts` (Row types, LemmaDb, version blocks, open/get/close) + `records.ts` (conversions, cursor, queries, LWW, roster cleanup, cascades); `cache.test.ts` keeps its behavioral scope.

## Test Strategy: Preserve First, Audit After

Existing tests migrate alongside their implementation throughout Phases 1–4 with only import and `vi.mock` path updates; they are the executable proof that behavior is preserved.
After Phase 4, run one audit pass: delete cases that pin structure or incidental implementation rather than behavior, and add coverage for the newly extracted pure-logic boundaries (`useModelSelection`, `useStorageSettings`, `sections` already covered).
New UI components (`MessageList`, `ConversationList`, `ProvidersPanel`) get no unit tests per the repo convention that web unit tests cover pure-logic modules only.
Coverage gates are never lowered during any phase.

## Phase 5: Verification

- `just proto-gen`, `just web-lint`, `just web-test`, `just web-build` all green.
- Resolve the open question from the review: vite config declares a 90% coverage threshold while the repo rule states an 85% CI gate; confirm the effective entry point and never lower either.
- Config sweep: `components.json` hooks alias (top-level `hooks/` disappears), ESLint `components/ui` + `lib/utils` overrides, `.prettierignore`, coverage excludes, `cssConfigPath`.
- Real browser rendering matrix: guard/login, first-send conversation creation, streaming + abort + regenerate, conversation rename/archive/restore/delete navigation, all three settings sections, logout/account switch, sidebar collapse, deep-link refresh on `/conversations/:id` and `/settings/:section`.
- Console-clean is not acceptance; rendered content is.

## Behavior Preservation Invariants

Every phase must hold: current URLs; localStorage keys; IndexedDB name/version/indexes; RPC request order and update timing (post-RPC, not optimistic); resume offsets in Unicode code points; no resume without a prior `started`; active abort never restarted by reconnect; streaming content never overwritten by cache sync; cursor semantics and LWW rules; per-user database isolation; secret fields never refilled with masked values; in-band stream errors (final-frame `error`) still surfaced; the agent store's streaming state machine stays one continuous implementation.

## Commit Strategy

One atomic commit per phase (Phase 1 may split into data-layer and feature-layer commits), each independently buildable with green tests.
Behavior fixes discovered mid-flight are logged and committed separately, never folded into a move commit.
No commit without explicit user authorization.

## Explicit Non-Goals

Desktop package, Electron host code, `platform/desktop.ts` / `styles/desktop.css` extractions, Desktop acceptance, brand/icon wiring, KMP client, refresh-token race fix (#64), font payload reduction (#27), transition animations (#41), and any performance or error-handling redesign.
