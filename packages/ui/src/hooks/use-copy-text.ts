import { useCallback, useEffect, useState } from "react";

const COPIED_MS = 1500;

/** Copies text to the clipboard; `copied` stays true for 1.5 s after a successful copy. */
export function useCopyText(): {
    copied: boolean;
    copy: (text: string) => void;
} {
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (!copied) {
            return;
        }
        const timer = window.setTimeout(() => setCopied(false), COPIED_MS);
        return () => window.clearTimeout(timer);
    }, [copied]);

    const copy = useCallback((text: string) => {
        void navigator.clipboard
            .writeText(text)
            .then(() => setCopied(true))
            .catch(() => {});
    }, []);

    return { copied, copy };
}
