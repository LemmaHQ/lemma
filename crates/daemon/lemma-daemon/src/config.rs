use std::env;
use std::error::Error;
use std::path::PathBuf;

#[derive(Debug)]
pub(crate) struct Config {
    pub(crate) data_dir: PathBuf,
    pub(crate) port: u16,
}

impl Config {
    pub(crate) fn from_env() -> Result<Self, Box<dyn Error>> {
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
