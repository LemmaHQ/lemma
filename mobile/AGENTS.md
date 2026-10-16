# AGENTS.md — Android client

English | [中文](AGENTS.zh.md)

These rules supplement the repo-wide [conventions](../AGENTS.md#conventions).

## Kotlin

- **Statements omit semicolons.** A single-expression function uses `= expr` and omits the return type.
- **Braces follow K&R:** the opening brace ends the line.
- **Nullable values use `?.`, `?:`, and `let`.**
- **Properties use `camelCase`;** the one exception is a private backing property `_prop` paired with a public `prop`.
- **Package names are all lowercase with words concatenated;** each file has one `package` statement.
- **KDoc** is a compact contract on public APIs whose first sentence is a complete summary phrase; self-explanatory properties and methods omit it.

## Modules and generated code

- `:mobile:androidApp` is the Android application; `:mobile:shared` is the Kotlin Multiplatform module that holds the UI, the SQLDelight database, and both generated binding sets.
- Protobuf and Connect Kotlin code lands in `shared/build/generated/source/bufgen/` through `just proto-gen`.
- Gradle builds `crates/shared/lemma-mobile` and generates its UniFFI Kotlin bindings into `shared/build/generated/source/uniffi/` and its JNI libraries into `shared/src/androidMain/jniLibs/`; this needs `cargo-ndk` and an Android NDK. A public API change in `lemma-mobile` is a Kotlin API change.
- Gradle runs `design/gen-tokens.mjs` before compiling, which writes `LemmaPalette`, the static palette from [design/tokens.json](../design/tokens.json), into `shared/build/generated/source/tokens/`; this needs Node. `theme/Scheme.kt` maps the palette onto the app's color roles.
- Generated code is never edited or committed.

## Commands

```sh
just mobile-android-build   # assemble the debug APK
just mobile-android-test    # androidApp unit tests and shared host tests
```
