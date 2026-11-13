use sea_orm_migration::MigrationTrait;

use super::m20261025_104343_create_providers_table;
use super::m20261031_103024_drop_providers_updated_at;
use super::m20261111_060643_add_provider_sources_and_model_features;
use super::m20261113_000000_create_web_providers_table;

/// Schema migrations of the providers table, oldest first.
#[must_use]
pub fn migrations() -> Vec<Box<dyn MigrationTrait>> {
    vec![
        Box::new(m20261025_104343_create_providers_table::Migration),
        Box::new(m20261031_103024_drop_providers_updated_at::Migration),
        Box::new(m20261111_060643_add_provider_sources_and_model_features::Migration),
        Box::new(m20261113_000000_create_web_providers_table::Migration),
    ]
}
