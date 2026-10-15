# Skills

English | [中文](README.zh.md)

Skills are reusable workflows and specialized decision standards that an agent loads on demand: documentation placement, prose review, and per-language code style. Product and runtime contracts live in docs or source; standing orders live in the root `AGENTS.md`.

## Layout and naming

- Each skill is a directory `lemma-<topic>/` holding one `SKILL.md`. The `lemma-` prefix separates repository skills from user-level and tool-bundled skills.
- `SKILL.md` opens with frontmatter: `name` equals the directory name, and `description` states when to load the skill.
- Long source material, such as an upstream style guide, lives under `references/` inside the skill directory and is read on demand.
- Skills are English only, per the [bilingual contract](../../docs/i18n/README.md#scope-and-exclusions).

## Planned skills

A document may reference a skill before it exists by writing its code-formatted path, such as `.agents/skills/lemma-doc/SKILL.md`. Searching the repository for `` `.agents/skills/ `` lists every planned skill and the places that rely on it. Creating a skill converts each of those references into a link in the same change ([repository references](../../docs/AGENTS.md#repository-references)).
