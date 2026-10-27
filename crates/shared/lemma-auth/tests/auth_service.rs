//! Auth flows against a migrated database.

use std::error::Error;

use lemma_auth::{AuthError, AuthService};
use lemma_test_db::on_each_database;
use sea_orm::{ConnectionTrait, DatabaseConnection};
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
async fn refresh_rejects_an_expired_token() -> Result<(), Box<dyn Error>> {
    on_each_database::<Migrator, _, _>(|db| async move {
        let auth = service(db.clone());
        let session = auth.sign_up("ada", "ada@example.com", PASSWORD).await?;
        db.execute_unprepared("UPDATE refresh_tokens SET expires_at = '2020-01-01 00:00:00+00:00'")
            .await?;

        let refreshed = auth.refresh(&session.tokens.refresh_token).await;

        assert!(
            matches!(refreshed, Err(AuthError::TokenInvalid)),
            "expired token: {refreshed:?}"
        );
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
