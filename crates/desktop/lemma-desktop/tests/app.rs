//! The desktop window end to end: engine startup, sign-in and sign-up, turns, stopping, and session switching.

mod common;

use std::fs;

use tempfile::TempDir;

use common::{Desktop, PASSWORD, Seed, USERNAME};
use gpui_kit::test::{TestQueryExt, TestWindowExt};
use gpui_kit::{SharedString, TestAppContext};

#[gpui_kit::test]
fn an_engine_that_cannot_open_shows_why(cx: &mut TestAppContext) {
    let dir = TempDir::new().unwrap_or_else(|error| panic!("temporary directory: {error}"));
    let blocker = dir.path().join("blocker");
    fs::write(&blocker, "").unwrap_or_else(|error| panic!("write the blocking file: {error}"));
    let desktop = Desktop::open_at(cx, &blocker.join("data"));
    desktop.wait_for(cx, "engine-failure");
    desktop.act(cx, |window, _| {
        let failure = window.find("engine-failure");
        assert!(
            failure.label().is_some_and(|detail| !detail.is_empty()),
            "the startup error is shown"
        );
        assert!(
            window.try_find("identifier").is_none(),
            "no sign-in without an engine"
        );
    });
}

#[gpui_kit::test]
fn an_unknown_account_signs_up_with_its_email_prefilled(cx: &mut TestAppContext) {
    let desktop = Desktop::open(cx, Seed::Empty);
    desktop.wait_for(cx, "identifier");
    desktop.act(cx, |window, cx| {
        window.click("identifier", cx);
        window.input("grace@example.com", cx);
        window.press("enter", cx);
    });
    desktop.wait_for(cx, "username");
    desktop.act(cx, |window, cx| {
        assert_eq!(
            window.find("email").value(),
            Some("grace@example.com"),
            "email prefilled"
        );
        assert_eq!(
            window.find("username").focused(),
            Some(true),
            "the first empty field has focus"
        );
        window.input("grace", cx);
        window.click("new-password", cx);
        window.input(PASSWORD, cx);
        window.click("confirm-password", cx);
        window.input("password2", cx);
        window.click("submit", cx);
        assert_eq!(
            window.find("auth-error").label(),
            Some("Passwords do not match"),
            "mismatched passwords are caught before the call"
        );
        window.press("backspace", cx);
        window.input("1", cx);
        window.press("enter", cx);
    });
    desktop.wait_for(cx, "new-session");
}

#[gpui_kit::test]
fn a_wrong_password_is_reported_and_the_account_can_change(cx: &mut TestAppContext) {
    let desktop = Desktop::open(cx, Seed::Account);
    desktop.wait_for(cx, "identifier");
    desktop.act(cx, |window, cx| {
        window.click("identifier", cx);
        window.input(USERNAME, cx);
        window.click("submit", cx);
    });
    desktop.wait_for(cx, "password");
    desktop.act(cx, |window, cx| {
        window.click("password", cx);
        window.input("wrong-password", cx);
        window.click("submit", cx);
    });
    desktop.wait_for(cx, "auth-error");
    desktop.act(cx, |window, cx| {
        assert_eq!(
            window.find("auth-error").label(),
            Some("Incorrect username or password"),
            "rejected credentials"
        );
        window.click("change-account", cx);
        assert!(
            window.try_find("password").is_none(),
            "back to the account step"
        );
        assert!(
            window.try_find("auth-error").is_none(),
            "the error is cleared"
        );
        window.click("switch-step", cx);
        assert!(
            window.try_find("username").is_some(),
            "sign-up is one click away"
        );
        window.click("switch-step", cx);
        assert_eq!(
            window.find("identifier").value(),
            Some(USERNAME),
            "the account is kept"
        );
        window.click("submit", cx);
    });
    desktop.wait_for(cx, "password");
    desktop.act(cx, |window, cx| {
        window.click("password", cx);
        window.input(PASSWORD, cx);
        window.press("enter", cx);
    });
    desktop.wait_for(cx, "new-session");
}

#[gpui_kit::test]
fn a_message_streams_its_reply_into_a_new_session(cx: &mut TestAppContext) {
    let desktop = Desktop::open(cx, Seed::Account);
    desktop.sign_in(cx);
    desktop.wait_for_label(cx, "answer");
    desktop.act(cx, |window, cx| {
        window.input("ping 中文", cx);
        window.click("send", cx);
    });
    desktop.wait_for_label(cx, "**pong**");
    desktop.act(cx, |window, _| {
        assert!(
            window.try_find_by_label("ping 中文").is_some(),
            "the user message stays"
        );
        assert!(
            window.try_find_by_label("bash finished").is_some(),
            "the tool call finished"
        );
        assert_eq!(
            window.find_by_label("Message the assistant…").value(),
            Some(""),
            "the composer is cleared"
        );
    });
}

#[gpui_kit::test]
fn a_running_reply_can_be_stopped(cx: &mut TestAppContext) {
    let desktop = Desktop::open(cx, Seed::Account);
    desktop.sign_in(cx);
    desktop.wait_for_label(cx, "answer");
    desktop.act(cx, |window, cx| {
        window.input("slow", cx);
        window.press("enter", cx);
    });
    desktop.wait_for(cx, "stop");
    desktop.act(cx, |window, cx| window.click("stop", cx));
    desktop.wait_for_label(cx, "Generation stopped.");
    desktop.wait_for(cx, "send");
}

#[gpui_kit::test]
fn sessions_reopen_from_the_sidebar_and_sign_out_returns_to_sign_in(cx: &mut TestAppContext) {
    let desktop = Desktop::open(cx, Seed::Account);
    desktop.sign_in(cx);
    desktop.wait_for_label(cx, "answer");
    desktop.act(cx, |window, cx| {
        window.input("ping", cx);
        window.press("enter", cx);
    });
    desktop.wait_for_label(cx, "**pong**");
    desktop.act(cx, |window, cx| window.click("new-session", cx));
    desktop.wait_until(cx, "an empty new session", |window, _| {
        window.try_find_by_label("ping").is_none()
    });
    let sessions = desktop.session_ids();
    assert_eq!(sessions.len(), 1, "one session ran a tool");
    let row = SharedString::from(format!("session-{}", sessions[0]));
    desktop.act(cx, |window, cx| window.click(row, cx));
    desktop.wait_for_label(cx, "**pong**");
    desktop.act(cx, |window, cx| window.click("sign-out", cx));
    desktop.wait_for(cx, "identifier");
}
