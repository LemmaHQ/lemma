use sea_orm_migration::async_trait::async_trait;
use sea_orm_migration::prelude::*;
use sea_orm_migration::schema::{json, pk_uuid, string, timestamp_with_time_zone, uuid};

#[derive(DeriveMigrationName)]
pub struct Migration;

#[derive(DeriveIden)]
enum Users {
    Table,
    Id,
}

#[derive(DeriveIden)]
enum Sessions {
    Table,
    Id,
    UserId,
    Title,
    LeafId,
    LastModel,
    CreatedAt,
    UpdatedAt,
}

#[derive(DeriveIden)]
enum Messages {
    Table,
    Id,
    SessionId,
    ParentId,
    Body,
    Status,
    Error,
    ProviderId,
    Model,
    CreatedAt,
    UpdatedAt,
}

#[async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(Sessions::Table)
                    .col(pk_uuid(Sessions::Id))
                    .col(uuid(Sessions::UserId))
                    .col(string(Sessions::Title))
                    .col(uuid(Sessions::LeafId).null())
                    .col(json(Sessions::LastModel).null())
                    .col(timestamp_with_time_zone(Sessions::CreatedAt))
                    .col(timestamp_with_time_zone(Sessions::UpdatedAt))
                    .foreign_key(
                        ForeignKey::create()
                            .from(Sessions::Table, Sessions::UserId)
                            .to(Users::Table, Users::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;
        manager
            .create_index(
                Index::create()
                    .name("idx_sessions_user_id")
                    .table(Sessions::Table)
                    .col(Sessions::UserId)
                    .to_owned(),
            )
            .await?;
        manager
            .create_table(
                Table::create()
                    .table(Messages::Table)
                    .col(pk_uuid(Messages::Id))
                    .col(uuid(Messages::SessionId))
                    .col(uuid(Messages::ParentId).null())
                    .col(json(Messages::Body))
                    .col(string(Messages::Status))
                    .col(string(Messages::Error).null())
                    .col(uuid(Messages::ProviderId).null())
                    .col(string(Messages::Model).null())
                    .col(timestamp_with_time_zone(Messages::CreatedAt))
                    .col(timestamp_with_time_zone(Messages::UpdatedAt))
                    .foreign_key(
                        ForeignKey::create()
                            .from(Messages::Table, Messages::SessionId)
                            .to(Sessions::Table, Sessions::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;
        manager
            .create_index(
                Index::create()
                    .name("idx_messages_session_id_created_at_id")
                    .table(Messages::Table)
                    .col(Messages::SessionId)
                    .col(Messages::CreatedAt)
                    .col(Messages::Id)
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(Messages::Table).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().table(Sessions::Table).to_owned())
            .await
    }
}
