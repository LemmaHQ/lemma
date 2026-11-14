/** Returns true when a global keyboard shortcut should be ignored (already handled, IME composing, or focused inside an editable control). */
export function isShortcutIgnored(event: KeyboardEvent): boolean {
    if (event.defaultPrevented || event.isComposing) {
        return true;
    }
    const target = event.target;
    return (
        target instanceof Element &&
        target.closest(
            'input, textarea, select, [contenteditable]:not([contenteditable="false"])',
        ) !== null
    );
}
