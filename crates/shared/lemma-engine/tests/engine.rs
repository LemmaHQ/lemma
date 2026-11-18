//! `Engine::open` failures, one per startup step.

mod common;

use std::error::Error;
use std::fs;

use common::DataDir;
use lemma_engine::{Engine, EngineOpenError};
use sqlx::SqlitePool;
use sqlx::sqlite::SqliteConnectOptions;

fn open_error(result: Result<Engine, EngineOpenError>) -> EngineOpenError {
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

    let error = open_error(Engine::open(&dir.0).await);

    assert!(
        matches!(error, EngineOpenError::SecretsJson(_)),
        "{error:?}"
    );
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

    let error = open_error(Engine::open(&dir.0).await);
    fs::remove_file(&dir.0)?;

    assert!(matches!(error, EngineOpenError::Secrets(_)), "{error:?}");
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

    let error = open_error(Engine::open(&dir.0).await);

    assert!(matches!(error, EngineOpenError::Secrets(_)), "{error:?}");
    assert!(error.to_string().contains("secrets.json"), "{error}");
    Ok(())
}

#[tokio::test]
async fn a_lemma_db_that_cannot_be_opened_fails_the_database_step() -> Result<(), Box<dyn Error>> {
    let dir = DataDir::new();
    fs::create_dir_all(dir.0.join("lemma.db"))?;

    let error = open_error(Engine::open(&dir.0).await);

    assert!(matches!(error, EngineOpenError::Database(_)), "{error:?}");
    assert!(error.to_string().contains("lemma.db"), "{error}");
    Ok(())
}

#[tokio::test]
async fn a_migration_failure_fails_the_migration_step() -> Result<(), Box<dyn Error>> {
    let dir = DataDir::new();
    Engine::open(&dir.0).await?.close().await;
    let db = SqlitePool::connect_with(SqliteConnectOptions::new().filename(dir.0.join("lemma.db")))
        .await?;
    sqlx::query("UPDATE _sqlx_migrations SET checksum = X'00'")
        .execute(&db)
        .await?;
    db.close().await;

    let error = open_error(Engine::open(&dir.0).await);

    assert!(matches!(error, EngineOpenError::Migration(_)), "{error:?}");
    assert!(error.to_string().contains("lemma.db"), "{error}");
    Ok(())
}
