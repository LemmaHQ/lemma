use sea_orm::{DatabaseConnection, DbErr};
use sea_orm_migration::{MigrationTrait, MigratorTrait};

struct Migrator;

impl MigratorTrait for Migrator {
    fn migrations() -> Vec<Box<dyn MigrationTrait>> {
        let mut all = lemma_auth::migrations();
        all.sort_by(|a, b| a.name().cmp(b.name()));
        all
    }
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
