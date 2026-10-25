use sea_orm_migration::MigrationTrait;

use super::m20261025_093225_create_auth_tables;

/// Schema migrations of the auth tables, oldest first.
#[must_use]
pub fn migrations() -> Vec<Box<dyn MigrationTrait>> {
    vec![Box::new(m20261025_093225_create_auth_tables::Migration)]
}
