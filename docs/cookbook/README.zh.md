# Cookbook

[English](README.md) | 中文

针对反复出现的改动的分步操作指南。每篇 recipe 都是教程：一条从干净的代码检出到一个可运行、已验证的改动的有序路径。

## Recipe 格式

- 文件名遵循 `adding-a-<thing>.md`（或 `adding-an-<thing>.md`）。
- Recipe 以目标结果及其前置条件开头。
- 步骤带编号；每一步以验证步骤结尾，写明要运行的命令以及证明该步骤完成的结果。
- 设计理由存放在所属的 Agent Note 中，由 recipe 链接过去。
- 类型定义与语义存放在 [subsystems/](../subsystems/README.zh.md) 中；recipe 链接到它涉及的页面。

## Recipe 列表

| Recipe | 结果 |
|---|---|
| `adding-a-provider-adapter.md` | 通过 `lemma-adapter` 接入一个新的 LLM provider，并可在客户端中选择 |
| `adding-a-tool.md` | 在 `lemma-tools` 中注册一个新的 Agent 工具及其执行分级 |
| `adding-an-rpc-service.md` | 新增一个 `proto/lemma/v1` 服务，由 `lemma-server` 提供并由 Web 客户端调用 |
| `adding-a-migration.md` | 一次同时作用于 SQLite 与 PostgreSQL 两个后端的 schema 变更 |
