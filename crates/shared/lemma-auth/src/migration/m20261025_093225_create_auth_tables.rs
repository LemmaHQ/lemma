use sea_orm_migration::async_trait::async_trait;
use sea_orm_migration::prelude::*;
use sea_orm_migration::schema::{pk_uuid, string, string_uniq, timestamp_with_time_zone, uuid};

#[derive(DeriveMigrationName)]
pub struct Migration;

#[derive(DeriveIden)]
enum Users {
    Table,
    Id,
    Username,
    Email,
    CreatedAt,
}

#[derive(DeriveIden)]
enum AuthCredentials {
    Table,
    UserId,
    PasswordHash,
}

#[derive(DeriveIden)]
enum RefreshTokens {
    Table,
    Id,
    UserId,
    FamilyId,
    TokenHash,
    RevokedAt,
    ExpiresAt,
}

#[async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(Users::Table)
                    .col(pk_uuid(Users::Id))
                    .col(string_uniq(Users::Username))
                    .col(string_uniq(Users::Email))
                    .col(timestamp_with_time_zone(Users::CreatedAt))
                    .to_owned(),
            )
            .await?;
        manager
            .create_table(
                Table::create()
                    .table(AuthCredentials::Table)
                    .col(pk_uuid(AuthCredentials::UserId))
                    .col(string(AuthCredentials::PasswordHash))
                    .foreign_key(
                        ForeignKey::create()
                            .from(AuthCredentials::Table, AuthCredentials::UserId)
                            .to(Users::Table, Users::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;
        manager
            .create_table(
                Table::create()
                    .table(RefreshTokens::Table)
                    .col(pk_uuid(RefreshTokens::Id))
                    .col(uuid(RefreshTokens::UserId))
                    .col(uuid(RefreshTokens::FamilyId))
                    .col(string_uniq(RefreshTokens::TokenHash))
                    .col(timestamp_with_time_zone(RefreshTokens::RevokedAt).null())
                    .col(timestamp_with_time_zone(RefreshTokens::ExpiresAt))
                    .foreign_key(
                        ForeignKey::create()
                            .from(RefreshTokens::Table, RefreshTokens::UserId)
                            .to(Users::Table, Users::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;
        manager
            .create_index(
                Index::create()
                    .name("idx_refresh_tokens_family_id")
                    .table(RefreshTokens::Table)
                    .col(RefreshTokens::FamilyId)
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(RefreshTokens::Table).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().table(AuthCredentials::Table).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().table(Users::Table).to_owned())
            .await
    }
}
