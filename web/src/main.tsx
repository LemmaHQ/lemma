import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { installCrossTabGuard } from "@/features/auth";
import { getPlatform } from "@/platform/platform";

import { installAccountDataReset } from "./app/account-data";
import { App } from "./app/App.tsx";
import "./i18n";
import "./index.css";

installCrossTabGuard();
installAccountDataReset();
const { titlebarHeight } = getPlatform();
document.documentElement.classList.toggle(
    "custom-titlebar",
    titlebarHeight > 0,
);
document.documentElement.style.setProperty(
    "--titlebar-height",
    `${titlebarHeight}px`,
);
const rootElement = document.querySelector("#root");
if (rootElement === null) {
    throw new Error("missing #root element");
}
createRoot(rootElement).render(
    <StrictMode>
        <App />
    </StrictMode>,
);
