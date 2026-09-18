# KMP Android 客户端骨架落地计划

## 目标

把 KMP 向导生成的模板（当前散在仓库根 `Lemma/` 目录）重组为仓库标准布局，跑通首次 Android 构建：

1. **Gradle 根下沉仓库根**：`gradlew`、`gradlew.bat`、`gradle/`、`settings.gradle.kts`、`build.gradle.kts`、`gradle.properties` 移到仓库根，全仓单 Gradle 构建。
2. **模块收进 `android/`**:`androidApp` → `android/app`,`shared` → `android/shared`;`settings.gradle.kts` include 改为 `:android:app` / `:android:shared`。
3. **JDK 来源单一化**：删除模板生成的 `gradle/gradle-daemon-jvm.properties`（钉死 Azul JDK 21，会绕过 mise 去 Foojay 另下载 JDK);`mise.toml` 追加 `java = "temurin-25"`,daemon 跟随激活的 mise Java。
4. **justfile 追加 `[android]` 任务组**:`android-build`(`assembleDebug`）等。
5. **`.gitignore` 合并**：模板条目录入根 `.gitignore`(`.gradle/`、`local.properties`、`**/build/` 等）。

## 非目标

- 不写任何业务代码，不接入 proto 生成（connect-kotlin 接入属后续阶段）。
- 不动 CI(android-ci 待本地构建稳定后另议）。
- 不动 web/ desktop/ crates/ 任何现有内容。

## 设计

移动后 KMP 相关结构：

```
lemma/                              仓库根 = Gradle 根
├── gradlew / gradlew.bat
├── settings.gradle.kts             include(":android:app", ":android:shared")
├── build.gradle.kts                插件 apply false
├── gradle.properties
├── gradle/
│   ├── wrapper/                    Gradle 9.5.1
│   └── libs.versions.toml          AGP 9.1.1 / Kotlin 2.4.20 / CMP 1.12.0
├── android/
│   ├── app/                        原 androidApp,applicationId = dev.lemmahq.lemma
│   └── shared/                     原 shared,androidMultiplatformLibrary
├── mise.toml                       + java = "temurin-25"
├── .gitignore                      + Gradle/Android 条目
└── justfile                        + [android] 任务组
```

删除清单：`Lemma/` 空壳、`Lemma/.idea/`、模板 `README.md`、`gradle-daemon-jvm.properties`;`local.properties` 不入 git，构建靠 `ANDROID_HOME`。

与 `docs/architecture/v0-tech-design.md` 的偏差：该文档写 `android/` 为「独立 Gradle 根」，属过时决策（同文档 crate 命名已与现实不符）；本计划采用仓库根单 Gradle 构建，同一改动内把该文档布局图与 crate 命名同步到现状。

## 步骤

1. 移动 wrapper 与 Gradle 根文件到仓库根，模块目录收进 `android/`。
2. 改 `settings.gradle.kts` include；清删四个模板残留。
3. 合并 `.gitignore`;`mise.toml` 加 java;justfile 加 `[android]` 组。
4. 确认 `ANDROID_HOME` 指向本机 SDK；`gradlew :android:app:assembleDebug` 构建验证。
5. 冒烟：`installDebug` 或至少 assembleDebug 产物存在且包名正确。

## 注意点

- 构建验证前需要本机 Android SDK 可用（`ANDROID_HOME` 或 `local.properties` 二选一，后者不入库）。
- 提交按逻辑块原子化，逐文件精确 add，不主动 commit（等明确授权）。
