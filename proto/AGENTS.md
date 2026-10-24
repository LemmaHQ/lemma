# AGENTS.md — Protobuf contracts

English | [中文](AGENTS.zh.md)

These rules supplement the repo-wide [conventions](../AGENTS.md#conventions).

- **Contracts live in `lemma/v1/`** under package `lemma.v1`. Spec CI runs `buf lint`, `buf format`, and `buf build` on them.
- **Three consumers compile these files.** Rust compiles them in `crates/shared/lemma-proto/build.rs`, which lists every `.proto` file; a new file joins that list. The web `gen:proto` script, which `dev`, `build`, `lint`, and `test` run first, generates web TypeScript into `web/src/gen/` through `buf.gen.yaml` with `protoc-gen-es` from `web/package.json`. Gradle generates Android Kotlin into `mobile/shared/build/generated/source/bufgen/` through `buf.gen.mobile.yaml`, with `protoc` and `protoc-gen-connect-kotlin` from Maven at the versions of the Protobuf and Connect runtime libraries in `gradle/libs.versions.toml`.
- **A contract change updates every consumer in the same change:** the RPC crate under `crates/rpc/`, the web client, and the Android client.
- **`ErrorReason` in `errors.proto` is the closed set of user-facing business errors.** Servers attach it through `ErrorInfo` in Connect error details, and clients render it through i18n. Infrastructure failures use the `internal` code without a reason.
- **Generated code is never edited or committed.**

## Commands

```sh
just proto-lint-check   # buf lint
just proto-fmt-check    # buf format --diff; proto-fmt rewrites the files
just proto-build        # buf build
```
