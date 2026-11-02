//! The Lemma server's HTTP application: an API router with the embedded
//! web build as fallback, behind an open CORS policy.

mod http_server;
mod web;
mod web_dist;

pub use http_server::{app, serve};
