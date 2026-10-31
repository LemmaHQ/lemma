import { cleanup } from "@testing-library/react";
import { afterEach, beforeAll } from "vitest";

import { i18n } from "./src/i18n";

Reflect.deleteProperty(Element.prototype, "animate");

beforeAll(async () => {
    await i18n.changeLanguage("en");
});

afterEach(cleanup);
