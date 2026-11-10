import { isRecord } from "../i18n/type-guards.ts";
import type { ItemText } from "./bilingual-sync.ts";

export interface Item extends ItemText {
    path: string;
}

export interface Repository {
    apiUrl: string;
    name: string;
    token: string;
}

const PAGE_SIZE = 100;

export function itemsOfEvent(event: unknown): Item[] {
    if (!isRecord(event)) return [];
    return event["comment"] === undefined
        ? itemsOfPost(event["issue"] ?? event["pull_request"])
        : itemsOfComment(event["comment"]);
}

export async function openItems(repository: Repository): Promise<Item[]> {
    const posts = await listAll(repository, "issues?state=open", 1);
    const comments = await Promise.all(
        posts
            .filter(isRecord)
            .filter((post) => typeof post["number"] === "number")
            .map((post) =>
                listAll(
                    repository,
                    `issues/${String(post["number"])}/comments?`,
                    1,
                ),
            ),
    );
    return [
        ...posts.flatMap(itemsOfPost),
        ...comments.flat().flatMap(itemsOfComment),
    ];
}

export async function updateItem(
    repository: Repository,
    item: Item,
    next: ItemText,
): Promise<void> {
    await request(repository, item.path, {
        method: "PATCH",
        body: JSON.stringify(next),
    });
}

function itemsOfPost(post: unknown): Item[] {
    if (!isRecord(post) || isByBot(post)) return [];
    const { number, title, body } = post;
    if (typeof number !== "number" || typeof title !== "string") {
        throw new TypeError("an issue or pull request has no number or title");
    }
    return [
        {
            path: `issues/${number}`,
            title,
            body: typeof body === "string" ? body : "",
        },
    ];
}

function itemsOfComment(comment: unknown): Item[] {
    if (!isRecord(comment) || isByBot(comment)) return [];
    const { id, body } = comment;
    if (typeof id !== "number" || typeof body !== "string") {
        throw new TypeError("a comment has no id or body");
    }
    return [{ path: `issues/comments/${id}`, body }];
}

function isByBot(content: Record<string, unknown>): boolean {
    const author = content["user"];
    return isRecord(author) && author["type"] === "Bot";
}

async function listAll(
    repository: Repository,
    path: string,
    page: number,
): Promise<unknown[]> {
    const response = await request(
        repository,
        `${path}&per_page=${PAGE_SIZE}&page=${page}`,
        {},
    );
    const reply: unknown = await response.json();
    if (!Array.isArray(reply)) {
        throw new TypeError(`${path} did not answer with a list`);
    }
    const entries: unknown[] = reply;
    return entries.length < PAGE_SIZE
        ? entries
        : [...entries, ...(await listAll(repository, path, page + 1))];
}

async function request(
    repository: Repository,
    path: string,
    init: RequestInit,
): Promise<Response> {
    const url = `${repository.apiUrl}/repos/${repository.name}/${path}`;
    const response = await fetch(url, {
        ...init,
        headers: {
            accept: "application/vnd.github+json",
            authorization: `Bearer ${repository.token}`,
            "x-github-api-version": "2022-11-28",
        },
    });
    if (!response.ok) {
        throw new Error(
            `${init.method ?? "GET"} ${url} answered ${response.status}: ${await response.text()}`,
        );
    }
    return response;
}
