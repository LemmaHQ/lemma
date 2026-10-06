import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./app/App.tsx";
import "./i18n";
import "./index.css";
import { installCrossTabGuard } from "./app/cross-tab-account.ts";

installCrossTabGuard();
createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <App />
    </StrictMode>,
);
