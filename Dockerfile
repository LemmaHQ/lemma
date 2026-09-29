# Stage 1: frontend (proto generation + vite build).
ARG NODE_VERSION=26.10.0
FROM node:${NODE_VERSION}-bookworm-slim AS web-builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY web/package.json web/package.json
RUN npm ci
COPY mise.toml ./
RUN BUF_VERSION=$(sed -nE 's/^[ "]*(buf)[ "]*= *"([^"]+)".*/\2/p' mise.toml) \
    && npm install -g "@bufbuild/buf@$BUF_VERSION"
COPY proto ./proto
COPY web ./web
ENV PATH="/app/node_modules/.bin:$PATH"
RUN cd proto && buf generate
RUN cd web && npm run build

# Stage 2: Rust build.
FROM rust:1-bookworm AS builder
WORKDIR /app
COPY mise.toml ./
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl unzip \
    && rm -rf /var/lib/apt/lists/* \
    && PROTOC_VERSION=$(sed -nE 's/^[ "]*(protobuf)[ "]*= *"([^"]+)".*/\2/p' mise.toml) \
    && curl -fsSL "https://github.com/protocolbuffers/protobuf/releases/download/v${PROTOC_VERSION}/protoc-${PROTOC_VERSION}-linux-x86_64.zip" -o /tmp/protoc.zip \
    && unzip -q /tmp/protoc.zip -d /usr/local \
    && rm /tmp/protoc.zip
COPY Cargo.toml Cargo.lock ./
COPY crates ./crates
COPY proto ./proto
COPY --from=web-builder /app/web/dist ./web/dist
RUN --mount=type=cache,target=/app/target \
    --mount=type=cache,target=/usr/local/cargo/registry \
    cargo build --release -p lemma-server \
    && cp target/release/lemma-server /app/lemma-server

# Stage 3: runtime (single-binary image).
FROM debian:bookworm-slim AS runtime
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*
RUN useradd --system --create-home lemma
COPY --from=builder /app/lemma-server /usr/local/bin/lemma-server
USER lemma
EXPOSE 1025
ENTRYPOINT ["lemma-server"]
