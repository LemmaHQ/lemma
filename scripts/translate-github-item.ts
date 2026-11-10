import fs from "node:fs";
import { inspect } from "node:util";
import { syncItem } from "./bilingual-sync.ts";
import { createTranslator } from "./chat-translator.ts";
import { itemsOfEvent, openItems, updateItem } from "./github-item.ts";
import type { Repository } from "./github-item.ts";

function env(name: string): string {
    const value = process.env[name];
    if (value === undefined || value === "") {
        console.error(`${name} is not set`);
        process.exit(2);
    }
    return value;
}

const repository: Repository = {
    apiUrl: env("GITHUB_API_URL"),
    name: env("GITHUB_REPOSITORY"),
    token: env("GITHUB_TOKEN"),
};
const items =
    env("GITHUB_EVENT_NAME") === "workflow_dispatch"
        ? await openItems(repository)
        : itemsOfEvent(
              JSON.parse(fs.readFileSync(env("GITHUB_EVENT_PATH"), "utf8")),
          );
if (items.length === 0) {
    console.log("nothing to translate");
    process.exit(0);
}

const translator = createTranslator({
    baseUrl: env("TRANSLATE_BASE_URL"),
    model: env("TRANSLATE_MODEL"),
    apiKey: env("TRANSLATE_API_KEY"),
});
const outcomes = await Promise.allSettled(
    items.map(async (item) => {
        const next = await syncItem(item, translator);
        if (next === undefined) {
            console.log(`${item.path} is up to date`);
        } else {
            await updateItem(repository, item, next);
            console.log(`${item.path} rewritten`);
        }
    }),
);
let failed = false;
for (const [index, outcome] of outcomes.entries()) {
    if (outcome.status === "rejected") {
        const { reason } = outcome as { reason: unknown };
        console.error(`${items[index]?.path}: ${inspect(reason)}`);
        failed = true;
    }
}
process.exit(failed ? 1 : 0);
