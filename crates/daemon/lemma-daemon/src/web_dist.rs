use rust_embed::Embed;

#[derive(Embed)]
#[folder = "../../../web/dist"]
pub(crate) struct WebDist;
