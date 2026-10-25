use sea_orm::sqlx::sqlite::{SqliteJournalMode, SqliteSynchronous};
use sea_orm::{ConnectOptions, Database, DatabaseConnection, DbErr};
use sea_orm_migration::{MigrationTrait, MigratorTrait};

struct Migrator;

impl MigratorTrait for Migrator {
    fn migrations() -> Vec<Box<dyn MigrationTrait>> {
        let mut all: Vec<_> = [
            lemma_auth::migrations(),
            lemma_conversation::migrations(),
            lemma_provider::migrations(),
        ]
        .into_iter()
        .flatten()
        .collect();
        all.sort_by(|a, b| a.name().cmp(b.name()));
        all
    }
}

/// Opens the database `url` names: `sqlite:<path>`, created when missing and
/// run in WAL mode, or `postgres://…` where the build includes the
/// PostgreSQL driver.
///
/// # Errors
///
/// The [`DbErr`] when the URL names no supported driver or the database
/// cannot be reached.
pub async fn connect(url: &str) -> Result<DatabaseConnection, DbErr> {
    let mut options = ConnectOptions::new(url);
    options.map_sqlx_sqlite_opts(|opts| {
        opts.create_if_missing(true)
            .journal_mode(SqliteJournalMode::Wal)
            .synchronous(SqliteSynchronous::Normal)
    });
    Database::connect(options).await
}

/// Applies the pending schema migrations of every crate that owns tables,
/// in name order.
///
/// # Errors
///
/// The [`DbErr`] of the failing migration.
pub async fn migrate(db: &DatabaseConnection) -> Result<(), DbErr> {
    Migrator::up(db, None).await
}
