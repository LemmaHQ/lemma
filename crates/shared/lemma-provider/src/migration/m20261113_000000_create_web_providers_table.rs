use sea_orm_migration::async_trait::async_trait;
use sea_orm_migration::prelude::*;
use sea_orm_migration::schema::{
    boolean, integer, pk_uuid, string, timestamp_with_time_zone, uuid,
};

#[derive(DeriveMigrationName)]
pub struct Migration;

#[derive(DeriveIden)]
enum Users {
    Table,
    Id,
}

#[derive(DeriveIden)]
enum WebProviders {
    Table,
    Id,
    UserId,
    Kind,
    ApiKey,
    Enabled,
    SearchRank,
    FetchRank,
    CreatedAt,
}

#[async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(WebProviders::Table)
                    .col(pk_uuid(WebProviders::Id))
                    .col(uuid(WebProviders::UserId))
                    .col(string(WebProviders::Kind))
                    .col(string(WebProviders::ApiKey))
                    .col(boolean(WebProviders::Enabled))
                    .col(integer(WebProviders::SearchRank))
                    .col(integer(WebProviders::FetchRank))
                    .col(timestamp_with_time_zone(WebProviders::CreatedAt))
                    .foreign_key(
                        ForeignKey::create()
                            .from(WebProviders::Table, WebProviders::UserId)
                            .to(Users::Table, Users::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;
        manager
            .create_index(
                Index::create()
                    .name("idx_web_providers_user_id_kind")
                    .table(WebProviders::Table)
                    .col(WebProviders::UserId)
                    .col(WebProviders::Kind)
                    .unique()
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(WebProviders::Table).to_owned())
            .await
    }
}
