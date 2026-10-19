md_files := "git ls-files '*.md' ':!:.agents/skills/lemma-code-style/references/'"

# List all recipes
default:
    @just --list

# Lint contracts
[group('proto')]
[working-directory('proto')]
proto-lint-check:
    buf lint

# Check contract formatting
[group('proto')]
[working-directory('proto')]
proto-fmt-check:
    buf format --diff --exit-code

# Format contracts
[group('proto')]
[working-directory('proto')]
proto-fmt:
    buf format --write

# Build contracts
[group('proto')]
[working-directory('proto')]
proto-build:
    buf build

# Run clippy with warnings denied
[group('rust')]
rust-lint-check:
    cargo clippy --workspace --all-targets -- -D warnings

# Apply clippy fixes
[group('rust')]
rust-lint:
    cargo clippy --workspace --all-targets --fix --allow-dirty --allow-staged

# Check formatting
[group('rust')]
rust-fmt-check:
    cargo fmt --all --check

# Format code
[group('rust')]
rust-fmt:
    cargo fmt --all

# Build the workspace
[group('rust')]
rust-build:
    cargo build --workspace

# Run the dev server
[group('rust')]
rust-dev:
    cargo run

# Run tests with nextest
[group('rust')]
rust-test:
    cargo nextest run --workspace

# Coverage under nextest; args replace the terminal summary
[group('rust')]
rust-cov *args="--summary-only":
    cargo llvm-cov nextest --workspace --exclude lemma-server --exclude lemma-core --exclude lemma-proto {{args}}

# Run oxlint
[group('web')]
[working-directory('web')]
web-lint-check:
    npm run lint

# Apply oxlint fixes
[group('web')]
[working-directory('web')]
web-lint:
    npm run lint -- --fix

# Check formatting
[group('web')]
[working-directory('web')]
web-fmt-check:
    npm run format:check

# Format code
[group('web')]
[working-directory('web')]
web-fmt:
    npm run format

# Build for production
[group('web')]
[working-directory('web')]
web-build:
    npm run build

# Run the dev server
[group('web')]
[working-directory('web')]
web-dev:
    npm run dev

# Run tests
[group('web')]
[working-directory('web')]
web-test:
    npm test

# Coverage report; args go to vitest
[group('web')]
[working-directory('web')]
web-cov *args:
    npm run test:cov -- {{args}}

# Run oxlint
[group('desktop')]
[working-directory('desktop')]
desktop-lint-check:
    npm run lint

# Apply oxlint fixes
[group('desktop')]
[working-directory('desktop')]
desktop-lint:
    npm run lint -- --fix

# Check formatting
[group('desktop')]
[working-directory('desktop')]
desktop-fmt-check:
    npm run format:check

# Format code
[group('desktop')]
[working-directory('desktop')]
desktop-fmt:
    npm run format

# Build desktop web assets
[group('desktop')]
[working-directory('desktop')]
desktop-build:
    npm run build

# Run the dev shell
[group('desktop')]
desktop-dev:
    cargo build -p lemma-server
    npm --workspace=desktop run start

# Run tests
[group('desktop')]
[working-directory('desktop')]
desktop-test:
    npm test

# Coverage report; args go to vitest
[group('desktop')]
[working-directory('desktop')]
desktop-cov *args:
    npm run test:cov -- {{args}}

# Package the app
[group('desktop')]
[working-directory('desktop')]
desktop-package:
    just desktop-build
    npm run package

# Run Android Lint on androidApp
[group('mobile')]
mobile-android-lint-check:
    ./gradlew :mobile:androidApp:lint

# Apply Android Lint fixes
[group('mobile')]
mobile-android-lint:
    ./gradlew :mobile:androidApp:lintFix

# Check Kotlin formatting
[group('mobile')]
mobile-fmt-check:
    ./gradlew spotlessCheck

# Format Kotlin code
[group('mobile')]
mobile-fmt:
    ./gradlew spotlessApply

# Assemble debug APK
[group('mobile')]
mobile-android-build:
    ./gradlew :mobile:androidApp:assembleDebug

# Run androidApp unit tests and shared host tests (commonTest on the JVM)
[group('mobile')]
mobile-android-test *args:
    ./gradlew :mobile:androidApp:testDebugUnitTest :mobile:shared:testAndroidHostTest {{args}}

# Kover HTML and XML reports for androidApp and shared
[group('mobile')]
mobile-android-cov:
    ./gradlew :mobile:androidApp:koverHtmlReport :mobile:androidApp:koverXmlReport

# Generate the Android palette from design tokens
[group('design')]
design-gen:
    node design/gen-tokens.ts

# Lint Markdown (markdownlint + autocorrect)
[group('docs')]
docs-lint-check:
    npx --no-install markdownlint-cli2 $({{md_files}})
    npx --no-install autocorrect --lint $({{md_files}})

# Fix Markdown (autocorrect, then markdownlint)
[group('docs')]
docs-lint:
    npx --no-install autocorrect --fix $({{md_files}})
    npx --no-install markdownlint-cli2 --fix $({{md_files}})

# Check bilingual pairs against their records
[group('docs')]
docs-pairing-check *files:
    node scripts/verify-translation-pairing.ts {{files}}

# Record bilingual pairs; takes files or --all
[group('docs')]
docs-pairing *files:
    node scripts/verify-translation-pairing.ts --write {{files}}

# Print translation briefs for out-of-sync pairs
[group('docs')]
docs-brief *files:
    node scripts/gen-translation-brief.ts {{files}}

# Check recipe names and repository paths cited in Markdown
[group('docs')]
docs-refs-check:
    node scripts/verify-repo-references.ts

# Type-check the repository scripts in scripts/ and design/
[group('scripts')]
scripts-type-check:
    npx --no-install tsc -p .

# Lint the repository scripts in scripts/ and design/
[group('scripts')]
scripts-lint-check:
    npx --no-install oxlint scripts design

# Apply oxlint fixes to the repository scripts
[group('scripts')]
scripts-lint:
    npx --no-install oxlint --fix scripts design

# Report copy-pasted code
[group('dup')]
dup-check:
    npx --no-install jscpd
