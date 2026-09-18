# 2026-09-19 移动端 KMP (Android) 客户端实施计划

## 1. 目标与范围

基于仓库现有的 Android 骨架工程（`mobile/shared` 与 `mobile/androidApp`），遵循 `DESIGN.md` 与 `docs/plans/2026-09-17-kimi-design-extraction.md` 中的 Kimi 3.1.0 视觉真值规范，分阶段搭建完整的 Lemma 移动客户端。

### 首期目标（Milestone 1: 视觉基础与 Design System）
- 将 `DESIGN.md` 中定义的色彩体系（KMBlue、透明度文本 Labels、背景层级、Fills）完整映射至 Compose Multiplatform 主题系统；
- 搭建排版比例系统（Typography）与形状系统（Shapes）；
- 封装高频原子组件：气泡容器、按钮、卡片容器、输入底栏；
- 在 Android 真机上跑通静态 Showcase 预览，支持浅色/深色主题无缝切换。

### 后续规划（Milestone 2 - 4）
- **Milestone 2（通信契约）**：基于 Connect-Kotlin 与 `proto/` 契约构建强类型网络层与认证拦截；
- **Milestone 3（存储与状态）**：SQLDelight 本地会话缓存、设置持久化与导航状态管理；
- **Milestone 4（核心屏幕）**：连接服务器引导页、登录页、主会话流（流式打字效果与自适应输入框）。

---

## 2. 首期工程结构规划 (`mobile/shared`)

在 `mobile/shared/src/commonMain/kotlin/dev/lemmahq/lemma/` 下组织：

```
mobile/shared/src/commonMain/kotlin/dev/lemmahq/lemma/
├── theme/
│   ├── Color.kt             # 基础调色板 (KMBlue, Red, Green, Labels 梯度, Fills 梯度)
│   ├── Scheme.kt            # LemmaColorScheme 接口及 Light/Dark 配色实例
│   ├── Typography.kt        # 字体排版系统
│   ├── Shape.kt             # 圆角规范 (Bubble 16dp, Input 24dp, Card 12dp)
│   └── Theme.kt             # LemmaTheme 包装与 CompositionLocal 提供器
├── ui/
│   ├── components/
│   │   ├── LemmaButton.kt   # 统一交互按钮 (Primary, Secondary, Ghost)
│   │   ├── LemmaBubble.kt   # 消息气泡卡片 (用户蓝底白字, AI 气泡灰底)
│   │   ├── LemmaCard.kt     # 分组列表卡片容器
│   │   └── LemmaInput.kt    # 胶囊式自适应聊天输入底栏
│   └── showcase/
│       └── DesignShowcase.kt# 用于真机与预览的 Token 及组件效果陈列页
└── App.kt                   # 接入 LemmaTheme 并展示 Showcase
```

---

## 3. 设计 Token 映射规则 (对齐 DESIGN.md / Kimi 提取)

### 3.1 色彩系统
- **品牌色**：
  - Light: `Color(0xFF1783FF)`
  - Dark: `Color(0xFF1A88FF)`
- **文字透明度层级 (核心手法)**：
  - `Labels-Primary`: Light `Color(0xE6000000)` / Dark `Color(0xD6FFFFFF)`
  - `Labels-Secondary`: Light `Color(0x99000000)` / Dark `Color(0x8FFFFFFF)`
  - `Labels-Tertiary`: Light `Color(0x73000000)` / Dark `Color(0x6BFFFFFF)`
  - `Labels-Quaternary`: Light `Color(0x45000000)` / Dark `Color(0x47FFFFFF)`
- **背景层级**：
  - `Bg-Primary`: Light `Color(0xFFFFFFFF)` / Dark `Color(0xFF121212)`
  - `Bg-Secondary`: Light `Color(0xFFF5F5F5)` / Dark `Color(0xFF1F1F1F)`
  - `Bg-Group`: Light `Color(0xFFFFFFFF)` / Dark `Color(0xFF1F1F1F)`
- **气泡底色**：
  - AI 气泡: Light `Color(0xFFF5F5F5)` / Dark `Color(0xFF292929)`
  - 用户气泡: `KMBlue` (文字采用纯白 `Color(0xFFFFFFFF)`)

---

## 4. 实施步骤与验收清单

| 步骤 | 操作内容 | 验证与验收方式 |
|---|---|---|
| **Step 1** | 创建 `theme/` 目录并实现 Color, Scheme, Typography, Shape, Theme | `./gradlew :mobile:shared:compileKotlinJvm` 编译通过 |
| **Step 2** | 实现核心原子组件 (`LemmaButton`, `LemmaBubble`, `LemmaInput`) | 单元组件逻辑无报错 |
| **Step 3** | 编写 `DesignShowcase` 界面并在 `App.kt` 中挂载展示 | `./gradlew :mobile:androidApp:assembleDebug` 打包成功 |
| **Step 4** | 真机 / 模拟器渲染核验 | 检查浅色与深色模式下对比度、圆角及组件观感 |

---

## 5. 约束与原则 (严格遵循 AGENTS.md)

1. **4 空格缩进**，代码中严格**零注释**；
2. **纯 Hex 颜色规范**，禁止使用 `oklch()` 等不兼容格式；
3. **分阶段推进**：首期仅交付 Design System 与静态 Showcase，不引入复杂未定型网络或数据库依赖，保证每次提交干净原子；
4. 未获用户显式许可前，不执行任何 git commit。
