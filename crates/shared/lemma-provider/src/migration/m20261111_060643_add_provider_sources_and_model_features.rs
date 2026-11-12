use sea_orm_migration::async_trait::async_trait;
use sea_orm_migration::prelude::*;
use sea_orm_migration::schema::string;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[derive(DeriveIden)]
enum Providers {
    Table,
    UserId,
    Kind,
    ApiFormat,
    Source,
    Identifier,
}

#[async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table(Providers::Table)
                    .rename_column(Providers::Kind, Providers::ApiFormat)
                    .to_owned(),
            )
            .await?;
        manager
            .alter_table(
                Table::alter()
                    .table(Providers::Table)
                    .add_column(string(Providers::Source).default("custom"))
                    .to_owned(),
            )
            .await?;
        manager
            .drop_index(
                Index::drop()
                    .name("idx_providers_user_id_identifier")
                    .table(Providers::Table)
                    .to_owned(),
            )
            .await?;
        manager
            .create_index(
                Index::create()
                    .name("idx_providers_user_id_source_identifier")
                    .table(Providers::Table)
                    .col(Providers::UserId)
                    .col(Providers::Source)
                    .col(Providers::Identifier)
                    .unique()
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .get_connection()
            .execute(
                &Query::delete()
                    .from_table(Providers::Table)
                    .and_where(Expr::col(Providers::Source).eq("predefined"))
                    .to_owned(),
            )
            .await?;
        manager
            .drop_index(
                Index::drop()
                    .name("idx_providers_user_id_source_identifier")
                    .table(Providers::Table)
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
            .await?;
        manager
            .alter_table(
                Table::alter()
                    .table(Providers::Table)
                    .drop_column(Providers::Source)
                    .to_owned(),
            )
            .await?;
        manager
            .alter_table(
                Table::alter()
                    .table(Providers::Table)
                    .rename_column(Providers::ApiFormat, Providers::Kind)
                    .to_owned(),
            )
            .await
    }
}
