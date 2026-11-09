//! Generates the desktop interface strings and gpui-kit theme.

use std::env;
use std::path::Path;
use std::process::Command;

fn main() {
    let manifest_dir = env::var("CARGO_MANIFEST_DIR")
        .unwrap_or_else(|error| panic!("CARGO_MANIFEST_DIR is unavailable: {error}"));
    let out_dir =
        env::var("OUT_DIR").unwrap_or_else(|error| panic!("OUT_DIR is unavailable: {error}"));
    let root = Path::new(&manifest_dir).join("../../..");
    for source in [
        "i18n",
        "design/tokens.json",
        "design/read-tokens.ts",
        "design/render-desktop.ts",
        "design/gen-desktop.ts",
    ] {
        println!("cargo:rerun-if-changed={}", root.join(source).display());
    }
    let out = Path::new(&out_dir);
    run_generator(&root, "i18n/gen-desktop.ts", &out.join("strings.rs"));
    run_generator(
        &root,
        "design/gen-desktop.ts",
        &out.join("lemma-theme.json"),
    );
}

fn run_generator(root: &Path, script: &str, output: &Path) {
    let status = Command::new("node")
        .current_dir(root)
        .arg(script)
        .arg(output)
        .status()
        .unwrap_or_else(|error| panic!("failed to run {script}: {error}"));
    assert!(status.success(), "{script} failed with {status}");
}
