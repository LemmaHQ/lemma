import { cleanup } from "@testing-library/react";
import { afterEach, beforeAll } from "vitest";

import { i18n } from "./src/i18n";

Object.defineProperty(document.documentElement, "animate", {
    value: Reflect.get(Element.prototype, "animate"),
});
Reflect.deleteProperty(Element.prototype, "animate");

Object.defineProperty(document, "fonts", {
    value: { status: "loaded", ready: Promise.resolve() },
});

document.startViewTransition = function startInstantViewTransition(
    callbackOptions,
) {
    const update =
        typeof callbackOptions === "function"
            ? callbackOptions
            : callbackOptions?.update;
    const updateCallbackDone = (async () => {
        await Promise.resolve();
        await update?.();
    })();
    return {
        updateCallbackDone,
        ready: updateCallbackDone,
        finished: updateCallbackDone,
        types: new Set(),
        skipTransition: () => {},
    };
};

beforeAll(async () => {
    await i18n.changeLanguage("en");
});

afterEach(cleanup);
