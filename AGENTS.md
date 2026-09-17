# AGENTS.md

## 个人编码习惯

- 缩进一律使用 4 个空格（不用 Tab）
- 配置文件与项目骨架优先用官方生成命令（如 `cargo new`、`buf init`、`npm create`），不手写
- 模块用同名 .rs 文件（`auth.rs` + `auth/` 目录），不用 `mod.rs`

## 注释规范

细则基准在 `docs/style-guide/`（Rust 官方 style guide + Google TS/Shell 指南），本节是沉淀后的本项目规则。

- 注释一律英文，简练，只在必要处添加：写非显然的约束、坑、设计理由；不复述代码、不画装饰横幅
- 完整句子：首字母大写、句末句号；纯注释行 ≤80 列；行注释优先于块注释，独占一行优先于尾随代码
- Rust：文档注释用 `///`，`//!` 只用于模块 / crate 级文档；doc comment 写在 attribute 之前
- TypeScript：`/** JSDoc */` 只写给调用者的文档，实现注释用 `//`（多行也用多个 `//`，不用 `/* */` 块）；JSDoc 不写类型注解；`@param` / `@return` 只在有增量信息时写
- TODO 统一 `TODO(标识): 描述` 格式
- 尽量不写注释：能用命名、类型、结构或断言表达的就不要注释；有专门"解释位"的格式（DESIGN.md 的 YAML 前置块 → 正文章节，proto → 字段注释，函数 → doc comment）把解释放到那个位置，不在数据里夹注释、不画分组横幅

## Git 提交习惯

- Conventional Commits，提交信息用英语
- 按逻辑块整合提交，一个完整的功能/主题一个提交，避免细碎密集
- 提交必须原子化：一笔只做一件完整的事，且任何一笔检出后都能正常编译、测试全绿（保证 bisect 与回滚不踩坑）
- 禁止使用 `git add -A`：任何提交必须精确指定文件范围，逐文件 add
- 只在明确要求时才提交 / 推送，不主动 commit

## 开发流程

- just 是统一任务入口；跑 `just --list` 查看所有可用任务
- proto 契约变更后，完整走一遍 lint、构建与代码生成（各有对应 just 任务），最后 `cargo build` 确认编译
- 新 proto 文件必须注册进 `crates/lemma-proto/build.rs` 的文件清单：TS 侧 buf 自动扫目录，Rust 侧是显式清单——漏注册四连验证照样全绿，到引用时才炸
- 提交前 `cargo fmt --all`；clippy 与测试必须全绿
- 覆盖率用 cargo-llvm-cov 测（just 已封装对应任务）；结果可疑时多半是陈旧计数，清缓存后重测
- 生成物不入 git（如 `web/src/gen` 已 ignore）；新环境先重新生成代码，再构建 web
- 工具链统一由 mise 管理：版本钉在仓库根 `mise.toml`（精确版本，禁止 latest），CI 经 `jdx/mise-action` 消费同一文件，禁止独立的 setup action；升级走定时 Action 自动提 PR 审阅
- mise 内 CLI 工具一律用 GitHub releases 后端，禁止 cargo 后端（cargo-llvm-cov 用 `aqua:taiki-e/cargo-llvm-cov`）
- Rust 编译器由 `rust-toolchain.toml` 锁定（channel stable），不进 mise
- protoc 以 `mise.toml` 的 protobuf 版本为单一事实源：本地与 CI 经 mise 供应，Dockerfile 用 sed 动态提取同一版本下载官方包；升级由 mise-upgrade 定时 PR 三方同步

## 代码约定

- `lemma-db` 只是存储内核（连接池、迁移、共享实体）；领域查询住在各领域 crate（users/tokens → lemma-auth，providers → lemma-providers，conversations → lemma-conversations，s3 配置 → lemma-archive）
- 入库凭证一律 lemma-crypto 密封、出库脱敏回显；前端密钥框不回填脱敏串（留空=保持）——回填值被保存会当成真密钥重新密封，密钥静默损坏
- S3 桶必须预先存在，测试连接只探测不建桶——自动建桶是刻意删掉的，别再加回
- conversations/messages 表的所有 UPDATE 必须显式 `sync_seq = nextval('sync_seq')`（列默认值只作用于 INSERT）
- 业务错误（非 internal 的 ConnectError）一律走 `lemma_proto::app_error`：错误码进 `errors.proto` 闭集、英文文案兜底，前端按码出 i18n；internal 运维错误保持英文原文、不带码也永不本地化
- 集成测试用 `#[sqlx::test]`（每测试独立临时库）；跨 crate 测试带 `migrations = "../lemma-db/migrations"`
- 测试直调 handler（ServiceRequest / RequestContext），不起 HTTP 服务
- sqlx 动态 SQL 必须 `sqlx::raw_sql(AssertSqlSafe(...))` 显式标记逃生门
- 异步 trait 统一 RPITIT + Send 范式（`fn f(..) -> impl Future<Output=T> + Send`）；实现侧优先 async fn
- proto 结构构造一律 `..Default::default()` 收尾；枚举断言直接比对变体（`assert_eq!(r.x.status, MessageStatus::X)`），禁止 `.into()`（双 PartialEq 歧义）
- 前端单测只覆盖纯逻辑模块（stores/lib），node 环境；Mock 隔离模块边界；涉及日期用 `vi.setSystemTime` 锁时间防午夜 flake
- aws-sdk-s3 必须 `default-features = false`（阻断遗留 rustls）；HeadBucket 判桶缺失用 `is_not_found()`；403 等异常经 `meta().code()` / `meta().message()` 提取
- 连接拓扑两套不可混用：容器内 S3 走 `http://rustfs:9000`、DB 走 `@lemma-database:5432`；宿主机一律 `127.0.0.1`

