# List all recipes
default:
    @just --list

# Lint contracts
[group('proto')]
proto-lint:
    cd proto && buf lint

# Build contracts
[group('proto')]
proto-build:
    cd proto && buf build

# Generate contract code (web TS + KMP Kotlin)
[group('proto')]
proto-gen:
    npm run gen:proto
    cd proto && buf generate --template buf.gen.kmp.yaml

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

# Build for production
[group('web')]
web-build:
    cd web && npm run build

# Run the dev server
[group('web')]
web-dev:
    cd web && npm run dev

# Run tests
[group('web')]
web-test:
    cd web && npm test

# Coverage report
[group('web')]
web-cov:
    cd web && npm run test:cov

# Run eslint
[group('web')]
web-lint:
    cd web && npm run lint

# Format code
[group('web')]
web-fmt:
    cd web && npm run format

# Build the desktop-bundled variant
[group('web')]
web-build-desktop:
    cd web && npm run build:desktop

# Run the dev shell
[group('desktop')]
desktop-dev:
    cd desktop && npm run start

# Run eslint
[group('desktop')]
desktop-lint:
    cd desktop && npm run lint

# Format code
[group('desktop')]
desktop-fmt:
    cd desktop && npm run format

# Package the app
[group('desktop')]
desktop-package:
    just proto-gen
    just web-build-desktop
    cd desktop && npm run package

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
