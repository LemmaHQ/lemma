//! Runtime configuration from environment variables.

use std::env;
use std::error::Error;
use std::path::PathBuf;

/// Optional variables read after `main()` loads `.env`.
#[derive(Debug)]
pub struct Config {
    /// Data directory (`LEMMA_DATA_DIR`, defaults to `./data`).
    pub data_dir: PathBuf,
    /// Loopback port (`LEMMA_PORT`, defaults to `1025`).
    pub port: u16,
}

impl Config {
    /// Loads configuration from `LEMMA_DATA_DIR` and `LEMMA_PORT`.
    ///
    /// # Errors
    ///
    /// Non-Unicode environment values or an unparsable `LEMMA_PORT`.
    pub fn from_env() -> Result<Self, Box<dyn Error>> {
        let data_dir = match env::var("LEMMA_DATA_DIR") {
            Ok(raw) => PathBuf::from(raw),
            Err(env::VarError::NotPresent) => PathBuf::from("./data"),
            Err(e) => return Err(e.into()),
        };
        let port = match env::var("LEMMA_PORT") {
            Ok(raw) => raw.parse()?,
            Err(env::VarError::NotPresent) => 1025,
            Err(e) => return Err(e.into()),
        };
        Ok(Self { data_dir, port })
    }
}
