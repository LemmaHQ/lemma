const APP_VERSION_ARG = "--lemma-app-version=";

/** Renderer command-line argument carrying the app version to the preload. */
export function appVersionArg(version: string): string {
    return `${APP_VERSION_ARG}${version}`;
}

/** The app version from the renderer's command line; empty when absent. */
export function readAppVersion(argv: readonly string[]): string {
    const arg = argv.find((value) => value.startsWith(APP_VERSION_ARG));
    return arg === undefined ? "" : arg.slice(APP_VERSION_ARG.length);
}
