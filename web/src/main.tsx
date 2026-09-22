import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./app/App.tsx";
import "./i18n";
import "./index.css";
import { isDesktop } from "./platform/environment.ts";
import { installCrossTabGuard } from "./app/cross-tab-account.ts";

// Inside the desktop shell the window is frameless, so reserve a draggable
// strip at the top. The preload bridge only exists there, never in browsers.
if (isDesktop()) {
    document.documentElement.classList.add("desktop");
    const titlebar = document.createElement("div");
    titlebar.className = "desktop-titlebar";
    titlebar.addEventListener("dblclick", () => {
        window.lemmaDesktop?.toggleMaximize();
    });
    document.body.appendChild(titlebar);
}

installCrossTabGuard();
createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <App />
    </StrictMode>,
);
