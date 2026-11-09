//! Conversation edge cases: sending nothing, sending without a model, follow-up turns, and failures.

mod common;

use common::{Desktop, Seed};
use gpui_kit::test::{TestQueryExt, TestWindowExt};
use gpui_kit::{Role, TestAppContext};

const COMPOSER: &str = "Message the assistant…";

#[gpui_kit::test]
fn without_a_model_the_draft_stays(cx: &mut TestAppContext) {
    let desktop = Desktop::open(cx, Seed::AccountWithoutProvider);
    desktop.sign_in(cx);
    desktop.wait_for_label(cx, "Plans");
    desktop.act(cx, |window, cx| {
        assert!(
            window.try_find_by_label("No provider").is_some(),
            "the composer names the missing provider"
        );
        window.input("ping", cx);
        window.press("enter", cx);
    });
    desktop.act(cx, |window, _| {
        assert_eq!(
            window.find_by_label(COMPOSER).value(),
            Some("ping"),
            "the draft is kept"
        );
        assert!(
            window.try_find_by_label("ping").is_none(),
            "nothing was sent"
        );
    });
}

#[gpui_kit::test]
fn follow_up_turns_report_vendor_and_tool_failures(cx: &mut TestAppContext) {
    let desktop = Desktop::open(cx, Seed::Account);
    desktop.sign_in(cx);
    desktop.wait_for_label(cx, "answer");
    desktop.act(cx, |window, cx| {
        window.press("enter", cx);
        assert!(
            window.try_find("stop").is_none(),
            "an empty draft is not sent"
        );
        window.input("ping", cx);
        window.press("enter", cx);
    });
    desktop.wait_for_label(cx, "**pong**");
    desktop.act(cx, |window, cx| {
        window.input("tool-fails", cx);
        window.press("enter", cx);
    });
    desktop.wait_until(cx, "a failed tool call", |window, _| {
        window.elements().iter().any(|element| {
            element
                .label()
                .is_some_and(|label| label.starts_with("missing failed"))
        })
    });
    desktop.wait_for(cx, "send");
    desktop.act(cx, |window, cx| {
        window.input("fail", cx);
        window.press("enter", cx);
    });
    desktop.wait_until(cx, "the vendor failure", |window, _| {
        !window.find_all_by_role(Role::Alert).is_empty()
    });
    assert_eq!(
        desktop.session_ids().len(),
        1,
        "every turn ran in one session"
    );
}
