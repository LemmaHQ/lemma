import fs from "node:fs";
import path from "node:path";

import { MakerDeb } from "@electron-forge/maker-deb";
import { MakerRpm } from "@electron-forge/maker-rpm";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { MakerZIP } from "@electron-forge/maker-zip";
import { FusesPlugin } from "@electron-forge/plugin-fuses";
import { VitePlugin } from "@electron-forge/plugin-vite";
import type { ForgeConfig } from "@electron-forge/shared-types";
import { FuseV1Options, FuseVersion } from "@electron/fuses";

const engineBinaryPath = (): string => {
    const name =
        process.platform === "win32" ? "lemma-server.exe" : "lemma-server";
    const bin = path.join(__dirname, "bin", name);
    if (fs.existsSync(bin)) return bin;
    return path.join(__dirname, "..", "target", "release", name);
};

const config: ForgeConfig = {
    packagerConfig: {
        asar: true,
        extraResource: [engineBinaryPath()],
        // Mirrors plugin-vite's default ignore (which only keeps .vite) and
        // additionally keeps the bundled web build.
        ignore: (file) => {
            if (!file) return false;
            return !file.startsWith("/.vite") && !file.startsWith("/web-dist");
        },
    },
    rebuildConfig: {},
    makers: [
        new MakerSquirrel({}),
        new MakerZIP({}, ["darwin"]),
        new MakerRpm({}),
        new MakerDeb({}),
    ],
    plugins: [
        new VitePlugin({
            build: [
                {
                    entry: "src/main.ts",
                    config: "vite.main.config.mts",
                    target: "main",
                },
                {
                    entry: "src/preload.ts",
                    config: "vite.preload.config.mts",
                    target: "preload",
                },
            ],
            renderer: [],
        }),
        // Fuses are used to enable/disable various Electron functionality
        // at package time, before code signing the application
        new FusesPlugin({
            version: FuseVersion.V1,
            [FuseV1Options.RunAsNode]: false,
            [FuseV1Options.EnableCookieEncryption]: true,
            [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
            [FuseV1Options.EnableNodeCliInspectArguments]: false,
            [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
            [FuseV1Options.OnlyLoadAppFromAsar]: true,
        }),
    ],
};

export default config;
