//! Provider schema migration round trip; model data is left untouched because
//! development databases are recreated instead of converted.

use std::error::Error;

use lemma_auth::AuthService;
use lemma_test_db::on_each_database;
use sea_orm::sea_query::Query;
use sea_orm::{ConnectionTrait, DatabaseConnection};
use sea_orm_migration::prelude::DeriveIden;
use sea_orm_migration::{MigrationTrait, MigratorTrait};
use serde_json::{Value, json};
use uuid::Uuid;

struct BaseMigrator;

impl MigratorTrait for BaseMigrator {
    fn migrations() -> Vec<Box<dyn MigrationTrait>> {
        let mut all = lemma_auth::migrations();
        let mut providers = lemma_provider::migrations();
        providers.pop();
        providers.pop();
        all.extend(providers);
        all
    }
}

struct CurrentMigrator;

#[derive(DeriveIden)]
enum Providers {
    Table,
    Id,
    UserId,
    Kind,
    ApiFormat,
    Source,
    Identifier,
    Name,
    BaseUrl,
    ApiKey,
    ApiPath,
    ModelsPath,
    Models,
    Enabled,
    CreatedAt,
}

impl MigratorTrait for CurrentMigrator {
    fn migrations() -> Vec<Box<dyn MigrationTrait>> {
        let mut all = lemma_auth::migrations();
        all.extend(lemma_provider::migrations());
        all
    }
}

async fn insert_old_provider(db: &DatabaseConnection) -> Result<Uuid, Box<dyn Error>> {
    let user_id = AuthService::new(db.clone(), "test-jwt-secret".to_owned())
        .sign_up("ada", "ada@example.com", "correct-horse")
        .await?
        .user
        .id;
    let id = Uuid::new_v4();
    let insert = Query::insert()
        .into_table(Providers::Table)
        .columns([
            Providers::Id,
            Providers::UserId,
            Providers::Kind,
            Providers::Identifier,
            Providers::Name,
            Providers::BaseUrl,
            Providers::ApiKey,
            Providers::ApiPath,
            Providers::ModelsPath,
            Providers::Models,
            Providers::Enabled,
            Providers::CreatedAt,
        ])
        .values_panic([
            id.into(),
            user_id.into(),
            "anthropic".into(),
            "deepseek".into(),
            "DeepSeek mirror".into(),
            "https://api.example.com".into(),
            "".into(),
            "/chat".into(),
            "/models".into(),
            json!(["m2", "m1"]).into(),
            true.into(),
            chrono::Utc::now().into(),
        ])
        .to_owned();
    db.execute(&insert).await?;
    Ok(user_id)
}

async fn insert_predefined(db: &DatabaseConnection, user_id: Uuid) -> Result<(), Box<dyn Error>> {
    let insert = Query::insert()
        .into_table(Providers::Table)
        .columns([
            Providers::Id,
            Providers::UserId,
            Providers::ApiFormat,
            Providers::Source,
            Providers::Identifier,
            Providers::Name,
            Providers::BaseUrl,
            Providers::ApiKey,
            Providers::ApiPath,
            Providers::ModelsPath,
            Providers::Models,
            Providers::Enabled,
            Providers::CreatedAt,
        ])
        .values_panic([
            Uuid::new_v4().into(),
            user_id.into(),
            "anthropic".into(),
            "predefined".into(),
            "deepseek".into(),
            "".into(),
            "".into(),
            "".into(),
            "".into(),
            "".into(),
            json!([]).into(),
            false.into(),
            chrono::Utc::now().into(),
        ])
        .to_owned();
    db.execute(&insert).await?;
    Ok(())
}

async fn provider_row(
    db: &DatabaseConnection,
    format: &str,
) -> Result<(String, String, Value), Box<dyn Error>> {
    let row = db
        .query_one_raw(sea_orm::Statement::from_string(
            db.get_database_backend(),
            format!("SELECT {format}, source, models FROM providers WHERE source = 'custom'"),
        ))
        .await?
        .ok_or("provider row missing")?;
    Ok((
        row.try_get("", format)?,
        row.try_get("", "source")?,
        row.try_get("", "models")?,
    ))
}

#[tokio::test]
async fn migration_round_trip_keeps_custom_rows_beside_a_predefined_namesake()
-> Result<(), Box<dyn Error>> {
    on_each_database::<BaseMigrator, _, _>(|db| async move {
        let user_id = insert_old_provider(&db).await?;

        CurrentMigrator::up(&db, None).await?;
        let web_table = db
            .query_one_raw(sea_orm::Statement::from_string(
                db.get_database_backend(),
                "SELECT COUNT(*) FROM web_providers",
            ))
            .await?;
        assert!(web_table.is_some(), "web providers table created");
        insert_predefined(&db, user_id).await?;
        let (format, source, models) = provider_row(&db, "api_format").await?;

        assert_eq!(format, "anthropic", "renamed format value");
        assert_eq!(source, "custom", "backfilled source");
        assert_eq!(
            models,
            json!(["m2", "m1"]),
            "models are not converted; development databases are recreated"
        );

        CurrentMigrator::down(&db, Some(1)).await?;
        CurrentMigrator::down(&db, Some(1)).await?;
        let row = db
            .query_one_raw(sea_orm::Statement::from_string(
                db.get_database_backend(),
                "SELECT kind, models FROM providers",
            ))
            .await?
            .ok_or("rolled back provider row missing")?;
        let format: String = row.try_get("", "kind")?;
        let models: Value = row.try_get("", "models")?;
        assert_eq!(format, "anthropic", "rolled back format value");
        assert_eq!(models, json!(["m2", "m1"]), "models left untouched");
        Ok(())
    })
    .await
}
