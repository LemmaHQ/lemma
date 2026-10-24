# AGENTS.md

[English](AGENTS.md) | 中文

Lemma 用同一套 Rust 核心为 Web、桌面与 Android 客户端运行 LLM agent。修改 `crates/` 之前先读 [docs/architecture.zh.md](docs/architecture.zh.md)；编写文档遵循 [docs/AGENTS.zh.md](docs/AGENTS.zh.md)。

## 仓库布局

```text
crates/       Rust workspace（crates/AGENTS.md）
  shared/     服务端、桌面引擎与 Android 共同链接的 crate
  rpc/        每个 proto service 对应一个 ConnectRPC 服务 crate，以及组装它们的 lemma-host
  server/     仅服务端使用的 crate：lemma-server 可执行文件、PostgreSQL 存储
  desktop/    lemma-desktop：桌面外壳用来运行引擎的 Node-API addon
  mobile/     lemma-mobile：面向 Android 的 UniFFI 门面
proto/        Protobuf 契约，package lemma.v1（proto/AGENTS.md）
web/          React Web 客户端，同时是桌面端的渲染层（web/AGENTS.md）
desktop/      Electron 外壳，在 utility process 中运行引擎（desktop/AGENTS.md）
packages/     @lemma 命名空间下的共享 npm 包（packages/AGENTS.md）
mobile/       Android 应用与 Kotlin Multiplatform 共享模块（mobile/AGENTS.md）
assets/       品牌素材
design/       三端颜色 token（tokens.json）及其生成器
.agents/      skill
docs/         文档（docs/AGENTS.md）
scripts/      文档检查：双语配对、翻译简报生成器、仓库引用
```

## 命令

```sh
just rust-dev            # 读取 .env 运行 lemma-server
just web-dev             # Vite 开发服务器
just desktop-dev         # 构建引擎 addon，再启动 Electron
just design-gen          # 重新生成 Web 主题、桌面端窗口颜色与 Android 色板
just docs-lint-check     # 对已跟踪的 Markdown 运行 markdownlint 与 autocorrect
just docs-pairing-check  # 检查双语配对；docs-pairing <file> 记录一对
just docs-refs-check     # 检查 Markdown 中引用的 recipe 名与仓库路径
just dup-check           # 报告复制粘贴的代码（jscpd，.jscpd.json）
```

Recipe 按 `<区域>-<动作>` 命名。`-check` recipe 只做检查；去掉后缀的同名 recipe 会应用修复。CI 步骤调用 recipe，不重复其中的命令，因此本地运行可以复现 CI 步骤。各子树的 `AGENTS.md` 列出各自的 recipe；`just --list` 列出全部。

## 密钥 / .env

`lemma-server` 读取根目录的 `.env`；变量见 [.env.example](.env.example)。绝不提交凭据。

## 约定

- **格式：** 缩进 4 个空格（YAML 与 `.proto` 用 2 个），行尾无空白，文件末尾恰好一个换行，UTF-8 编码。
- **用生成命令搭骨架。** 配置文件与项目骨架用对应工具的生成命令初始化（`cargo new`、`buf init`、`npm create`）。
- **依赖版本**用兼容更新范围，并写全该发布版本的每一段（写 `^44.8.0`，不写 `^44`；发布号本身是 `0.64` 就写 `0.64`）。npm 写出 `^`，Cargo 的裸版本号（`"1.53.1"`）就是同一种范围，Gradle 版本目录与 `mise.toml` 直接写版本号。Action 标签、容器镜像标签与 Android SDK 级别遵循发布方自己的写法。
- **命名：** 类型用 `PascalCase`；常量与环境变量用 `UPPER_SNAKE_CASE`；标识符使用自然、标准的语义词。crate 与概念目录用单数；装同类条目的容器目录用复数（`crates/`、`migrations/`）。
- **名称与类型自解释**，取代复述它们的注释。
- **交付代码默认零注释。** 设计与约束的解释留在会话、文档或 commit message 中；已知问题记到 GitHub issue，不用 `TODO`、`FIXME` 或类似标记。文档注释采用各子树 `AGENTS.md` 规定的紧凑形式。
- **交付前清理调试语句**（`console.log`、`debugger`、`println!`、`dbg!`）。
- **彻底删除废弃与临时代码；** 历史由 Git 保留。
- **只为明确的业务场景编写逻辑。** 新增防御性逻辑（上限、兜底分支、额外校验、降级路径）之前，先向用户说明场景与理由，由用户决定。
- **spec、文档与注释准确界定功能与边界。** 默认正向表述；划定边界、列举排除项与评审清单时可以使用否定表述。
- **代码风格：** [lemma-code-style](.agents/skills/lemma-code-style/SKILL.md) 收录这些规则背后的上游指南。

## Git

- 提交信息遵循 [lemma-commit](.agents/skills/lemma-commit/SKILL.md)，使用英语。
- 只在明确要求时提交与推送。
- 一笔提交只做一件完整的事；相互独立的 hunk 分成不同的提交。
- 用 `git add <file>` 逐个显式暂存文件。提交前核对磁盘上的实际改动，保留用户在此期间做的修改。

## 文档

文档随每次代码改动一起更新：受影响的 README 与文档注释一并修改。[docs/AGENTS.zh.md](docs/AGENTS.zh.md) 规定文档层级、写作规则与字数预算；[双语契约](docs/i18n/README.zh.md)规定中英文对照文件的维护方式。

## 编辑本文件

`AGENTS.md` 与 `AGENTS.zh.md` 是一组中英文对照文件；两者在同一次改动中一起更新。每条规则保持自足，并链接到它的归属文档。
