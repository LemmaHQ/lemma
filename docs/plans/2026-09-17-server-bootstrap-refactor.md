# Server Bootstrap 重构计划

追踪 issue: LemmaHQ/lemma#61

## 目标

重构 `crates/lemma-server/src/main.rs`（当前 87 行全内联：服务构建、硬编码路由前缀数组、无优雅停机），拆为三个关注点：

1. **AppState 封装**：配置、连接池、六个领域服务 Arc 的构建收敛到一处。
2. **模块化路由组装**（方案 B）：路由组装按模块拆分到 `routes.rs` + `routes/` 目录（同名 .rs 约定，不用 mod.rs），领域 crate 零改动。
3. **优雅停机**：SIGINT/SIGTERM 触发，停止接受新连接、排空在途请求、关闭连接池。

## 非目标

- 不改任何行为与 API：Connect RPC 路径、端口 1025、CORS 策略全部保持原样。
- 不改领域 crate：服务构造函数签名、依赖列表均不动（它们被测试直调 handler）。
- 不改 web.rs / config.rs。

## 设计

### state.rs

```rust
pub struct AppState {
    pub config: Config,
    pub pool: PgPool,
    pub auth: Arc<AuthService>,
    pub providers: Arc<ProviderService>,
    pub storage: Arc<StorageService>,
    pub conversations: Arc<ConversationService>,
    pub chat: Arc<ChatService>,
    pub sync: Arc<SyncService>,
}

impl AppState {
    pub async fn new(config: Config) -> Result<Self, Box<dyn Error>>;
}
```

`connect` + `migrate` + 服务构建从 main 移入 `AppState::new`。

### routes.rs + routes/

`routes.rs` 声明子模块并暴露汇总函数：

```rust
mod auth;
mod chat;
// …共六个

pub fn router(state: &AppState) -> Router {
    Router::new()
        .merge(auth::router(state.auth.clone()))
        // …
}
```

每个 `routes/<module>.rs` 暴露：

```rust
pub fn router(service: Arc<AuthService>) -> Router {
    let connect = connectrpc::Router::new()
        .add_service(service)
        .into_axum_service();
    Router::new().route_service("/lemma.v1.AuthService/{*path}", connect)
}
```

与现状的差异：现在是一个 connect Router 聚合六个服务、单一 axum service 被六个前缀共享；重构后每模块一个单服务 connect Router。**对外路径不变，行为等价。**

web fallback 与 CORS 属顶层关注点，留在 main.rs。

### 优雅停机

```rust
async fn shutdown_signal() {
    // ctrl_c，外加 #[cfg(unix)] 的 SIGTERM
}

axum::serve(listener, app)
    .with_graceful_shutdown(shutdown_signal())
    .await?;
state.pool.close().await;
```

Windows 开发机走 Ctrl+C 路径；SIGTERM 分支 cfg(unix)，供 Linux 容器/CI。

## 步骤

1. `state.rs` 抽取 AppState，main 改用它 → `cargo build` 验证。
2. `routes.rs` + `routes/` 六文件，替换硬编码前缀数组 → `cargo build` 验证。
3. main 接入优雅停机 → `cargo build` 验证。
4. `cargo fmt --all` + clippy + 全量测试绿。
5. 冒烟：启动 server，验证一个 Connect RPC 与 web 页面可达，Ctrl+C 观察优雅退出（连接排空、pool 关闭）。

## 注意点

- 监听地址 `0.0.0.0:1025` 不变。
- Connect RPC 路径不变，web/desktop 客户端零影响。
- 提交按逻辑块原子化，逐文件精确 add，不主动 commit（等明确授权）。
