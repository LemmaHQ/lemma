import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { installCrossTabGuard } from "@/features/auth";

import { installAccountDataReset } from "./app/account-data";
import { App } from "./app/App.tsx";
import "./i18n";
import "./index.css";

installCrossTabGuard();
installAccountDataReset();
const rootElement = document.querySelector("#root");
if (rootElement === null) {
    throw new Error("missing #root element");
}
createRoot(rootElement).render(
    <StrictMode>
        <App />
    </StrictMode>,
);
