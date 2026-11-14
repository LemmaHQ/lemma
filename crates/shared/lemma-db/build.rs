//! Recompiles `lemma-db` whenever a SQL migration is added or changed.

fn main() {
    println!("cargo:rerun-if-changed=migrations");
}
