//! Auth flows against a migrated database.

use std::error::Error;

use lemma_auth::{AuthError, AuthService, verify_access_token};
use lemma_test_db::on_each_database;
use sea_orm::{ConnectionTrait, DatabaseConnection, DbBackend, DbErr};
use sea_orm_migration::{MigrationTrait, MigratorTrait};
use uuid::Uuid;

struct Migrator;

impl MigratorTrait for Migrator {
    fn migrations() -> Vec<Box<dyn MigrationTrait>> {
        lemma_auth::migrations()
    }
}

const PASSWORD: &str = "correct-horse";

fn service(db: DatabaseConnection) -> AuthService {
    AuthService::new(db, "test-secret".to_owned())
}

async fn refuse_writes(db: &DatabaseConnection, table: &str, operation: &str) -> Result<(), DbErr> {
    if db.get_database_backend() == DbBackend::Postgres {
        db.execute_unprepared(
            "CREATE OR REPLACE FUNCTION refuse_write() RETURNS trigger LANGUAGE plpgsql \
             AS $$ BEGIN RAISE EXCEPTION 'write refused'; END $$",
        )
        .await?;
        db.execute_unprepared(&format!(
            "CREATE TRIGGER refuse_write BEFORE {operation} ON {table} \
             FOR EACH ROW EXECUTE FUNCTION refuse_write()"
        ))
        .await?;
    } else {
        db.execute_unprepared(&format!(
            "CREATE TRIGGER refuse_write BEFORE {operation} ON {table} \
             BEGIN SELECT RAISE(ABORT, 'write refused'); END"
        ))
        .await?;
    }
    Ok(())
}

async fn allow_writes(db: &DatabaseConnection, table: &str) -> Result<(), DbErr> {
    let statement = if db.get_database_backend() == DbBackend::Postgres {
        format!("DROP TRIGGER refuse_write ON {table}")
    } else {
        "DROP TRIGGER refuse_write".to_owned()
    };
    db.execute_unprepared(&statement).await?;
    Ok(())
}

#[tokio::test]
async fn sign_up_names_the_taken_username_or_email() -> Result<(), Box<dyn Error>> {
    on_each_database::<Migrator, _, _>(|db| async move {
        let auth = service(db);
        auth.sign_up("ada", "ada@example.com", PASSWORD).await?;
        auth.sign_up("bob", "bob@example.com", PASSWORD).await?;

        let same_username = auth.sign_up("ada", "other@example.com", PASSWORD).await;
        let same_email = auth.sign_up("other", "ada@example.com", PASSWORD).await;
        let both = auth.sign_up("ada", "bob@example.com", PASSWORD).await;

        assert!(
            matches!(same_username, Err(AuthError::UsernameTaken)),
            "same username: {same_username:?}"
        );
        assert!(
            matches!(same_email, Err(AuthError::EmailTaken)),
            "same email: {same_email:?}"
        );
        assert!(
            matches!(both, Err(AuthError::UsernameTaken)),
            "username and email of different accounts: {both:?}"
        );
        Ok(())
    })
    .await
}

#[tokio::test]
async fn account_exists_matches_the_username_or_the_email() -> Result<(), Box<dyn Error>> {
    on_each_database::<Migrator, _, _>(|db| async move {
        let auth = service(db);
        auth.sign_up("ada", "ada@example.com", PASSWORD).await?;

        assert!(auth.account_exists("ada").await?, "username");
        assert!(
            auth.account_exists(" ada@example.com ").await?,
            "padded email"
        );
        assert!(!auth.account_exists("nobody").await?, "unknown login");
        assert!(!auth.account_exists("").await?, "blank login");
        Ok(())
    })
    .await
}

