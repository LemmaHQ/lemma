# AGENTS.md — Protobuf 契约

[English](AGENTS.md) | 中文

这些规则是对仓库级[约定](../AGENTS.zh.md#约定)的补充。

- **契约位于 `lemma/v1/`**，package 为 `lemma.v1`。`buf lint` 与 `buf build` 在 `just check` 与 Spec CI 中运行。
- **这些文件有三个编译方。** Rust 在 `crates/shared/lemma-proto/build.rs` 中编译，该文件列出每个 `.proto` 文件；新增文件要加入这份列表。Web TypeScript（`web/src/gen/`）与 Android Kotlin（`mobile/shared/build/generated/source/bufgen/`）按 `buf.gen.yaml` 的配置由 `just proto-gen` 生成。
- **契约变更在同一次改动中更新所有使用方：** `crates/server/rpc/` 下的 RPC crate、Web 客户端与 Android 客户端。
- **`errors.proto` 中的 `ErrorReason` 是面向用户的业务错误的封闭集合。** 服务端通过 Connect 错误详情中的 `ErrorInfo` 附带它，客户端经由 i18n 渲染。基础设施故障使用 `internal` 错误码，不附带 reason。
- **生成代码不手工修改，也不提交。**

## 命令

```sh
just proto-lint         # buf lint
just proto-build        # buf build
just proto-gen          # 重新生成 web TypeScript 与 Android Kotlin 代码
```
