//! Sign-up from an unknown account in Chinese: prefilling, focus, and validation.

mod common;

use common::{Desktop, PASSWORD, Seed};
use gpui_kit::TestAppContext;
use gpui_kit::test::TestWindowExt;
use lemma_desktop::Language;

#[gpui_kit::test]
fn sign_up_prefills_the_account_and_focuses_the_first_empty_field(cx: &mut TestAppContext) {
    let desktop = Desktop::open_in(cx, Seed::Empty, Language::Zh);
    desktop.wait_for(cx, "identifier");
    desktop.act(cx, |window, cx| {
        window.click("submit", cx);
        assert!(
            window.try_find("username").is_none(),
            "an empty account does nothing"
        );
        window.click("identifier", cx);
        window.input("grace", cx);
        window.press("enter", cx);
        window.press("enter", cx);
    });
    desktop.wait_for(cx, "username");
    desktop.act(cx, |window, cx| {
        assert_eq!(
            window.find("username").value(),
            Some("grace"),
            "a username is prefilled"
        );
        assert_eq!(
            window.find("email").focused(),
            Some(true),
            "the email is next"
        );
        window.click("switch-step", cx);
        window.click("identifier", cx);
        window.press("secondary-a", cx);
        window.input("grace@example.com", cx);
        window.press("enter", cx);
    });
    desktop.wait_for(cx, "username");
    desktop.act(cx, |window, cx| {
        assert_eq!(
            window.find("email").value(),
            Some("grace@example.com"),
            "an email is prefilled"
        );
        assert_eq!(
            window.find("username").value(),
            Some("grace"),
            "the username is kept"
        );
        assert_eq!(
            window.find("new-password").focused(),
            Some(true),
            "with both filled, the password is next"
        );
        window.input(PASSWORD, cx);
        window.click("confirm-password", cx);
        window.input("password2", cx);
        window.click("submit", cx);
        assert_eq!(
            window.find("auth-error").label(),
            Some("两次输入的密码不一致"),
            "the mismatch is reported in Chinese"
        );
    });
}
