import type { TitleBarState } from "@lemma/desktop-contract";
import { app, BrowserWindow, nativeTheme, shell } from "electron";
import path from "node:path";
import { APP_ORIGIN, isAppUrl } from "./app-protocol";
import { appVersionArg } from "./app-version";
import { themeColors } from "./gen/theme-colors";
import { TITLEBAR_HEIGHT } from "./titlebar";

export const loadFatalPage = (window: BrowserWindow | null, detail: string) => {
    if (window === null) {
        return;
    }
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Lemma</title></head>
<body style="margin:0;font-family:system-ui;background:#151615;color:#e6e6e4">
<main style="display:flex;flex-direction:column;gap:12px;align-items:center;justify-content:center;height:100vh">
<h1 style="font-size:18px;margin:0">Cannot start the local engine</h1>
<p style="opacity:0.7;margin:0">${detail}</p>
</main></body></html>`;
    window
        .loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
        .catch((err: unknown) => {
            console.error("fatal page failed to load:", err);
        });
};

export const loadApp = (window: BrowserWindow | null) => {
    if (window === null) {
        return;
    }
    window.loadURL(`${APP_ORIGIN}/`).catch((err: unknown) => {
        console.error("app page failed to load:", err);
    });
};

export const titleBarOverlay = (state: TitleBarState) => ({
    color: themeColors[state.theme][state.surface],
    symbolColor: themeColors[state.theme].foreground,
    height: TITLEBAR_HEIGHT,
});

export const isTitleBarState = (value: unknown): value is TitleBarState =>
    typeof value === "object" &&
    value !== null &&
    "theme" in value &&
    (value.theme === "light" || value.theme === "dark") &&
    "surface" in value &&
    (value.surface === "sidebar" || value.surface === "background");

export const createWindow = () => {
    const initialState = initialTitleBarState();
    const window = new BrowserWindow({
        width: 1280,
        height: 800,
        backgroundColor: themeColors[initialState.theme].background,
        titleBarStyle: "hidden",
        titleBarOverlay: titleBarOverlay(initialState),
        webPreferences: {
            preload: path.join(__dirname, "preload.cjs"),
            additionalArguments: [appVersionArg(app.getVersion())],
        },
    });

    window.webContents.setWindowOpenHandler(({ url }) => {
        openExternalLink(url);
        return { action: "deny" };
    });
    window.webContents.on("will-navigate", (event, url) => {
        if (!isAppUrl(url)) {
            event.preventDefault();
            openExternalLink(url);
        }
    });

    window.webContents.on("before-input-event", (_event, input) => {
        if (input.type !== "keyDown") {
            return;
        }
        const devtoolsKey =
            input.key === "F12" ||
            ((input.control || input.meta) &&
                input.shift &&
                input.key.toLowerCase() === "i");
        if (devtoolsKey) {
            window.webContents.toggleDevTools();
        }
    });
    return window;
};

const initialTitleBarState = (): TitleBarState => ({
    theme: nativeTheme.shouldUseDarkColors ? "dark" : "light",
    surface: "background",
});

const openExternalLink = (url: string) => {
    if (new URL(url).protocol === "https:") {
        void shell.openExternal(url);
    }
};
