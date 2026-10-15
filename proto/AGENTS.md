# AGENTS.md — Protobuf contracts

English | [中文](AGENTS.zh.md)

These rules supplement the repo-wide [conventions](../AGENTS.md#conventions).

- **Contracts live in `lemma/v1/`** under package `lemma.v1`. `buf lint` and `buf build` run in `just check` and in Spec CI.
- **Three consumers compile these files.** Rust compiles them in `crates/shared/lemma-proto/build.rs`, which lists every `.proto` file; a new file joins that list. Web TypeScript (`web/src/gen/`) and Android Kotlin (`mobile/shared/build/generated/source/bufgen/`) come from `just proto-gen` as configured in `buf.gen.yaml`.
- **A contract change updates every consumer in the same change:** the RPC crate under `crates/server/rpc/`, the web client, and the Android client.
- **`ErrorReason` in `errors.proto` is the closed set of user-facing business errors.** Servers attach it through `ErrorInfo` in Connect error details, and clients render it through i18n. Infrastructure failures use the `internal` code without a reason.
- **Generated code is never edited or committed.**

## Commands

```sh
just proto-lint         # buf lint
just proto-build        # buf build
just proto-gen          # regenerate web TypeScript and Android Kotlin
```
