//! The Lemma server binary: serves the Connect router from `lemma-host`
//! and the embedded web build; with `LEMMA_LOCAL_MODE` set it runs as the
//! embedded desktop engine over loopback instead.

use std::env;
use std::error::Error;

mod config;
mod http_server;
mod local_mode;
mod server_mode;
mod web;

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    dotenvy::dotenv().ok();
    if env::var_os("LEMMA_LOCAL_MODE").is_some() {
        local_mode::run().await
    } else {
        server_mode::run().await
    }
}
