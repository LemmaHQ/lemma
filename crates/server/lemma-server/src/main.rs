//! The Lemma server binary: serves the Connect router from `lemma-host`
//! and the embedded web build.

use std::error::Error;

mod config;
mod server_mode;

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    dotenvy::dotenv().ok();
    server_mode::run().await
}
