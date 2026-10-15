# Skills

[English](README.md) | 中文

Skill 是 Agent 按需加载的可复用工作流与专项决策标准：文档归属判断、文字审查、Agent Note 归档，以及各语言的代码风格。产品与运行时契约存放在文档或源码中；常驻规则存放在根 `AGENTS.md` 中。

## 目录布局与命名

- 每个 skill 是一个目录 `lemma-<topic>/`，其中包含一个 `SKILL.md`。`lemma-` 前缀把仓库内的 skill 与用户级、工具自带的 skill 区分开。
- `SKILL.md` 以 frontmatter 开头：`name` 与目录名相同，`description` 说明何时加载该 skill。
- 较长的原始资料（例如上游风格指南）放在 skill 目录下的 `references/` 中，按需阅读。
- 按[双语契约](../../docs/i18n/README.zh.md#范围与例外)，skill 只用英文。

## 计划中的 skill

文档可以在 skill 创建之前就引用它，写法是代码格式的路径，例如 `.agents/skills/lemma-doc/SKILL.md`。在仓库中搜索 `` `.agents/skills/ `` 即可列出所有计划中的 skill 及依赖它们的位置。创建某个 skill 时，在同一次改动中把这些引用全部改为链接（[仓库引用](../../docs/AGENTS.zh.md#仓库引用)）。
