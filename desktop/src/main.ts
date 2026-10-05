import { app, BrowserWindow, ipcMain, Menu, nativeTheme } from "electron";
import started from "electron-squirrel-startup";
import path from "node:path";
import * as engine from "./engine";

if (started) {
    app.quit();
}

if (process.env.LEMMA_DEBUG_PORT) {
    app.commandLine.appendSwitch(
        "remote-debugging-port",
        process.env.LEMMA_DEBUG_PORT,
    );
}

let mainWindow: BrowserWindow | null = null;
let engineStopping = false;

const loadFatalPage = (detail: string) => {
    if (!mainWindow) {
        return;
    }
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Lemma</title></head>
<body style="margin:0;font-family:system-ui;background:#151615;color:#e6e6e4">
<main style="display:flex;flex-direction:column;gap:12px;align-items:center;justify-content:center;height:100vh">
<h1 style="font-size:18px;margin:0">Cannot start the local engine</h1>
<p style="opacity:0.7;margin:0">${detail}</p>
</main></body></html>`;
    mainWindow.loadURL(
        `data:text/html;charset=utf-8,${encodeURIComponent(html)}`,
    );
};

const loadApp = () => {
    if (!mainWindow) {
        return;
    }
    mainWindow.loadFile(path.join(__dirname, "../../web-dist/index.html"));
};

interface TitleBarState {
    theme: "light" | "dark";
    surface: "sidebar" | "background";
}

const TITLE_BAR_COLORS: Record<
    "light" | "dark",
    Record<"sidebar" | "background", { color: string; symbolColor: string }>
> = {
    light: {
        background: { color: "#ffffff", symbolColor: "#000000e6" },
        sidebar: { color: "#f5f5f5", symbolColor: "#000000e6" },
    },
    dark: {
        background: { color: "#121212", symbolColor: "#ffffffd6" },
        sidebar: { color: "#1f1f1f", symbolColor: "#ffffffd6" },
    },
};

const titleBarOverlay = (state: TitleBarState) => ({
    ...TITLE_BAR_COLORS[state.theme][state.surface],
    height: 40,
});

const initialTitleBarState = (): TitleBarState => ({
    theme: nativeTheme.shouldUseDarkColors ? "dark" : "light",
    surface: "background",
});
const createWindow = () => {
    const window = new BrowserWindow({
        width: 1280,
        height: 800,
        backgroundColor: "#151615",
        titleBarStyle: "hidden",
        titleBarOverlay: titleBarOverlay(initialTitleBarState()),
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
        },
    });
    mainWindow = window;
    window.on("closed", () => {
        mainWindow = null;
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
};

ipcMain.on("set-titlebar", (_event, state: TitleBarState) => {
    if (
        (state.theme !== "light" && state.theme !== "dark") ||
        (state.surface !== "sidebar" && state.surface !== "background")
    ) {
        console.error("titlebar state rejected:", state);
        return;
    }
    try {
        mainWindow?.setTitleBarOverlay(titleBarOverlay(state));
    } catch (err) {
        console.error("titlebar overlay rejected:", state, err);
    }
});

ipcMain.on("get-server-url-sync", (event) => {
    event.returnValue = engine.serverUrl() ?? "";
});
ipcMain.handle("get-skip-credentials", () => {
    const skip = engine.getSkipCredentials();
    const url = engine.serverUrl();
    return url && skip
        ? { serverUrl: url, username: skip.username, password: skip.password }
        : null;
});
ipcMain.on("toggle-maximize", () => {
    if (!mainWindow) {
        return;
    }
    if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
    } else {
        mainWindow.maximize();
    }
});

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on("second-instance", () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) {
                mainWindow.restore();
            }
            mainWindow.focus();
        }
    });

    app.on("ready", async () => {
        Menu.setApplicationMenu(null);
        try {
            await engine.start();
            createWindow();
            loadApp();
        } catch (err) {
            createWindow();
            loadFatalPage(err instanceof Error ? err.message : String(err));
        }
    });

    app.on("before-quit", (event) => {
        if (engineStopping) {
            return;
        }
        event.preventDefault();
        engineStopping = true;
        engine.stop().finally(() => app.quit());
    });

    app.on("window-all-closed", () => {
        if (process.platform !== "darwin") {
            app.quit();
        }
    });

    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
}
