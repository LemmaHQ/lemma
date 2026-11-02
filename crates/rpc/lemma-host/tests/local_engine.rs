//! `LocalEngine::open` failures, one per startup step.

mod common;

use std::error::Error;
use std::fs;

use common::DataDir;
use lemma_host::{LocalEngine, LocalEngineError};
use sea_orm::ConnectionTrait;

fn open_error(result: Result<LocalEngine, LocalEngineError>) -> LocalEngineError {
    match result {
        Ok(engine) => panic!("the engine opened: {engine:?}"),
        Err(e) => e,
    }
}

#[tokio::test]
async fn unreadable_secrets_json_fails_the_secrets_step() -> Result<(), Box<dyn Error>> {
    let dir = DataDir::new();
    fs::create_dir_all(&dir.0)?;
    fs::write(dir.0.join("secrets.json"), "not json")?;

    let error = open_error(LocalEngine::open(&dir.0).await);

    assert!(matches!(error, LocalEngineError::Secrets(_)), "{error:?}");
    assert!(error.to_string().contains("secrets.json"), "{error}");
    assert_eq!(
        fs::read_to_string(dir.0.join("secrets.json"))?,
        "not json",
        "the existing file is left as it was"
    );
    Ok(())
}

#[tokio::test]
async fn a_data_dir_that_is_a_file_fails_the_secrets_step() -> Result<(), Box<dyn Error>> {
    let dir = DataDir::new();
    fs::write(&dir.0, "")?;

    let error = open_error(LocalEngine::open(&dir.0).await);
    fs::remove_file(&dir.0)?;

    assert!(matches!(error, LocalEngineError::Secrets(_)), "{error:?}");
    assert!(
        error.to_string().contains(&dir.0.display().to_string()),
        "{error}"
    );
    Ok(())
}

#[tokio::test]
async fn a_secrets_json_that_cannot_be_written_fails_the_secrets_step() -> Result<(), Box<dyn Error>>
{
    let dir = DataDir::new();
    fs::create_dir_all(dir.0.join("secrets.json"))?;

    let error = open_error(LocalEngine::open(&dir.0).await);

    assert!(matches!(error, LocalEngineError::Secrets(_)), "{error:?}");
    assert!(error.to_string().contains("secrets.json"), "{error}");
    Ok(())
}

#[tokio::test]
async fn a_lemma_db_that_cannot_be_opened_fails_the_database_step() -> Result<(), Box<dyn Error>> {
    let dir = DataDir::new();
    fs::create_dir_all(dir.0.join("lemma.db"))?;

    let error = open_error(LocalEngine::open(&dir.0).await);

    assert!(matches!(error, LocalEngineError::Database(_)), "{error:?}");
    assert!(error.to_string().contains("lemma.db"), "{error}");
    Ok(())
}

#[tokio::test]
async fn a_migration_failure_fails_the_migration_step() -> Result<(), Box<dyn Error>> {
    let dir = DataDir::new();
    LocalEngine::open(&dir.0).await?.close().await?;
    let db = lemma_host::connect(&format!("sqlite:{}", dir.0.join("lemma.db").display())).await?;
    db.execute_unprepared(
        "INSERT INTO seaql_migrations (version, applied_at) VALUES ('m99990101_000000_unknown', 0)",
    )
    .await?;
    db.close().await?;

    let error = open_error(LocalEngine::open(&dir.0).await);

    assert!(matches!(error, LocalEngineError::Migration(_)), "{error:?}");
    assert!(error.to_string().contains("lemma.db"), "{error}");
    Ok(())
}
