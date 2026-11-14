import { expect, it, vi } from "vitest";

import { isShortcutIgnored } from "./shortcut";

it("ignores prevented, IME-composing, and editable-element keyboard events", () => {
    const plain = new KeyboardEvent("keydown", { key: "k", ctrlKey: true });
    expect(isShortcutIgnored(plain)).toBe(false);

    const prevented = new KeyboardEvent("keydown", {
        key: "k",
        ctrlKey: true,
        cancelable: true,
    });
    prevented.preventDefault();
    expect(isShortcutIgnored(prevented)).toBe(true);

    const composing = new KeyboardEvent("keydown", {
        key: "k",
        ctrlKey: true,
        isComposing: true,
    });
    expect(isShortcutIgnored(composing)).toBe(true);

    const wrapper = document.createElement("div");
    const textarea = document.createElement("textarea");
    const button = document.createElement("button");
    wrapper.append(textarea, button);
    document.body.append(wrapper);

    const observed = vi.fn<(ignored: boolean) => void>();
    wrapper.addEventListener("keydown", (event) => {
        observed(isShortcutIgnored(event));
    });

    textarea.dispatchEvent(
        new KeyboardEvent("keydown", {
            key: "n",
            ctrlKey: true,
            bubbles: true,
        }),
    );
    expect(observed).toHaveBeenLastCalledWith(true);

    button.dispatchEvent(
        new KeyboardEvent("keydown", {
            key: "n",
            ctrlKey: true,
            bubbles: true,
        }),
    );
    expect(observed).toHaveBeenLastCalledWith(false);

    wrapper.remove();
});
