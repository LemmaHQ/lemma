import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./app/App.tsx";
import { installCrossTabGuard } from "./app/cross-tab-account.ts";
import "./i18n";
import "./index.css";

installCrossTabGuard();
const rootElement = document.querySelector("#root");
if (rootElement === null) {
    throw new Error("missing #root element");
}
createRoot(rootElement).render(
    <StrictMode>
        <App />
    </StrictMode>,
);
