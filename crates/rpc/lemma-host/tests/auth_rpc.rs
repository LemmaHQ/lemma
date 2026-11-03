//! `AuthService` over Connect on a local engine: responses, auth cookies,
//! and the error reasons clients receive.

mod common;

use std::error::Error;

use common::{Engine, Reply, assert_internal, assert_reason};
use jsonwebtoken::{EncodingKey, Header};
use lemma_proto::lemma::v1::ErrorReason;
use serde_json::{Value, json};

const SIGN_UP: &str = "/lemma.v1.AuthService/SignUp";
const LOGIN: &str = "/lemma.v1.AuthService/Login";
const CHECK_ACCOUNT: &str = "/lemma.v1.AuthService/CheckAccount";
const REFRESH: &str = "/lemma.v1.AuthService/Refresh";
const LOGOUT: &str = "/lemma.v1.AuthService/Logout";
const ME: &str = "/lemma.v1.AuthService/Me";

fn ada() -> Value {
    json!({ "username": "ada", "email": "ada@example.com", "password": "correct-horse" })
}

fn token(body: &Value, kind: &str) -> Result<String, Box<dyn Error>> {
    body["tokens"][kind]
        .as_str()
        .map(str::to_owned)
        .ok_or_else(|| format!("no {kind} in {body}").into())
}

fn cookie_pair(reply: &Reply, name: &str) -> Option<String> {
    reply
        .header_values("set-cookie")
        .into_iter()
        .filter_map(|cookie| cookie.split(';').next())
        .find(|pair| pair.starts_with(&format!("{name}=")))
        .map(str::to_owned)
}

#[tokio::test]
async fn sign_up_returns_the_user_and_sets_both_auth_cookies() -> Result<(), Box<dyn Error>> {
    let mut engine = Engine::open().await?;

    let reply = engine.call(SIGN_UP, &ada()).await?;

    assert_eq!(reply.status, 200, "{reply:?}");
    assert_eq!(reply.body["user"]["username"], "ada", "user");
    let access = token(&reply.body, "accessToken")?;
    let refresh = token(&reply.body, "refreshToken")?;
    assert_eq!(
        reply.header_values("set-cookie"),
        [
            format!("lemma_access={access}; HttpOnly; SameSite=Lax; Path=/; Max-Age=900"),
            format!(
                "lemma_refresh={refresh}; HttpOnly; SameSite=Lax; Path=/lemma.v1.AuthService; Max-Age=2592000"
            ),
        ],
        "auth cookies"
    );
    engine.close().await?;
    Ok(())
}

#[tokio::test]
async fn cookies_are_secure_behind_an_https_proxy() -> Result<(), Box<dyn Error>> {
    let mut engine = Engine::open().await?;

    let reply = engine
        .call_with(SIGN_UP, &[("x-forwarded-proto", "https")], &ada())
        .await?;

    let cookies = reply.header_values("set-cookie");
    assert_eq!(cookies.len(), 2, "{reply:?}");
    assert!(
        cookies.iter().all(|cookie| cookie.ends_with("; Secure")),
        "{cookies:?}"
    );
    engine.close().await?;
    Ok(())
}

#[tokio::test]
async fn sign_up_and_login_rejections_carry_their_reasons() -> Result<(), Box<dyn Error>> {
    let mut engine = Engine::open().await?;
    engine.call(SIGN_UP, &ada()).await?;

    let blank = engine
        .call(
            SIGN_UP,
            &json!({ "username": "", "email": "b@example.com", "password": "correct-horse" }),
        )
        .await?;
    let taken_username = engine
        .call(
            SIGN_UP,
            &json!({ "username": "ada", "email": "b@example.com", "password": "correct-horse" }),
        )
        .await?;
    let taken_email = engine
        .call(
            SIGN_UP,
            &json!({ "username": "bob", "email": "ada@example.com", "password": "correct-horse" }),
        )
        .await?;
    let wrong_password = engine
        .call(LOGIN, &json!({ "login": "ada", "password": "wrong-horse" }))
        .await?;

    assert_reason(&blank, ErrorReason::SignupFieldsRequired);
    assert_reason(&taken_username, ErrorReason::UsernameTaken);
    assert_reason(&taken_email, ErrorReason::EmailTaken);
    assert_reason(&wrong_password, ErrorReason::CredentialsInvalid);
    engine.close().await?;
    Ok(())
}

