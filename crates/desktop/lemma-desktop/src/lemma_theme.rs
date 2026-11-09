//! Lemma's generated light and dark gpui-kit themes.

use std::rc::Rc;
use std::sync::LazyLock;

use gpui_kit::component::{Theme, ThemeConfig, ThemeMode, ThemeSet};
use gpui_kit::{App, Window};

const THEME_SET: &str = include_str!(concat!(env!("OUT_DIR"), "/lemma-theme.json"));

thread_local! {
    static THEMES: LazyLock<[Rc<ThemeConfig>; 2]> = LazyLock::new(load_themes);
}

/// Installs the generated Lemma theme for `mode` and refreshes every window.
///
/// # Panics
///
/// Panics if the generated theme does not contain exactly its light and dark configurations.
pub fn apply(mode: ThemeMode, _window: Option<&mut Window>, cx: &mut App) {
    THEMES.with(|themes| {
        let config = match mode {
            ThemeMode::Light => &themes[0],
            ThemeMode::Dark => &themes[1],
        };
        Theme::update(cx, |theme| theme.apply_config(config));
    });
}

/// Installs the generated theme matching the window's current system appearance.
///
/// # Panics
///
/// Panics under the conditions documented by [`apply`].
pub fn follow_system(window: &mut Window, cx: &mut App) {
    let mode = ThemeMode::from(window.appearance());
    apply(mode, Some(window), cx);
}

#[expect(
    clippy::unwrap_used,
    reason = "the desktop generator always emits valid JSON with light and dark themes"
)]
fn load_themes() -> [Rc<ThemeConfig>; 2] {
    let theme_set = serde_json::from_str::<ThemeSet>(THEME_SET).unwrap();
    let [light, dark] = theme_set.themes.try_into().unwrap();
    [light, dark].map(Rc::new)
}

#[cfg(test)]
mod tests {
    use gpui_kit::component::ActiveTheme;
    use gpui_kit::{AppContext, EmptyView, Hsla, TestAppContext, px, rgb};

    use super::*;

    #[gpui_kit::test]
    fn applies_generated_light_and_dark_theme_values(cx: &mut TestAppContext) {
        cx.update(gpui_kit::init);
        cx.update(|cx| {
            apply(ThemeMode::Light, None, cx);
            assert_eq!(
                cx.theme().background,
                Hsla::from(rgb(0xffffff)),
                "light background"
            );
            assert_eq!(cx.theme().title_bar, Hsla::from(rgb(0xfafafa)), "title bar");
            assert_eq!(cx.theme().font_size, px(16.), "base font size");
            assert_eq!(cx.theme().radius, px(8.), "medium radius");
            assert_eq!(cx.theme().radius_lg, px(12.), "large radius");

            apply(ThemeMode::Dark, None, cx);
            assert_eq!(
                cx.theme().background,
                Hsla::from(rgb(0x1c1c1f)),
                "dark background"
            );
            assert_eq!(cx.theme().sidebar, Hsla::from(rgb(0x141416)), "sidebar");
            assert_eq!(cx.theme().warning, Hsla::from(rgb(0xfbbf24)), "warning");
        });
    }

    #[gpui_kit::test]
    fn follows_the_window_appearance(cx: &mut TestAppContext) {
        cx.update(gpui_kit::init);
        let window = cx.add_window(|_, _| EmptyView);
        let result = cx.update_window(window.into(), |_, window, cx| {
            apply(ThemeMode::Dark, None, cx);
            follow_system(window, cx);
            assert_eq!(
                cx.theme().background,
                Hsla::from(rgb(0xffffff)),
                "test windows use light appearance"
            );
        });
        assert!(result.is_ok(), "window update failed: {result:?}");
    }
}
