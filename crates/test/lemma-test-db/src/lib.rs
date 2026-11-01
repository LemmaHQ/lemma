//! Test databases: in-memory SQLite always, and PostgreSQL when
//! `LEMMA_TEST_POSTGRES_URL` names a reachable server.

use std::env;
use std::error::Error;

use sea_orm::{ConnectOptions, ConnectionTrait, Database, DatabaseConnection, DbErr};
use sea_orm_migration::MigratorTrait;
use uuid::Uuid;

/// Runs `test` against a freshly migrated in-memory SQLite database and,
/// when `LEMMA_TEST_POSTGRES_URL` is set, against a freshly migrated
/// PostgreSQL database that is dropped afterwards.
///
/// # Errors
///
/// The error of the first failing test run, or of creating, migrating, or
/// dropping a database. The PostgreSQL database is dropped whenever it was
/// created, including when migrating it or the test fails.
pub async fn on_each_database<M, F, Fut>(test: F) -> Result<(), Box<dyn Error>>
where
    M: MigratorTrait,
    F: Fn(DatabaseConnection) -> Fut,
    Fut: Future<Output = Result<(), Box<dyn Error>>>,
{
    let mut options = ConnectOptions::new("sqlite::memory:");
    options.max_connections(1);
    test(connect::<M>(options).await?).await?;

    let Ok(url) = env::var("LEMMA_TEST_POSTGRES_URL") else {
        return Ok(());
    };
    let admin = Database::connect(ConnectOptions::new(&url)).await?;
    let name = format!("lemma_test_{}", Uuid::new_v4().simple());
    admin
        .execute_unprepared(&format!("CREATE DATABASE {name}"))
        .await?;
    let mut options = ConnectOptions::new(&url);
    let database = name.clone();
    options.map_sqlx_postgres_opts(move |opts| opts.database(&database));
    let outcome = run::<M, _, _>(options, &test).await;
    let dropped = admin
        .execute_unprepared(&format!("DROP DATABASE {name} WITH (FORCE)"))
        .await;
    outcome?;
    dropped?;
    Ok(())
}

async fn run<M, F, Fut>(options: ConnectOptions, test: &F) -> Result<(), Box<dyn Error>>
where
    M: MigratorTrait,
    F: Fn(DatabaseConnection) -> Fut,
    Fut: Future<Output = Result<(), Box<dyn Error>>>,
{
    let db = connect::<M>(options).await?;
    let result = test(db.clone()).await;
    db.close().await?;
    result
}

async fn connect<M: MigratorTrait>(options: ConnectOptions) -> Result<DatabaseConnection, DbErr> {
    let db = Database::connect(options).await?;
    M::up(&db, None).await?;
    Ok(db)
}