#[tokio::test]
async fn login_issues_tokens_by_username_or_email() -> Result<(), Box<dyn Error>> {
    let mut engine = Engine::open().await?;
    engine.call(SIGN_UP, &ada()).await?;

    for login in ["ada", "ada@example.com"] {
        let reply = engine
            .call(
                LOGIN,
                &json!({ "login": login, "password": "correct-horse" }),
            )
            .await?;

        assert_eq!(reply.body["user"]["username"], "ada", "{login}: {reply:?}");
        assert_eq!(
            cookie_pair(&reply, "lemma_refresh"),
            Some(format!(
                "lemma_refresh={}",
                token(&reply.body, "refreshToken")?
            )),
            "{login} refresh cookie"
        );
    }
    engine.close().await?;
    Ok(())
}

#[tokio::test]
async fn check_account_reports_whether_a_login_is_registered() -> Result<(), Box<dyn Error>> {
    let mut engine = Engine::open().await?;
    engine.call(SIGN_UP, &ada()).await?;

    let known = engine
        .call(CHECK_ACCOUNT, &json!({ "login": "ada" }))
        .await?;
    let unknown = engine
        .call(CHECK_ACCOUNT, &json!({ "login": "bob" }))
        .await?;

    assert_eq!(known.body, json!({ "exists": true }), "registered login");
    assert!(
        !unknown.body["exists"].as_bool().unwrap_or(false),
        "{unknown:?}"
    );
    engine.close().await?;
    Ok(())
}

#[tokio::test]
async fn refresh_takes_the_token_from_the_body_or_the_cookie() -> Result<(), Box<dyn Error>> {
    let mut engine = Engine::open().await?;
    let signed_up = engine.call(SIGN_UP, &ada()).await?;
    let first = token(&signed_up.body, "refreshToken")?;

    let from_body = engine
        .call(REFRESH, &json!({ "refreshToken": first }))
        .await?;
    let second = token(&from_body.body, "refreshToken")?;
    let cookie = format!("theme=dark; lemma_refresh={second}");
    let from_cookie = engine
        .call_with(REFRESH, &[("cookie", &cookie)], &json!({}))
        .await?;
    let replayed = engine
        .call(REFRESH, &json!({ "refreshToken": first }))
        .await?;
    let without_token = engine.call(REFRESH, &json!({})).await?;

    assert_eq!(from_body.status, 200, "{from_body:?}");
    assert_ne!(second, first, "rotated token");
    assert_eq!(from_cookie.status, 200, "{from_cookie:?}");
    assert_eq!(
        cookie_pair(&from_cookie, "lemma_refresh"),
        Some(format!(
            "lemma_refresh={}",
            token(&from_cookie.body, "refreshToken")?
        )),
        "rotated refresh cookie"
    );
    assert_reason(&replayed, ErrorReason::TokenInvalid);
    assert_reason(&without_token, ErrorReason::TokenInvalid);
    engine.close().await?;
    Ok(())
}

#[tokio::test]
async fn logout_revokes_the_token_and_clears_the_cookies() -> Result<(), Box<dyn Error>> {
    let mut engine = Engine::open().await?;
    let first = token(&engine.call(SIGN_UP, &ada()).await?.body, "refreshToken")?;
    let login = engine
        .call(
            LOGIN,
            &json!({ "login": "ada", "password": "correct-horse" }),
        )
        .await?;
    let second = token(&login.body, "refreshToken")?;

    let by_body = engine
        .call(LOGOUT, &json!({ "refreshToken": first }))
        .await?;
    let cookie = format!("lemma_refresh={second}");
    let by_cookie = engine
        .call_with(LOGOUT, &[("cookie", &cookie)], &json!({}))
        .await?;
    let anonymous = engine.call(LOGOUT, &json!({})).await?;

    assert_eq!(
        by_body.header_values("set-cookie"),
        [
            "lemma_access=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0",
            "lemma_refresh=; HttpOnly; SameSite=Lax; Path=/lemma.v1.AuthService; Max-Age=0",
        ],
        "cleared cookies"
    );
    assert_eq!(
        (by_cookie.status, anonymous.status),
        (200, 200),
        "logout always succeeds"
    );
    for revoked in [first, second] {
        let reply = engine
            .call(REFRESH, &json!({ "refreshToken": revoked }))
            .await?;
        assert_reason(&reply, ErrorReason::TokenInvalid);
    }
    engine.close().await?;
    Ok(())
}

