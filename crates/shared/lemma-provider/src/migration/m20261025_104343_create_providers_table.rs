use sea_orm_migration::async_trait::async_trait;
use sea_orm_migration::prelude::*;
use sea_orm_migration::schema::{boolean, json, pk_uuid, string, timestamp_with_time_zone, uuid};

#[derive(DeriveMigrationName)]
pub struct Migration;

#[derive(DeriveIden)]
enum Users {
    Table,
    Id,
}

#[derive(DeriveIden)]
enum Providers {
    Table,
    Id,
    UserId,
    Kind,
    Identifier,
    Name,
    BaseUrl,
    ApiKey,
    ApiPath,
    ModelsPath,
    Models,
    Enabled,
    CreatedAt,
    UpdatedAt,
}

#[async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(Providers::Table)
                    .col(pk_uuid(Providers::Id))
                    .col(uuid(Providers::UserId))
                    .col(string(Providers::Kind))
                    .col(string(Providers::Identifier))
                    .col(string(Providers::Name))
                    .col(string(Providers::BaseUrl))
                    .col(string(Providers::ApiKey))
                    .col(string(Providers::ApiPath))
                    .col(string(Providers::ModelsPath))
                    .col(json(Providers::Models))
                    .col(boolean(Providers::Enabled))
                    .col(timestamp_with_time_zone(Providers::CreatedAt))
                    .col(timestamp_with_time_zone(Providers::UpdatedAt))
                    .foreign_key(
                        ForeignKey::create()
                            .from(Providers::Table, Providers::UserId)
                            .to(Users::Table, Users::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;
        manager
            .create_index(
                Index::create()
                    .name("idx_providers_user_id_identifier")
                    .table(Providers::Table)
                    .col(Providers::UserId)
                    .col(Providers::Identifier)
                    .unique()
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(Providers::Table).to_owned())
            .await
    }
}
