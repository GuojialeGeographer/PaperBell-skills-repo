---
name: paperbell-note-conventions
description: Frontmatter and template conventions for every note type in a PaperBell 5.x (CIMPO) vault — concept cards, literature/book/movie/clipping inputs, scholars, institutes, grants, daily/weekly notes, projects and outputs. Use before creating or editing any note's frontmatter.
user-invocable: false
---

# PaperBell Note Conventions

Each note type has a home folder, a template in `00 - Obsidian/模板/`, and a
frontmatter schema that plugins and Bases views read. Match the schema exactly:
a misspelled key or a wrong value type silently drops a note out of its views.

General rules:

- **Inputs carry `keywords`; projects and outputs carry `concepts`.**
  `keywords` are free strings; `concepts` are wiki-links to cards, quoted:
  `- "[[Concept]]"`.
- Lists are YAML lists, dates are `YYYY-MM-DD`, booleans are `true`/`false`.
- Add missing fields; never overwrite a field the user or a plugin set.
- Links in frontmatter are quoted wiki-links (`"[[Note]]"`); file paths
  (`banner`, `cover`) are vault-relative, e.g. `00 - Obsidian/img/x.jpg`.

## C — Concept cards · `10 - Cards/Concepts/<name>.md`

```yaml
name: 原子笔记
aliases: [atomic note]   # variant spellings / languages merged into this card
category: concept        # concept | method | model | dataset | … (keyword vs entity)
featured: false          # true = part of the bounded core vocabulary (~50)
related: ["[[卡片盒笔记法]]"]
broader: []
narrower: []
tags: [concept]
```

Cards maintained by Cards Wrangler also carry `source`, `created`, `updated`
and a `%%cw:body%% … %%/cw:body%%` block — never edit inside that block, and
never edit the user's definition callout at the top. People, institutions,
dates and places are **not** cards.

## I — Inputs · `20 - Inputs/…`

Inputs Bell normalises every new input: it fills `input_type`
(`paper | book | movie | clipping | scholar`), `title`, `authors`, `keywords`
(fill-only), localises images into `20 - Inputs/_assets/`, and files the note by
its frontmatter. Do not add `concepts:` to inputs.

**Literature** · `20 - Inputs/Zotero/` (ZotLit, template `zt-*.eta.md`)

```yaml
title: "…"
citekey: lin2024
tags: [paper]
cate: 论文
keywords: [controlled vocabulary, 受控词表]
read: 🤔精读          # reading depth: 浏览 / 初读 / 精读
source: 🔍检索        # how it was found: 更新 / 推荐 / 关联 / 检索
authors: [林知微]
journal: 信息组织研究
paper_date: 2024
date: 2026-01-10      # last modified
important: false
abstract: "…"
```

**Book** · `20 - Inputs/Books/` — `name, cover, tags: [reading], douban_url,
author, isbn, rating, publish, pagecount, date, star, keywords`.
**Movie** · `20 - Inputs/Movies/` — `name, cover, tags: [movie], douban_url,
director, genre, rating, runtime, year, date, star, keywords`.
**Clipping** · `20 - Inputs/Clippings/` (Web Clipper) — `title, source, author,
published, created, description, tags: [clippings], keywords`.

## M — Metadata · `30 - Metadata/…`

**Scholar** · `Scholars/<name>.md` (`学者模板.md`) —
`name, aliases, email: [], title: [], website, photo, institute: [], keywords,
abstract, following_date, tags: [scholar]`. Scholars are people you follow,
not the manuscript's authors.

**Institute** · `Institutes/<name>.md` (`机构模板.md`) —
`name, abbr, aliases, website, location: [lat, lon], logo, tags: [institute]`.
Normally created by Inputs Bell's `40-link-institution` step (ROR lookup from a
scholar's `institute`), not by hand. Omit `location` entirely when the
coordinates are unknown — an empty pair breaks the whole frontmatter.

**Grant** · `Grants/<name>.md` —
`name, slug, grant_no, agency, status, amount, currency, role, apply_date,
result_date, start, end, project: ["[[<project home note>]]"], tags: [grant]`.
The grant points at the project; the project has no `grants` field.

**Daily note** · `DailyNote/YYYY年MM月DD日.md` — `date, tags: DailyNote, week: YYYY-WW`.
**Weekly note** · `WeeklyNote/YYYY年第WW周记录.md` — `tags: WeeklyNote, week: YYYY-WW`.

## P — Projects · `40 - Projects/<name>/<name>.md`

One folder per project; the home note has the folder's name, plus a
`cover.jpg`. Template `项目模板.md`; create projects with PaperBell Project
Manager's "新建科研项目" command when possible.

```yaml
tags: [project/index, project/<acronym>, project/open]
project: PaperBell        # display name = folder name
acronym: PaperBell        # unique; used as the #project/<acronym> tag
long_name: …
type: 研究                # 研究 | 开发 | 管理
stage: 进行               # 探索 | 进行 | 结题 | 归档 | 维护 (the only lifecycle field)
duty: 负责
priority: medium          # high | medium | low
start: 2023-09-27
end:
workload: 4               # hours per week
pi: …
participants: []
related: []
keywords: []              # for finding related inputs / scholars
concepts: ["[[CIMPO]]"]   # featured concepts the project is anchored on
abstract: "…"
banner: 40 - Projects/<name>/cover.jpg
```

Do not use the legacy `status` / `phase` fields — `stage` replaces both.
Milestones are Markdown tasks tagged `#milestone #project/<acronym>`;
`[-]` (cancelled) is removed from the progress denominator. Any note or task
tagged `#project/<acronym>` belongs to the project. Deliverables and grants are
found by back-reference, never listed in the project note.

## O — Outputs · `50 - Outputs/…`

**Draft** · `Drafts/` (`输出笔记模板.md`) —
`cate (引言|方法|结果|讨论), date, tags: [output], concepts: ["[[…]]"],
banner: "00 - Obsidian/img/<cate>.jpg", longform: false`.

**Longform manuscript** · `Longform/<paper>/` — each draft's index note has a
`longform:` **object** (`format, title, draftTitle, workflow, sceneFolder,
scenes, sceneTemplate`), `project: <acronym>` and `concepts:`. Scenes
(`学术长文本模板 Longform academic template.md`) carry `cate, date, scene_alias,
tags: [output, project/<acronym>], longform: true, status`. Authors live only in
the folder's `metadata.json` (`creators`), not in frontmatter.