#[tokio::test]
async fn login_accepts_the_username_or_the_email() -> Result<(), Box<dyn Error>> {
    on_each_database::<Migrator, _, _>(|db| async move {
        let auth = service(db);
        let signed_up = auth.sign_up("ada", "ada@example.com", PASSWORD).await?;

        let by_username = auth.login("ada", PASSWORD).await?;
        let by_email = auth.login("ada@example.com", PASSWORD).await?;
        let wrong_password = auth.login("ada", "wrong-password").await;
        let unknown = auth.login("nobody", PASSWORD).await;

        assert_eq!(by_username.user.id, signed_up.user.id, "username login");
        assert_eq!(by_email.user.id, signed_up.user.id, "email login");
        assert!(
            matches!(wrong_password, Err(AuthError::CredentialsInvalid)),
            "wrong password: {wrong_password:?}"
        );
        assert!(
            matches!(unknown, Err(AuthError::CredentialsInvalid)),
            "unknown login: {unknown:?}"
        );
        Ok(())
    })
    .await
}

#[tokio::test]
async fn refresh_rotates_the_token_and_rejects_the_consumed_one() -> Result<(), Box<dyn Error>> {
    on_each_database::<Migrator, _, _>(|db| async move {
        let auth = service(db);
        let session = auth.sign_up("ada", "ada@example.com", PASSWORD).await?;

        let rotated = auth.refresh(&session.tokens.refresh_token).await?;
        let replayed = auth.refresh(&session.tokens.refresh_token).await;

        assert_ne!(
            rotated.refresh_token, session.tokens.refresh_token,
            "rotation issues a new token"
        );
        assert!(
            matches!(replayed, Err(AuthError::TokenInvalid)),
            "consumed token: {replayed:?}"
        );
        Ok(())
    })
    .await
}

#[tokio::test]
async fn replaying_a_consumed_token_revokes_its_whole_family() -> Result<(), Box<dyn Error>> {
    on_each_database::<Migrator, _, _>(|db| async move {
        let auth = service(db);
        let first = auth.sign_up("ada", "ada@example.com", PASSWORD).await?;
        let second = auth.refresh(&first.tokens.refresh_token).await?;
        let third = auth.refresh(&second.refresh_token).await?;
        let other_login = auth.login("ada", PASSWORD).await?;

        let replayed = auth.refresh(&first.tokens.refresh_token).await;
        let latest = auth.refresh(&third.refresh_token).await;
        let other_family = auth.refresh(&other_login.tokens.refresh_token).await;

        assert!(
            matches!(replayed, Err(AuthError::TokenInvalid)),
            "replayed token: {replayed:?}"
        );
        assert!(
            matches!(latest, Err(AuthError::TokenInvalid)),
            "latest token of the family: {latest:?}"
        );
        assert!(
            other_family.is_ok(),
            "a token of another login stays valid: {other_family:?}"
        );
        Ok(())
    })
    .await
}

#[tokio::test]
async fn concurrent_refreshes_of_one_token_revoke_its_family() -> Result<(), Box<dyn Error>> {
    on_each_database::<Migrator, _, _>(|db| async move {
        let auth = service(db);
        let session = auth.sign_up("ada", "ada@example.com", PASSWORD).await?;
        let presented = &session.tokens.refresh_token;

        let (a, b) = tokio::join!(auth.refresh(presented), auth.refresh(presented));
        let winner = [a, b].into_iter().flatten().collect::<Vec<_>>();
        let [rotated] = winner.as_slice() else {
            return Err(format!("one refresh succeeds, got {}", winner.len()).into());
        };
        let after = auth.refresh(&rotated.refresh_token).await;

        assert!(
            matches!(after, Err(AuthError::TokenInvalid)),
            "the winner's token is revoked with its family: {after:?}"
        );
        Ok(())
    })
    .await
}

#[tokio::test]
async fn refresh_rejects_an_unknown_or_expired_token() -> Result<(), Box<dyn Error>> {
    on_each_database::<Migrator, _, _>(|db| async move {
        let auth = service(db.clone());
        let session = auth.sign_up("ada", "ada@example.com", PASSWORD).await?;
        db.execute_unprepared("UPDATE refresh_tokens SET expires_at = '2020-01-01 00:00:00+00:00'")
            .await?;

        let unknown = auth.refresh("never-issued").await;
        let expired = auth.refresh(&session.tokens.refresh_token).await;

        assert!(
            matches!(unknown, Err(AuthError::TokenInvalid)),
            "unknown token: {unknown:?}"
        );
        assert!(
            matches!(expired, Err(AuthError::TokenInvalid)),
            "expired token: {expired:?}"
        );
        Ok(())
    })
    .await
}

