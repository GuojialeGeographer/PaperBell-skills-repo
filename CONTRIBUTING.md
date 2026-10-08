# Contributing to paperbell-skills-market

Thanks for sharing a skill! Skills from this repo are installed into real users'
vaults, and agents run the scripts they ship on users' machines — so every
contribution goes through a light but strict gate. 欢迎中文 PR / issue。

## The flow

1. **Fork** and branch.
2. **Add your skill** under `skills/<id>/` (see below).
3. **Run the checks**: `npm ci && npm run sync && npm run validate && npm run scan:security && npm test && npm run test:python`.
4. **Open a PR.** CI runs the same checks, the version gate and the PR scope gate.
5. Merged skills ship in the next tagged **release** (`index.json`).

## Adding a skill

```
skills/<id>/
  SKILL.md        required — frontmatter `name: <id>` and `description:`
  skill.yaml      required — market metadata (not installed)
  references/     optional — docs the skill points at
  scripts/        optional — code the agent runs (security-scanned)
  assets/         optional — templates, data
  tests/          optional — your tests (not installed); *.test.mjs or test_*.py
```

- `<id>` is lowercase kebab-case and equals the directory name, the SKILL.md
  `name`, and `skill.yaml` `id`.
- `SKILL.md` paths are **relative to the skill directory** (`references/x.md`,
  `python3 scripts/check.py`) — that is where they land once installed.
- Start `version` at `1.0.0`. `tier: community` for contributions; `core` is for
  skills the PaperBell team maintains.
- `title` and `description` are bilingual (`en` + `zh`) — the plugin shows them
  in the market.
- **Agents.** A single-file skill (just `SKILL.md`) works everywhere; omit
  `agents`. A skill with any other file **must** list `agents` and only
  directory-type agents (`claude-code`, `github-copilot`, `openai-codex`,
  `gemini-cli`) — Cursor / Windsurf / Cline take one `.md` per skill.
- `free: true` makes the skill installable for free PaperBell users (default
  `false`).
- `requires:` lists other skill ids installed first; no cycles.

Full field reference: [README](README.md#skillyaml).

### Hard limits (CI)

- No symlinks anywhere in `skills/`, `shared/`, `catalog/`.
- No packaged file over 1 MB.
- Not packaged: `skill.yaml`, the `readme` file, `tests/`, `__pycache__`, dotfiles.

## Shared resources

Resources used by **several** skills go in `shared/` once and are declared in
each skill's `skill.yaml`:

```yaml
shared: [references, scripts, LICENSE]   # paths under shared/
```

`shared/references/**` then installs at `<skill>/references/**`. Each skill dir
also carries a committed mirror of its shared files (so Claude Code's
copy-the-directory install works). **Edit `shared/` only**, then run
`npm run sync`; `npm run validate` fails on a missing, stale or orphaned mirror.
A resource used by exactly one skill belongs in that skill's own directory.

## Versions

Every skill and bundle has its **own** semver, independent of the release tag.
If you change any file a skill ships — including a `shared/` file it declares —
bump that skill's `version`; CI runs
`node scripts/check-versions.mjs --base origin/main` and fails otherwise. Run
`npm run sync` after bumping (the marketplace manifest carries versions).

## Security

`npm run scan:security` scans every `.py .mjs .js .cjs .sh .ts` a skill ships
(own files and `shared/`; not `tests/`) and blocks:

| Rule | Catches |
|---|---|
| `rm-rf` | `rm -rf`, `shutil.rmtree`, recursive `rmSync`, `rimraf` |
| `pipe-to-shell` | `curl … \| sh`, `wget … \| bash` |
| `dynamic-eval` / `sh-eval` | `eval` / `exec` / `new Function` (incl. of fetched content) |
| `child-process-shell` | `child_process` with `shell: true` |
| `os-system` / `subprocess-shell` | `os.system`, `os.popen`, `subprocess(…, shell=True)` |
| `abs-path-write` / `sh-abs-redirect` | writes to `/…` or `~/…` |
| `home-dir` | `expanduser`, `Path.home()`, `os.homedir()` |
| `network-host` | an `http(s)://` host not on the allowlist in `scripts/lib/security.mjs` |
| `secret-env` | reading env vars named `*KEY*`, `*TOKEN*`, `*SECRET*`, `*PASSWORD*` |

A legitimate use needs a maintainer-reviewed entry in `.security-allowlist.json`:

```json
[{ "file": "skills/foo/scripts/fetch.py", "pattern": "network-host", "reason": "Reads the public ROR API to resolve institutions; no credentials." }]
```

Scripts should take paths as arguments and work inside the vault / cwd; prefer
the Python standard library or Node built-ins.

## You add; you don't overwrite

By default a PR may only **add new skills**. Adding, modifying, deleting or
renaming files in any of these needs a maintainer to apply the `core-change`
label (checked by the *PR scope* workflow; a rename is checked at both ends):

- an existing skill whose `tier` is `core`
- `shared/`, `scripts/`, `test/`, `catalog/`, `.github/`
- `package.json`, `package-lock.json`, `.security-allowlist.json`, `docs/CONTRACT.md`

Community skills can be updated by their authors without the label (with a
version bump). Adding a new `catalog/bundles/<id>.yaml` needs no label either.
`.claude-plugin/marketplace.json` is generated and exempt.

Maintainers: apply the label when opening the PR (`gh pr create --label core-change`);
labelling later re-runs only the seconds-long *PR scope* workflow.

## Bundles

`catalog/bundles/<id>.yaml` installs several skills at once:

```yaml
id: manuscript-formatting
version: 1.0.0
title:       { en: ..., zh: ... }
description: { en: ..., zh: ... }
skills: [paperbell, tables-to-workbook, track-changes]
```

Bundle ids must not collide with skill ids (both become Claude Code plugins).

## Changing the contract

`docs/CONTRACT.md` is shared with the PaperBell plugin. Any field change bumps
`schemaVersion` and must land together with the plugin-side types
(`src/services/skill-market/types.ts`).
