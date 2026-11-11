use sea_orm_migration::MigrationTrait;

use super::m20261025_122749_create_session_tables;
use super::m20261111_005431_add_sessions_directory;

/// Schema migrations of the sessions and messages tables, oldest
/// first.
#[must_use]
pub fn migrations() -> Vec<Box<dyn MigrationTrait>> {
    vec![
        Box::new(m20261025_122749_create_session_tables::Migration),
        Box::new(m20261111_005431_add_sessions_directory::Migration),
    ]
}
