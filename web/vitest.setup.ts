import { cleanup } from "@testing-library/react";
import { afterEach, beforeAll } from "vitest";

import { i18n } from "./src/i18n";

Reflect.deleteProperty(Element.prototype, "animate");

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
