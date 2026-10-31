# React effect refactoring patterns

Use the smallest pattern that makes ownership and lifecycle explicit. The examples follow the [web TypeScript rules](../../../../web/AGENTS.md#typescript) and are trimmed from the files they name.

## Load server data through the feature store

The feature store owns the data and its `loaded` flag; the feature's data hook starts the first load. From `web/src/features/providers/store.ts` and `useProviders.ts`:

```ts
export const useProvidersStore = create<ProvidersState>()((set) => ({
    list: [],
    loaded: false,

    refresh: async () => {
        const res = await providerClient.listProviders({});
        set({ list: res.providers, loaded: true });
    },
}));

export function useProviders() {
    const store = useProvidersStore();
    const loaded = useProvidersStore((s) => s.loaded);
    const refresh = useProvidersStore((s) => s.refresh);
    useEffect(() => {
        if (!loaded) {
            void refresh();
        }
    }, [loaded, refresh]);
    return store;
}
```

This is the feature's one mount-time load: it synchronizes with the server, runs again only while `loaded` is false, and every component reading the hook shares the result. A component that fetches on its own duplicates that lifecycle in local state:

```tsx
// Avoid: from VersionTags.tsx
const [serverVersion, setServerVersion] = useState<string | null>(null);
useEffect(() => {
    let active = true;
    const load = async () => {
        const version = await loadServerVersion();
        if (active) {
            setServerVersion(version);
        }
    };
    void load();
    return () => {
        active = false;
    };
}, []);
```

Move the value into the feature store with a `loaded` flag and read it through the feature's data hook.

## Mount after the data is ready, then seed the child

A stateful form never mounts with missing defaults to be repaired after paint. The parent waits for `loaded`, then mounts the child with complete initial values. From `ProvidersPanel.tsx` and `ProviderDetail.tsx`:

```tsx
function ProvidersPanel() {
    const { t } = useTranslation();
    const store = useProviders();
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const effectiveSelectedId =
        selectedId ?? (store.loaded ? (store.list[0]?.id ?? null) : null);
    const selected =
        store.list.find((p) => p.id === effectiveSelectedId) ?? null;

    if (selected === null) {
        return store.loaded && <p>{t("providers.emptyList")}</p>;
    }
    return <ProviderDetail key={selected.id} provider={selected} />;
}

function ProviderDetail({ provider }: { provider: Provider }) {
    const saved: ConnectionValues = {
        apiKey: provider.apiKey,
        baseUrl: provider.baseUrl,
        apiPath: provider.apiPath,
    };
    const [values, setValues] = useState(saved);
    const patch = connectionPatch(values, saved);
    const dirty = Object.keys(patch).length > 0;
}
```

While `loaded` is false, `ProviderListPane.tsx` renders `Skeleton` rows shaped like the final list. A skeleton plus a gated mount removes more complexity than a behavior-preserving refactor of a half-ready form; showing it where the page used to show such a form is an improvement.

The `key` states that switching to another provider discards the previous draft. Never put an update time or version in the key unless every refetch should discard edits; when the user must choose when to adopt fresh server values, offer a reset action instead.

## Derive valid client state from server state

Store the user's intent and derive whether it is currently valid. In the example above, `selectedId` holds only what the user picked; `effectiveSelectedId` falls back to the first provider once the list loads, and `selected` is looked up during render. No effect rewrites the selection when the list changes, so a refetch or a deletion needs no repair step. When several components need the derived value, expose it through one selector or hook so no caller skips the validation.

## Compute redundant values during render

From `NewProviderForm.tsx`:

```tsx
// Avoid: useEffect(() => setTitle(name.trim() === "" ? identifier.trim() : name.trim()), [name, identifier]);
const title = name.trim() === "" ? identifier.trim() : name.trim();
```

Move a complicated transformation into a pure function in a logic module beside the store and test it in a `*.test.ts` file there.

## Memoize only for a measured cost or a stability requirement

`useCallback` is `useMemo` for a function, and both are optimizations until a measurement says otherwise. Needing them everywhere means a component re-renders too often because a state boundary is wrong; split the component or move the state down instead.

```tsx
// Avoid: from MessageList.tsx
const lastAssistantId = useMemo(
    () => items.findLast((m) => m.role === "assistant")?.id ?? null,
    [items],
);
// Instead: one linear scan per render needs no cache.
const lastAssistantId =
    items.findLast((m) => m.role === "assistant")?.id ?? null;
```

Stability is a correctness requirement when a changed identity changes behavior. In `SessionList.tsx`, the callback ref selects the input's text. React calls a callback ref again whenever its identity changes, so without `useCallback` any re-render while the input is open, such as a session list update, would select the text again and discard the user's cursor position:

```tsx
const focusRef = useCallback((el: HTMLInputElement | null) => {
    inputRef.current = el;
    el?.select();
}, []);
```

The same holds for a value in the dependency list of a retained effect: memoize it, or hoist it to module scope when it closes over nothing, so the effect does not rerun every render.

## Put user-triggered work in an event handler and a store action

Never encode "when this flag becomes true, save" as state plus an effect. Call the workflow from the event that caused it. From `ProvidersPanel.tsx`:

```tsx
const handleSaveNew = async (data: NewProviderData) => {
    const provider = await store.create({ ...data, models: [] });
    setSelectedId(provider.id);
    setCreating(false);
};
```

`store.create` calls the RPC and appends the result to `list`; the handler does the follow-up work after `await`. Work that must follow an RPC, such as a toast, navigation, or a new selection, stays in that handler instead of a "completed" flag another effect watches. Code outside React calls a store action through `getState()`:

```ts
export function refreshConversations(): Promise<void> {
    return useConversationsStore.getState().refresh();
}
```

## Reset state through identity or an explicit event

When local state belongs to one entity, choose one behavior:

- keep the draft while store data refreshes;
- remount a keyed child when the entity changes;
- reset from a deliberate save, cancel, or reset event;
- drop the local state and read the store value directly.

`ProviderDetail.tsx` combines the first three: the `key` remounts it per provider, a refetch leaves `values` untouched, and its save handler writes the trimmed values back after `onSave` resolves. Because `dirty` is computed from `values` and the provider in the store, no effect copies the provider into the draft. An effect that makes this choice implicitly overwrites user input on a background refetch.

## Keep only external-system synchronization

An effect fits when the component must connect to something React does not control. From `TitleBar.tsx`, which writes a root class and CSS variable and removes both on cleanup:

```tsx
useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("custom-titlebar", titlebarHeight > 0);
    root.style.setProperty("--titlebar-height", `${titlebarHeight}px`);
    return () => {
        root.classList.remove("custom-titlebar");
        root.style.removeProperty("--titlebar-height");
    };
}, [titlebarHeight]);
```

Other integrations that fit: the effect in `app/shell/TitleBar.tsx` sending the resolved theme and surface to the desktop title bar through `platform`, browser event listeners, observers, and timers. A subscription that produces a value React renders uses `useSyncExternalStore`, as `useIsMobile` in `packages/ui/src/hooks/use-mobile.ts` does with a media query. Keep setup and cleanup symmetric, and keep data derivation out of the integration effect.

## Prefer conditional mounting for integrations

When an integration should exist only after a precondition holds, make the precondition a component boundary instead of a guard inside an effect:

```tsx
function PlayerArea({ ready }: { ready: boolean }) {
    return (
        <>
            <PlayerShell ready={ready} />
            {ready ? <PlayerInstance /> : null}
        </>
    );
}
```

The integration component has one lifecycle: mount connects, unmount disconnects. A `key` gives it a fresh lifecycle when an entity ID changes.

## Sources

- [React: You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)
- [TkDodo: Deriving Client State from Server State](https://tkdodo.eu/blog/deriving-client-state-from-server-state)
