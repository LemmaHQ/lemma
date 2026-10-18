# AGENTS.md — Protobuf 契约

[English](AGENTS.md) | 中文

这些规则是对仓库级[约定](../AGENTS.zh.md#约定)的补充。

- **契约位于 `lemma/v1/`**，package 为 `lemma.v1`。Spec CI 对其运行 `buf lint`、`buf format` 与 `buf build`。
- **这些文件有三个编译方。** Rust 在 `crates/shared/lemma-proto/build.rs` 中编译，该文件列出每个 `.proto` 文件；新增文件要加入这份列表。Web 的 `gen:proto` 脚本按 `buf.gen.yaml`，用 `web/package.json` 中的 `protoc-gen-es` 把 Web TypeScript 生成到 `web/src/gen/`，`dev`、`build`、`lint` 与 `test` 会先运行它。Gradle 按 `buf.gen.mobile.yaml` 把 Android Kotlin 生成到 `mobile/shared/build/generated/source/bufgen/`，所用的 `protoc` 与 `protoc-gen-connect-kotlin` 来自 Maven，版本与 `gradle/libs.versions.toml` 中 Protobuf、Connect 运行时库相同。
- **契约变更在同一次改动中更新所有使用方：** `crates/server/rpc/` 下的 RPC crate、Web 客户端与 Android 客户端。
- **`errors.proto` 中的 `ErrorReason` 是面向用户的业务错误的封闭集合。** 服务端通过 Connect 错误详情中的 `ErrorInfo` 附带它，客户端经由 i18n 渲染。基础设施故障使用 `internal` 错误码，不附带 reason。
- **生成代码不手工修改，也不提交。**

## 命令

```sh
just proto-lint-check   # buf lint
just proto-fmt-check    # buf format --diff；proto-fmt 改写文件
just proto-build        # buf build
```