#[tokio::test]
async fn me_authenticates_by_bearer_token_or_access_cookie() -> Result<(), Box<dyn Error>> {
    let mut engine = Engine::open().await?;
    let access = token(&engine.call(SIGN_UP, &ada()).await?.body, "accessToken")?;

    let by_bearer = engine.call_as(&access, ME, &json!({})).await?;
    let cookie = format!("lemma_access=; lemma_access={access}");
    let by_cookie = engine
        .call_with(ME, &[("cookie", &cookie)], &json!({}))
        .await?;

    assert_eq!(by_bearer.body["user"]["username"], "ada", "{by_bearer:?}");
    assert_eq!(by_cookie.body["user"]["username"], "ada", "{by_cookie:?}");
    engine.close().await?;
    Ok(())
}

#[tokio::test]
async fn a_signed_token_whose_subject_is_not_a_user_id_is_rejected() -> Result<(), Box<dyn Error>> {
    let mut engine = Engine::open().await?;
    let claims = json!({ "sub": "admin", "exp": 4_102_444_800_u64 });
    let token = jsonwebtoken::encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(engine.jwt_secret()?.as_bytes()),
    )?;

    let reply = engine.call_as(&token, ME, &json!({})).await?;

    assert_reason(&reply, ErrorReason::TokenInvalid);
    engine.close().await?;
    Ok(())
}

#[tokio::test]
async fn me_rejects_missing_forged_and_foreign_tokens() -> Result<(), Box<dyn Error>> {
    let mut engine = Engine::open().await?;
    let access = token(&engine.call(SIGN_UP, &ada()).await?.body, "accessToken")?;
    let mut other = Engine::open().await?;
    let foreign = other.token("ada").await?;

    let missing = engine.call(ME, &json!({})).await?;
    let not_bearer = engine
        .call_with(
            ME,
            &[("authorization", &format!("Basic {access}"))],
            &json!({}),
        )
        .await?;
    let forged = engine
        .call_as(&format!("{access}x"), ME, &json!({}))
        .await?;
    let from_other_engine = engine.call_as(&foreign, ME, &json!({})).await?;

    assert_reason(&missing, ErrorReason::TokenInvalid);
    assert_reason(&not_bearer, ErrorReason::TokenInvalid);
    assert_reason(&forged, ErrorReason::TokenInvalid);
    assert_reason(&from_other_engine, ErrorReason::TokenInvalid);
    engine.close().await?;
    other.close().await?;
    Ok(())
}

#[tokio::test]
async fn a_token_for_a_user_this_engine_lacks_is_user_not_found() -> Result<(), Box<dyn Error>> {
    let mut engine = Engine::open().await?;
    let access = engine.token("ada").await?;
    let mut sharing_secrets = Engine::open_with_secrets_of(&engine).await?;

    let reply = sharing_secrets.call_as(&access, ME, &json!({})).await?;

    assert_reason(&reply, ErrorReason::UserNotFound);
    engine.close().await?;
    sharing_secrets.close().await?;
    Ok(())
}

#[tokio::test]
async fn a_database_failure_is_an_internal_error() -> Result<(), Box<dyn Error>> {
    let mut engine = Engine::open().await?;
    engine.close().await?;

    let check = engine
        .call(CHECK_ACCOUNT, &json!({ "login": "ada" }))
        .await?;
    let logout = engine
        .call(LOGOUT, &json!({ "refreshToken": "issued-earlier" }))
        .await?;

    assert_internal(&check, "db: ");
    assert_internal(&logout, "db: ");
    Ok(())
}