#[tokio::test]
async fn a_sign_up_failing_midway_leaves_no_account() -> Result<(), Box<dyn Error>> {
    on_each_database::<Migrator, _, _>(|db| async move {
        let auth = service(db.clone());

        for table in ["auth_credentials", "refresh_tokens"] {
            refuse_writes(&db, table, "INSERT").await?;
            let failed = auth.sign_up("ada", "ada@example.com", PASSWORD).await;
            allow_writes(&db, table).await?;

            assert!(
                matches!(failed, Err(AuthError::Store(_))),
                "insert into {table} refused: {failed:?}"
            );
            assert!(
                !auth.account_exists("ada").await?,
                "insert into {table} refused: the account is rolled back"
            );
        }
        auth.sign_up("ada", "ada@example.com", PASSWORD).await?;
        Ok(())
    })
    .await
}

#[tokio::test]
async fn a_refresh_failing_to_issue_keeps_the_presented_token() -> Result<(), Box<dyn Error>> {
    on_each_database::<Migrator, _, _>(|db| async move {
        let auth = service(db.clone());
        let session = auth.sign_up("ada", "ada@example.com", PASSWORD).await?;

        refuse_writes(&db, "refresh_tokens", "INSERT").await?;
        let failed_login = auth.login("ada", PASSWORD).await;
        let failed = auth.refresh(&session.tokens.refresh_token).await;
        allow_writes(&db, "refresh_tokens").await?;

        assert!(
            matches!(&failed_login, Err(AuthError::Store(message)) if message.contains("write refused")),
            "login issuing refused: {failed_login:?}"
        );
        assert!(
            matches!(&failed, Err(AuthError::Store(message)) if message.contains("write refused")),
            "issuing refused: {failed:?}"
        );
        auth.refresh(&session.tokens.refresh_token).await?;
        Ok(())
    })
    .await
}

#[tokio::test]
async fn a_refresh_failing_to_revoke_leaves_every_token_as_it_was() -> Result<(), Box<dyn Error>> {
    on_each_database::<Migrator, _, _>(|db| async move {
        let auth = service(db.clone());
        let first = auth.sign_up("ada", "ada@example.com", PASSWORD).await?;
        let second = auth.refresh(&first.tokens.refresh_token).await?;

        refuse_writes(&db, "refresh_tokens", "UPDATE").await?;
        let rotation = auth.refresh(&second.refresh_token).await;
        let replay = auth.refresh(&first.tokens.refresh_token).await;
        allow_writes(&db, "refresh_tokens").await?;

        for (operation, failed) in [
            ("revoking the presented token", rotation.err()),
            ("revoking the replayed token's family", replay.err()),
        ] {
            assert!(
                matches!(&failed, Some(AuthError::Store(message)) if message.contains("write refused")),
                "{operation}: {failed:?}"
            );
        }
        auth.refresh(&second.refresh_token).await?;
        Ok(())
    })
    .await
}

#[tokio::test]
async fn logout_revokes_the_presented_token() -> Result<(), Box<dyn Error>> {
    on_each_database::<Migrator, _, _>(|db| async move {
        let auth = service(db);
        let session = auth.sign_up("ada", "ada@example.com", PASSWORD).await?;

        auth.logout(Some(&session.tokens.refresh_token)).await?;
        auth.logout(None).await?;
        let refreshed = auth.refresh(&session.tokens.refresh_token).await;

        assert!(
            matches!(refreshed, Err(AuthError::TokenInvalid)),
            "revoked token: {refreshed:?}"
        );
        Ok(())
    })
    .await
}

