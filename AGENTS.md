# AGENTS.md

## 个人编码习惯

- 缩进一律使用 4 个空格（不用 Tab）
- 配置文件与项目骨架优先用生成命令（如 `cargo new`、`buf init`、`npm create`），不手写
- 模块用同名 .rs 文件（`auth.rs` + `auth/` 目录），不用 `mod.rs`
- 命名单复数：crate 名与概念目录用单数；装同类条目的容器目录用复数（`crates/`、`migrations/`、`scenarios/`）。存量复数 crate 一并规范化

## 注释规范

细则基准在 `docs/style-guide/`，本节是沉淀后的本项目规则。

- 废弃与临时代码：直接通过 Git 历史追溯并从当前工作区删除，不保留注释行
- 业务设计与心智流：统一沉淀到设计文档或 Issue/PR，函数体内只保留清晰自解释的逻辑流
- 命名与类型约束：标识符与类型声明须完全自解释，替代同义反复的注释
- 文档与契约边界：
  - **Rust**：仅顶层公开模块 / Crate 入口使用紧凑 `//!` 说明定位；公共 API / Trait 允许紧凑文档注释 `///`；`unsafe` 块必须且仅限使用紧凑的 `// SAFETY: <前置条件证明>`
  - **TypeScript**：公开导出的公共接口允许紧凑 JSDoc（类型完全由 TS 类型系统表达，省略 JSDoc 类型注解）；多同类型实参调用允许内联参数名标记 `/* paramName= */`
  - **Kotlin**：公开 API 允许紧凑 KDoc（首句为完整摘要短语，自解释的属性与方法直接省略 KDoc）
  - **Shell**：脚本首行必须为 Shebang（`#!/usr/bin/env bash`）；对外提供的复用函数采用紧凑契约头（注明 Description、Globals、Arguments、Outputs、Returns）

## 代码风格与语言规范

### 通用规则

- 缩进一律使用 4 个空格（不用 Tab），行尾无尾随空白，文件末尾保留单换行，源码统一 UTF-8 编码
- 类型与接口（Class / Struct / Interface / Trait / Enum）使用 `PascalCase`；常量与环境变量使用 `UPPER_SNAKE_CASE`
- 禁止使用 `_` 作为标识符的前缀或后缀（除 Kotlin backing property）
- 交付代码必须清理所有临时调试语句（如 `console.log`、`debugger`、`println!`、`dbg!`、`echo`）

### Rust

- 优先表达式驱动，避免多余的临时变量与显式 `return`
- 守卫分支优先使用 `let-else`，复杂分支优先使用详尽 `match`
- `use` 导入语句按“标准库 / 外部依赖 / 本地 crate”分组排序，大括号内不留空格
- 模块文件严格遵循 `foo.rs` + `foo/` 目录组织，禁止 `mod.rs` 与 `#[path]` 别名
- 优先零拷贝与借用传递，避免为了绕过生命周期进行非必要的 `.clone()`

### TypeScript

- 变量声明优先 `const`，仅在重新赋值时使用 `let`，禁止 `var`；单条语句仅声明单变量
- 必须显式书写分号，不依赖 ASI 自动分号插入
- 条件判断严格使用全等 `===` 与 `!==`
- 控制流分支（`if`、`for`、`while` 等）一律使用大括号 `{}`，即使单行分支亦不省略
- 模块一律使用 ES Module 命名导出（Named Exports），类型导入导出显式使用 `import type` / `export type`，禁止 `export default`、`export let` 与 `namespace`
- 严格类型安全：未知输入使用 `unknown` 并收窄，禁止 `any` 与包装对象类型（如 `String`）；禁止 `@ts-ignore`

### Kotlin

- 语句末尾省略分号；单表达式函数使用 `= expr` 语法并省略返回类型注解
- 大括号遵循 K&R 风格（左括号置于行末）
- 充分运用空安全调用符（`?.`、`?:`、`let`），避免使用断言运算符 `!!`
- 属性除私有 backing property（`_prop` 配合公开 `prop`）外一律采用 `camelCase`，禁止任意下划线命名
- 包名一律全小写无下划线连续书写，单文件一条语句

### Shell

- 解释器固定为 Bash，脚本首行声明 `#!/usr/bin/env bash` 或 `#!/bin/bash`
- 变量展开必须包含大括号与双引号包裹：`"${var}"`；测试字符串判空使用 `-z "${var}"` 或 `-n "${var}"`
- 命令行参数与标志列表统一使用 Bash 数组 `declare -a FLAGS=(...)` 并以 `"${FLAGS[@]}"` 传参，避免字符串拼接分词
- 条件测试使用 `[[ ... ]]`，算术运算使用 `(( ... ))` 或 `$(( ... ))`
- 函数内部变量一律使用 `local` 声明；多函数脚本统一提供 `main "$@"` 作为入口；优先使用 Shell 原生 Builtin 代替外部进程

## Git 提交习惯

- Conventional Commits，提交信息用英语
- 按逻辑块整合提交，一个完整的功能/主题一个提交，避免细碎密集
- 提交必须原子化：一笔只做一件完整的事
- 禁止使用 `git add -A`：任何提交必须精确指定文件范围，逐文件 add
- 只在明确要求时才提交 / 推送，不主动 commit

## 开发流程

- spec 与文档一律正向描述：写清做什么、边界在哪；禁止用"不做 X / 推迟 X"式的反向清单划边界
- 禁止无依据的防御性编程：不为假想问题添加防护（如无理由的上限、兜底分支、额外校验、降级路径）；认为确有必要时必须先向用户说明场景与理由，由用户决策后方可加入

## CI 与质量门禁

## GitHub 与项目管理

## 协作约定

- 提交前必须 `git diff` 核验磁盘真实改动，尊重用户在验证空档中的主动删改；hunk 级原子化，禁止不同逻辑块混在一笔
- 交付代码默认零注释：逻辑设计与约束解释留在会话与文档，不落入代码及配置文件
