# List all recipes
default:
    @just --list

# Lint contracts
[group('proto')]
[working-directory('proto')]
proto-lint:
    buf lint

# Build contracts
[group('proto')]
[working-directory('proto')]
proto-build:
    buf build

# Generate contract code (web TS + mobile Kotlin)
[group('proto')]
proto-gen:
    npm run gen:proto
# Run the dev server
[group('rust')]
rust-dev:
    cargo run

# Build the workspace
[group('rust')]
rust-build:
    cargo build --workspace

# Run clippy
[group('rust')]
rust-lint:
    cargo clippy --workspace --all-targets

# Run tests
[group('rust')]
rust-test:
    cargo test --workspace

# Format code
[group('rust')]
rust-fmt:
    cargo fmt --all

# Coverage summary in the terminal
[group('rust')]
rust-cov:
    cargo llvm-cov --workspace --exclude lemma-server --summary-only

# Coverage HTML report
[group('rust')]
rust-cov-html:
    cargo llvm-cov --workspace --exclude lemma-server --html --open

# Validate the feature catalog
[group('features')]
check-features:
    npm run check:features

# Generate design tokens (DESIGN.md -> tokens.css)
[group('web')]
web-gen-tokens:
    npm run gen:tokens

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

# Coverage report
[group('web')]
[working-directory('web')]
web-cov:
    npm run test:cov

# Run eslint
[group('web')]
[working-directory('web')]
web-lint:
    npm run lint

# Format code
[group('web')]
[working-directory('web')]
web-fmt:
    npm run format

# Build the desktop-bundled variant
[group('web')]
[working-directory('web')]
web-build-desktop:
    npm run build:desktop

# Run the dev shell
[group('desktop')]
[working-directory('desktop')]
desktop-dev:
    npm run start

# Run eslint
[group('desktop')]
[working-directory('desktop')]
desktop-lint:
    npm run lint

# Format code
[group('desktop')]
[working-directory('desktop')]
desktop-fmt:
    npm run format

# Package the app
[group('desktop')]
[working-directory('desktop')]
desktop-package:
    just proto-gen
    just web-build-desktop
    npm run package

# Build the image
[group('docker')]
docker-build:
    docker build -t lemma:latest .

# Start the full stack
[group('docker')]
docker-up:
    docker compose --profile full up -d

# Stop the full stack
[group('docker')]
docker-down:
    docker compose --profile full down

# Assemble debug APK
[group('mobile')]
mobile-android-build:
    ./gradlew :mobile:androidApp:assembleDebug

# Run unit tests
[group('mobile')]
mobile-android-test:
    ./gradlew :mobile:androidApp:testDebugUnitTest :mobile:shared:testAndroidHostTest

# Lint documentation formatting (markdownlint + autocorrect)
[group('docs')]
docs-lint:
    npm run lint:docs
