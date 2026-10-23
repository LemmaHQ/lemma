//! The Lemma server binary: wires the domain services into a Connect
//! router. Serves the embedded web build; with `LEMMA_LOCAL_MODE` set it
//! runs as the embedded desktop engine over loopback instead.

use std::env;
use std::error::Error;

mod app_state;
mod config;
mod http_server;
mod local_mode;
mod routes;
mod secrets;
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
