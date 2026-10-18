# Skills

English | [中文](README.zh.md)

Skills are reusable workflows and specialized decision standards that an agent loads on demand: documentation placement, prose review, translation, error handling, client UI, test reliability, simplification surveys, pre-push checks, commit messages, and per-language code style. Product and runtime contracts live in docs or source; standing orders live in the root `AGENTS.md`.

## Layout and naming

- Each skill is a directory `lemma-<topic>/` holding one `SKILL.md`. The `lemma-` prefix separates repository skills from user-level and tool-bundled skills.
- `SKILL.md` opens with frontmatter: `name` equals the directory name, and `description` states when to load the skill.
- Material needed only for some tasks, such as an upstream style guide, calibration examples, or a diagnosis workflow, lives under `references/` inside the skill directory and is read on demand.
- Skills are English only, per the [bilingual contract](../../docs/i18n/README.md#scope-and-exclusions).
