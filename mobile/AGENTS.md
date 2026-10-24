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
- Gradle generates the Protobuf and Connect Kotlin code into `shared/build/generated/source/bufgen/` before compiling Kotlin, running `buf` with `protoc` and `protoc-gen-connect-kotlin` from Maven at the runtime libraries' versions; this needs `buf` and Java ([proto/AGENTS.md](../proto/AGENTS.md)).
- Gradle builds `crates/mobile/lemma-mobile` for the host and generates its UniFFI Kotlin bindings into `shared/build/generated/source/uniffi/` before compiling Kotlin. Packaging the APK also cross-compiles its JNI libraries into `shared/src/androidMain/jniLibs/`, which needs `cargo-ndk` and an Android NDK. A public API change in `lemma-mobile` is a Kotlin API change.
- Gradle runs `design/gen-tokens.ts` before compiling, which writes `LemmaPalette`, the static palette from [design/tokens.json](../design/tokens.json), into `shared/build/generated/source/tokens/`; this needs Node. `theme/Scheme.kt` maps the palette onto the app's color roles.
- A schema change in `LemmaDatabase.sq` adds the next `<N>.sqm` migration. Before editing, run `./gradlew :mobile:shared:generateCommonMainLemmaDatabaseSchema` to snapshot the current schema as `shared/src/commonMain/sqldelight/databases/<N>.db`, and commit the snapshot. `verifySqlDelightMigration` applies the migrations to each snapshot and fails when the result differs from `LemmaDatabase.sq`.
- Generated code is never edited or committed.

## Commands

```sh
just mobile-android-build       # assemble the debug APK
just mobile-android-test        # androidApp unit tests, shared host tests, and SQLDelight migration checks
just mobile-android-lint-check  # Android Lint on androidApp; mobile-android-lint applies fixes
just mobile-android-cov         # Kover HTML report for androidApp and shared
just mobile-fmt-check           # ktfmt in kotlinlang style through Spotless; mobile-fmt formats
```
