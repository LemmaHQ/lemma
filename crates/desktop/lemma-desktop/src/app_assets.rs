use std::borrow::Cow;

use gpui_kit::assets::{Assets, icon_assets};
use gpui_kit::{AssetSource, Result, SharedString};

icon_assets!(AppIcons, [LogOut, SquarePen]);

/// The GPUI Kit component icons plus the icons only Lemma uses.
#[derive(Debug)]
pub struct AppAssets;

impl AssetSource for AppAssets {
    fn load(&self, path: &str) -> Result<Option<Cow<'static, [u8]>>> {
        match AppIcons.load(path)? {
            Some(bytes) => Ok(Some(bytes)),
            None => Assets.load(path),
        }
    }

    fn list(&self, path: &str) -> Result<Vec<SharedString>> {
        let mut paths = Assets.list(path)?;
        paths.extend(AppIcons.list(path)?);
        paths.sort();
        paths.dedup();
        Ok(paths)
    }
}

#[cfg(test)]
mod tests {
    use gpui_kit::assets::IconName;

    use super::*;

    #[test]
    fn every_icon_the_app_draws_loads() {
        for icon in [
            IconName::ArrowUp,
            IconName::CircleAlert,
            IconName::LogOut,
            IconName::Square,
            IconName::SquarePen,
        ] {
            let path = icon.path();
            assert!(
                matches!(AppAssets.load(path.as_ref()), Ok(Some(_))),
                "{path} loads"
            );
        }
    }

    #[test]
    fn the_icon_list_holds_lemma_and_component_icons_once() -> Result<()> {
        let paths = AppAssets.list("icons/")?;
        for path in [IconName::SquarePen.path(), IconName::ArrowUp.path()] {
            assert_eq!(
                paths.iter().filter(|listed| **listed == path).count(),
                1,
                "{path} listed once"
            );
        }
        Ok(())
    }
}
