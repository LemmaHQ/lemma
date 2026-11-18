//! The Lemma daemon binary: serves the Connect router from `lemma-engine`
//! and the embedded web build.

use std::error::Error;

mod config;
mod daemon;

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    dotenvy::dotenv().ok();
    daemon::run().await
}
