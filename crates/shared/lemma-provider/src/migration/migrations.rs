use sea_orm_migration::MigrationTrait;

use super::m20261025_104343_create_providers_table;

/// Schema migrations of the providers table, oldest first.
#[must_use]
pub fn migrations() -> Vec<Box<dyn MigrationTrait>> {
    vec![Box::new(m20261025_104343_create_providers_table::Migration)]
}
