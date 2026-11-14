import { useCallback, useRef, useSyncExternalStore } from "react";

export type StorageKey = `lemma.${string}`;

export interface StoredCodec<T> {
    parse: (raw: string | null) => T;
    serialize: (value: T) => string;
}

const listenersByKey = new Map<string, Set<() => void>>();
let detachWindowListener: (() => void) | null = null;

function notifyKey(key: string | null) {
    if (key === null) {
        for (const group of listenersByKey.values()) {
            for (const listener of group) {
                listener();
            }
        }
        return;
    }
    const group = listenersByKey.get(key);
    if (group !== undefined) {
        for (const listener of group) {
            listener();
        }
    }
}

function subscribeStorage(key: StorageKey, listener: () => void): () => void {
    const group = listenersByKey.get(key) ?? new Set<() => void>();
    listenersByKey.set(key, group);
    group.add(listener);

    if (detachWindowListener === null) {
        const onStorage = (event: StorageEvent) => {
            notifyKey(event.key);
        };
        window.addEventListener("storage", onStorage);
        detachWindowListener = () => {
            window.removeEventListener("storage", onStorage);
        };
    }

    return () => {
        group.delete(listener);
        if (group.size === 0) {
            listenersByKey.delete(key);
        }
        if (listenersByKey.size === 0 && detachWindowListener !== null) {
            detachWindowListener();
            detachWindowListener = null;
        }
    };
}

function readRawStorage(key: StorageKey): string | null {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}

/** Reads and writes a typed `localStorage` preference under `lemma.*`, notifying mounted subscribers. */
export function useStoredValue<T>(
    key: StorageKey,
    codec: StoredCodec<T>,
): readonly [T, (next: T) => void] {
    const cacheRef = useRef<{ raw: string | null; value: T } | null>(null);

    const value = useSyncExternalStore(
        (onStoreChange) => subscribeStorage(key, onStoreChange),
        () => {
            const raw = readRawStorage(key);
            const cached = cacheRef.current;
            if (cached !== null && cached.raw === raw) {
                return cached.value;
            }
            const parsed = codec.parse(raw);
            cacheRef.current = { raw, value: parsed };
            return parsed;
        },
    );

    const setValue = useCallback(
        (next: T) => {
            const serialized = codec.serialize(next);
            try {
                localStorage.setItem(key, serialized);
            } catch {}
            cacheRef.current = { raw: serialized, value: next };
            notifyKey(key);
        },
        [key, codec],
    );

    return [value, setValue] as const;
}
