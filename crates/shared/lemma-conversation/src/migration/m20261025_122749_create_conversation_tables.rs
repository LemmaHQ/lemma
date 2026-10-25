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
enum Conversations {
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
    ConversationId,
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
                    .table(Conversations::Table)
                    .col(pk_uuid(Conversations::Id))
                    .col(uuid(Conversations::UserId))
                    .col(string(Conversations::Title))
                    .col(uuid(Conversations::LeafId).null())
                    .col(json(Conversations::LastModel).null())
                    .col(timestamp_with_time_zone(Conversations::CreatedAt))
                    .col(timestamp_with_time_zone(Conversations::UpdatedAt))
                    .foreign_key(
                        ForeignKey::create()
                            .from(Conversations::Table, Conversations::UserId)
                            .to(Users::Table, Users::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;
        manager
            .create_index(
                Index::create()
                    .name("idx_conversations_user_id")
                    .table(Conversations::Table)
                    .col(Conversations::UserId)
                    .to_owned(),
            )
            .await?;
        manager
            .create_table(
                Table::create()
                    .table(Messages::Table)
                    .col(pk_uuid(Messages::Id))
                    .col(uuid(Messages::ConversationId))
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
                            .from(Messages::Table, Messages::ConversationId)
                            .to(Conversations::Table, Conversations::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;
        manager
            .create_index(
                Index::create()
                    .name("idx_messages_conversation_id_created_at_id")
                    .table(Messages::Table)
                    .col(Messages::ConversationId)
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
            .drop_table(Table::drop().table(Conversations::Table).to_owned())
            .await
    }
}
