# 2026-09-19 移动端 KMP (Android) 客户端实施计划

## 0. 当前状态总览（2026-09-19 更新）

```
[M1 视觉基础]     已完成  theme/ 全套 Token + 原子组件 + DesignShowcase
[M2 通信契约]     已完成  buf 远程插件双端合流 + Connect-Kotlin RPC 客户端
[M3 存储与状态]   部分完成 multiplatform-settings 已接入（ServerUrl/Token）；
                          SQLDelight 本地会话缓存未做
[M4 核心屏幕]     大部分完成 SetupScreen / AuthScreen / MainChatScreen
                          （会话抽屉、新建会话、流式打字机）已真机联调；
                          Markdown 渲染与断网兜底未做
```

真机调试链路已打通：校园网 AP 隔离场景用 `adb reverse tcp:1025 tcp:1025`，手机连 `http://127.0.0.1:1025` 经 USB 直达宿主机 Rust 服务端。

---

## 1. 目标与范围

基于 `mobile/shared` + `mobile/androidApp` 骨架，遵循 `DESIGN.md` 与 `docs/plans/2026-09-17-kimi-design-extraction.md` 的 Kimi 视觉真值，搭建完整 Lemma Android 客户端。
KMP 仅含 Android 目标（CMP 全端方案已废弃）。

---

## 2. 工程结构（已实现）

```
mobile/shared/src/commonMain/kotlin/dev/lemmahq/lemma/
├── theme/                  # Color / Scheme / Typography / Shape / Theme
├── data/                   # SettingsRepository（multiplatform-settings）
├── network/                # LemmaRpcClient（Connect-Kotlin + OkHttp）
├── ui/
│   ├── components/         # LemmaButton / LemmaBubble / LemmaCard / LemmaInput / LemmaTextField
│   ├── showcase/           # DesignShowcase
│   ├── setup/              # SetupScreen（服务器连接 + 连通性探测）
│   ├── auth/               # AuthScreen（登录/注册切换、Change server）
│   └── chat/               # MainChatScreen（抽屉会话列表 + 流式聊天）
└── App.kt                  # 三段式导航状态机（Setup → Auth → Chat）
```

Proto 生成物：`mobile/shared/build/generated/source/bufgen/`（buf 远程插件：protocolbuffers/java + protocolbuffers/kotlin + connectrpc/kotlin，全部 lite）。

---

## 3. 已沉淀的构建坑（接续必读）

1. **Java codegen 必须显式进 javac**：`com.android.kotlin.multiplatform.library` 插件默认不编译 Java。
   `mobile/shared/build.gradle.kts` 已有两处关键配置，删除即复现 `NoClassDefFoundError: LoginRequest`：
   - `kotlin { android { withJava() } }`
   - `androidComponents { onVariants { it.sources.java?.addStaticSourceDirectory("build/generated/source/bufgen") } }`
2. `protocolbuffers/kotlin` 不是独立插件，生成的 Kotlin DSL 依赖 java 插件产出的 `GeneratedMessageLite` 基类，两个插件缺一不可。
3. 该插件是**单变体架构**：没有 `assembleDebug`/`assembleRelease`，模块任务用 `:mobile:shared:assemble`；打 APK 用 `:mobile:androidApp:assembleDebug`。
4. **Apply Changes（小闪电）无法热加载新增类**：proto 契约变更后必须完整 Run 重装，或 `adb install -r mobile/androidApp/build/outputs/apk/debug/androidApp-debug.apk`。
5. 闪退排查：`adb logcat -d -s AndroidRuntime:E`，帧率/输入法系统日志全是噪声。

---

## 4. 下一步工作（按优先级）

| 步骤 | 内容 | 验收 |
| --- | --- | --- |
| **N1** | 真机回归：Setup → 登录/注册 → 发消息收流式回复全链路 | 无闪退，打字机逐字渲染 |
| **N2** | AI 气泡 Markdown 渲染（代码块、列表、粗体），选型 multiplatform-markdown-renderer 或自绘 | 常见 GFM 元素真机观感正常 |
| **N3** | 网络异常兜底：连接失败/流中断的错误提示与重试入口 | 断网发消息有可见错误而非卡死 |
| **N4** | Token 刷新：accessToken 过期时用 refreshToken 静默续期（拦截器） | 过期后操作不跳登录页 |
| **N5** | SQLDelight 会话/消息本地缓存，离线可看历史 | 杀进程重进会话列表秒开 |
| **N6** | 消息持久化同步：对齐 web 端 sync_seq 语义 | 多端消息一致 |

---

## 5. 设计 Token 映射规则（已定稿，勿改）

- 品牌色：Light `0xFF1783FF` / Dark `0xFF1A88FF`
- Labels 梯度：Primary `0xE6000000`/`0xD6FFFFFF`，Secondary `0x99`/`0x8F`，Tertiary `0x73`/`0x6B`，Quaternary `0x45`/`0x47`
- 背景：Primary `0xFFFFFFFF`/`0xFF121212`，Secondary `0xFFF5F5F5`/`0xFF1F1F1F`
- AI 气泡 `0xFFF5F5F5`/`0xFF292929`；用户气泡 Primary + 纯白文字
- 圆角：Bubble 16dp，Input 24dp，Card 12dp

---

## 6. 约束与原则（严格遵循 AGENTS.md）

1. 4 空格缩进，代码严格零注释；
2. 纯 Hex 颜色，禁止 `oklch()`；
3. 原子提交，未获用户显式许可不执行 git commit；
4. proto 契约变更后走完整 lint → 生成 → 构建，并完整重装 APK（见第 3 节坑 4）。
