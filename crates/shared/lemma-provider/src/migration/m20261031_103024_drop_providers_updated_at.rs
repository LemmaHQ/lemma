use sea_orm_migration::async_trait::async_trait;
use sea_orm_migration::prelude::*;
use sea_orm_migration::schema::timestamp_with_time_zone;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[derive(DeriveIden)]
enum Providers {
    Table,
    UpdatedAt,
}

#[async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table(Providers::Table)
                    .drop_column(Providers::UpdatedAt)
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table(Providers::Table)
                    .add_column(timestamp_with_time_zone(Providers::UpdatedAt).null())
                    .to_owned(),
            )
            .await
    }
}
