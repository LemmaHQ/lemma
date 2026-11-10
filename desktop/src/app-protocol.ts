import { net, protocol } from "electron";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const APP_ORIGIN = "app://lemma";

const WEB_ROOT = path.join(__dirname, "../../web-dist");

export const registerAppScheme = () => {
    protocol.registerSchemesAsPrivileged([
        { scheme: "app", privileges: { standard: true, secure: true } },
    ]);
};

export const serveApp = () => {
    protocol.handle("app", serveWebFile);
};

export const serveWebFile = (request: Request): Promise<Response> => {
    const file = path.join(
        WEB_ROOT,
        decodeURIComponent(new URL(request.url).pathname),
    );
    if (path.relative(WEB_ROOT, file).startsWith("..")) {
        return Promise.resolve(new Response(null, { status: 404 }));
    }
    const target =
        path.extname(file) === "" ? path.join(WEB_ROOT, "index.html") : file;
    return net.fetch(pathToFileURL(target).href);
};

export const isAppUrl = (url: string) => {
    const target = new URL(url);
    return target.protocol === "app:" && target.host === "lemma";
};