## 平台架构

- Desktop 用 Electron 封装 Web UI；Mobile 用 KMP + Compose Multiplatform 专供 Android；全端 CMP 方案已废弃，KMP 不含 iOS / web / desktop 目标
- Desktop 与 Android 各阶段同优先级平权推进，非桌面优先
- KMP 推荐 VS Code（kotlin-server + vscode-gradle + emulate），严禁装 redhat.java（项目模型识别冲突）
- Android 真机调试保持 adb 唯一定位：手连与 mDNS 并存导致 installDebug 卡死时，disconnect 仅留 mDNS 单一 transport

## CI 与质量门禁

- 覆盖率硬门禁在 CI 自身（Rust 85%、web 85%）；Codecov 只作回归哨兵（project threshold 1%、patch off）；仅 lemma-server 整 crate 豁免覆盖率
- CI 数据库镜像统一 `paradedb/paradedb:pg18`（pg_search 两端兼容）；`DATABASE_URL` 运行时注入
- CodeQL 用 advanced setup（workflows + codeql-config.yml），必须关闭 default setup 防上传冲突；dependabot PR 触发跳过是设计预期
- `buf-action` 的 setup 必须 `with: setup_only: true`（防根目录误构建）；RustEmbed 依赖前端产物，CI 必须由前序 job 经 artifact 传递
- CI 规范检查工具版本收进 `package.json` devDependencies，由 dependabot 接管更新，禁止在 workflow 里直接钉版本
- CI 无 S3 后端时 smoke 探针静默跳过；本地复现 CI 用 `LEMMA_TEST_S3_ENDPOINT=http://127.0.0.1:1`

## GitHub 与项目管理

- 仓库 `LemmaOS/lemma` 与项目板均为 public：issue、PR、提交信息一律按公开发布规范写
- 待办 / feature list 走 org project「Lemma Product 2026」：建 issue 挂进板，卡片用 Status 流转
- issue 内容只描述问题本身，不出现内部代号（C2、M3 这类），正文能省则省；关闭前把正文补成完整描述（方案 + 关联提交）
- 项目板只当 feature list 用，不做日期排期；Roadmap / Iteration 字段是刻意删的，别再加回；自定义字段仅保留 Size 与 Estimate
- 分支合并一律 merge commit，禁止 rebase；开启 delete_branch_on_merge；不对 main 开阻断性保护（Require PR / status checks / Lock branch）
- dependabot：cargo 与 npm 独立分组 minor+patch、major 单审、daily 调度；CI 验证通过且确认 changelog 后合入
- gh project 操作：`item-edit` 必须带 `--project-id`；字段设值用 `--single-select-option-id`；Status 选项映射 Backlog f75ad846 / Ready 08afe404 / In progress 47fc9ee4 / In review 4cc61d42 / Done 98236657；issue 标题在 project 里是滞后快照，重命名必须改 issue 实体；关闭 issue 自动流转 Done

## 协作约定

- 功能开发或复杂修复前先生成语义命名计划文件（`docs/plans/YYYY-MM-DD-<语义名>.md`），获批后方可动工
- 提交授权分步控制：用户未明确说「提交/可以提交」严禁 commit；单字「OK」仅视为改动认可，不含提交授权
- 提交前必须 `git diff` 核验磁盘真实改动，尊重用户在验证空档中的主动删改；hunk 级原子化，禁止不同逻辑块混在一笔
- 交付代码默认零注释：逻辑设计与约束解释留在会话与文档，不落入代码及配置文件
- UI 改动必须基于真实渲染结果验收，严禁依据空白窗口、控制台无报错或 CSP 警告推断渲染成功
- 设计 token 一律 hex 格式，禁止 oklch() 等广色域格式；用户提供感性观感描述时，Agent 负责映射到 DESIGN.md 具体 token 并显式列出焦点环、边框等联动项待确认

## 已知环境问题

- 数据库连接串用 `127.0.0.1`，不用 `localhost`：localhost 同时解析出 ::1（常被先试），本机 ::1 被防火墙黑洞——实测 Docker 已监听 `[::]:5432` 仍连接超时
- Windows 防火墙会静默丢弃未监听本机端口的连接，失败分支要等满 30s 超时；网络异常分支的诊断结论以 Linux CI 为准
- Git Bash 的 `/tmp` 对 Windows 原生进程不可见：跨工具传临时文件必须落在仓库或用户实际目录
- 删除目录前先 cd 回仓库根：cwd 锁定会让 Windows 产生幽灵目录并错位写入
- npm workspaces 依赖解析漂移时：手动删 `package-lock.json` 过期条目并清物理 `node_modules` 后重装
- mise install 转后台可能进程树冻结（管道背压 + shim 抢安装锁）：前台运行或分批装
- Windows shell 里 curl 的 `-w "%{http_code}"` 要写成 `%%{http_code}%%` 转义
- RustFS create-bucket 成功响应不含 body，验证以 `s3api list-buckets` 实际状态为准