#[tokio::test]
async fn me_returns_the_account_or_reports_it_missing() -> Result<(), Box<dyn Error>> {
    on_each_database::<Migrator, _, _>(|db| async move {
        let auth = service(db);
        let session = auth.sign_up("ada", "ada@example.com", PASSWORD).await?;

        let found = auth.me(session.user.id).await?;
        let missing = auth.me(Uuid::new_v4()).await;

        assert_eq!(found.username, "ada", "account username");
        assert!(
            matches!(missing, Err(AuthError::UserNotFound)),
            "unknown id: {missing:?}"
        );
        Ok(())
    })
    .await
}

#[tokio::test]
async fn sign_up_requires_a_username_an_email_and_eight_password_characters()
-> Result<(), Box<dyn Error>> {
    on_each_database::<Migrator, _, _>(|db| async move {
        let auth = service(db);

        for (username, email, password) in [
            ("  ", "ada@example.com", PASSWORD),
            ("ada", " ", PASSWORD),
            ("ada", "ada@example.com", "1234567"),
        ] {
            let result = auth.sign_up(username, email, password).await;
            assert!(
                matches!(result, Err(AuthError::SignupFieldsRequired)),
                "{username:?} {email:?} {password:?}: {result:?}"
            );
        }
        assert!(!auth.account_exists("ada").await?, "nothing was created");
        let session = auth
            .sign_up(" ada ", " ada@example.com ", "12345678")
            .await?;
        assert_eq!(
            (session.user.username.as_str(), session.user.email.as_str()),
            ("ada", "ada@example.com"),
            "fields are stored trimmed"
        );
        Ok(())
    })
    .await
}

#[tokio::test]
async fn an_access_token_names_its_user_only_under_the_signing_secret() -> Result<(), Box<dyn Error>>
{
    on_each_database::<Migrator, _, _>(|db| async move {
        let session = service(db)
            .sign_up("ada", "ada@example.com", PASSWORD)
            .await?;

        let claims = verify_access_token("test-secret", &session.tokens.access_token)?;
        let forged = verify_access_token("other-secret", &session.tokens.access_token);

        assert_eq!(claims.sub, session.user.id.to_string(), "subject");
        assert!(forged.is_err(), "another secret rejects the token");
        Ok(())
    })
    .await
}

#[tokio::test]
async fn debug_output_never_reveals_the_signing_secret() -> Result<(), Box<dyn Error>> {
    on_each_database::<Migrator, _, _>(|db| async move {
        let debug = format!("{:?}", service(db));

        assert!(
            debug.starts_with("AuthService") && !debug.contains("test-secret"),
            "{debug}"
        );
        Ok(())
    })
    .await
}

#[tokio::test]
async fn the_auth_tables_roll_back_and_reapply() -> Result<(), Box<dyn Error>> {
    on_each_database::<Migrator, _, _>(|db| async move {
        let auth = service(db.clone());
        let session = auth.sign_up("ada", "ada@example.com", PASSWORD).await?;

        Migrator::down(&db, None).await?;
        let signed_up = auth.sign_up("bob", "bob@example.com", PASSWORD).await;
        let account_exists = auth.account_exists("ada").await;
        let logged_in = auth.login("ada", PASSWORD).await;
        let refreshed = auth.refresh(&session.tokens.refresh_token).await;
        let logged_out = auth.logout(Some(&session.tokens.refresh_token)).await;
        let me = auth.me(session.user.id).await;
        Migrator::up(&db, None).await?;

        for (operation, failed) in [
            ("sign-up", signed_up.err()),
            ("account exists", account_exists.err()),
            ("login", logged_in.err()),
            ("refresh", refreshed.err()),
            ("logout", logged_out.err()),
            ("me", me.err()),
        ] {
            assert!(
                matches!(failed, Some(AuthError::Store(_))),
                "{operation} without tables: {failed:?}"
            );
        }
        assert!(
            !auth.account_exists("ada").await?,
            "rolling back drops accounts"
        );
        auth.sign_up("ada", "ada@example.com", PASSWORD).await?;
        Ok(())
    })
    .await
}
