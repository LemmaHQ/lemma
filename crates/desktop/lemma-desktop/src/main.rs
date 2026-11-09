//! Starts the Lemma desktop application.

#![windows_subsystem = "windows"]

use std::io;

use gpui_kit::component::TitleBar;
use gpui_kit::{AppContext, Bounds, WindowBounds, WindowOptions, px, size};
use lemma_desktop::{AppAssets, EngineRuntime, InterfaceLanguage, Language, LemmaApp, lemma_theme};

fn main() -> io::Result<()> {
    let runtime = EngineRuntime::new()?;
    let data_dir = dirs::data_dir()
        .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "no data directory"))?
        .join("Lemma");
    let language = match sys_locale::get_locale() {
        Some(locale) if locale.starts_with("zh") => Language::Zh,
        _ => Language::En,
    };
    gpui_kit::application()
        .with_assets(AppAssets)
        .run(move |cx| {
            gpui_kit::init(cx);
            cx.set_global(runtime);
            InterfaceLanguage::set(language, cx);
            let options = WindowOptions {
                window_bounds: Some(WindowBounds::Windowed(Bounds::centered(
                    None,
                    size(px(1200.), px(800.)),
                    cx,
                ))),
                ..TitleBar::window_options()
            };
            let opened = gpui_kit::open_window(options, cx, |window, cx| {
                lemma_theme::follow_system(window, cx);
                cx.new(|cx| LemmaApp::new(data_dir, window, cx))
            });
            if opened.is_err() {
                cx.quit();
            }
        });
    Ok(())
}
