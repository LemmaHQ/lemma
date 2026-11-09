# Dead-code pass

Remove code nothing reaches. The tools traverse from entry points rather than counting references, so a helper whose only caller is itself dead is reported too, and each deletion can expose the next.

## Detect

- **TypeScript** (web, packages, scripts, design): `just deadcode-check`. knip reads the entries in `knip.json` and each workspace's configuration. Do not use `jscpd --dead-code` here: it misses the script entries and reports their files as unused.
- **Rust**: with the user's consent to compile,

    ```sh
    cargo check --workspace --message-format=json | npx --no-install jscpd --dead-code --rust-diagnostics - --reporters ai --no-tips
    ```

    `pub` items another crate could use carry no compiler warning; trace those by hand with `xd://lsp` references or a search across `crates/`.
- **Kotlin**: no tool; search by hand or leave `mobile/` out and say so.

## Categories

| Finding | Usual fix |
| --- | --- |
| Unused file | Delete the file |
| Unused export | Delete it, or drop the `export` / `pub` when the same file still uses it |
| Unused symbol | Delete it |
| Unused import | Delete the import |
| Unused dependency | Remove it from the manifest and regenerate the lockfile |

## Workflow

1. Confirm each finding by hand before deleting: search the symbol across the whole repository, including `justfile`, `.github/workflows/`, `scripts/`, proto files, string-based lookups, and generated bindings. A Rust item may be reached through UniFFI from `mobile/`; a TypeScript export may be reached from `index.html`.
2. A finding that is a declared capability with no consumer, such as an RPC field or a configuration key, is a behavior decision; hand it to [lemma-find-simplifications](../../lemma-find-simplifications/SKILL.md) instead of deleting it here.
3. Delete in small batches and run the matching checks after each batch; a tool proves nothing reaches the code, not that its removal leaves every build step intact.
4. Re-run the tool after each batch and continue until a clean pass, since a file whose only importer you deleted is now dead too.

## Report

What was removed, and separately what was skipped and why: unresolved reachability, a consumer outside the tool's view, or a capability decision handed to the user.
