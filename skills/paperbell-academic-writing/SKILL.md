---
name: paperbell-academic-writing
description: Academic writing conventions and the PaperBell 5.x (CIMPO) vault structure. Use when drafting, revising or researching inside a PaperBell Obsidian vault — to know where literature, concepts, projects and drafts live, and how a new draft should be linked into them.
---

# PaperBell Academic Writing

This vault is organised by **CIMPO** — five numbered top-level folders, one per
unit of an academic career, plus a configuration folder. Read the relevant
folder before writing; write only where the table below says outputs go.

## Vault structure (PaperBell 5.x)

| Folder | Unit | Holds |
|---|---|---|
| `00 - Obsidian/` | — | Configuration: `模板/` (templates), `脚本/` (scripts), `pandoc/` (export assets), `img/` (banners), `附件/` (attachments). **Never write notes here.** |
| `10 - Cards/Concepts/` | **C**oncepts | One wiki card per concept (keyword or entity). Cards marked `featured: true` form a small, curated core vocabulary (~50). |
| `20 - Inputs/` | **I**nputs | External material: `Zotero/` (literature notes), `Books/`, `Movies/`, `Clippings/` (web clips). Inputs carry `keywords`, never `concepts`. |
| `30 - Metadata/` | **M**etadata | The running log of people, places and time: `Scholars/`, `Institutes/`, `Grants/`, `DailyNote/`, `WeeklyNote/`. |
| `40 - Projects/` | **P**rojects | One folder per long-running project; its home note is `40 - Projects/<name>/<name>.md` (plus `cover.jpg`). |
| `50 - Outputs/` | **O**utputs | Your own writing: `Drafts/` (loose drafts) and `Longform/` (one folder per manuscript project). |

The flow is directed: inputs → concept cards → featured concepts → projects →
outputs, with metadata (people, institutes, diary) searchable from everywhere.
People, institutions, dates and places are **metadata**, never concept cards.

## Before writing: gather context

1. **The project.** Open `40 - Projects/<name>/<name>.md`. Its `concepts:` are
   the anchors the writing should stay inside; its `keywords:` are what to
   search inputs for; `acronym` is the project's tag (`#project/<acronym>`).
2. **Concepts.** Read the cards in `10 - Cards/Concepts/` that the project or
   draft names. A card's `aliases` list the variant spellings to search for.
   Respect the author's own definition — it lives in the card's first callout
   and must not be rewritten.
3. **Literature.** Literature notes are in `20 - Inputs/Zotero/`; each has a
   `citekey`, `authors`, `journal`, `paper_date`, `abstract`, and the author's
   annotations in the body. Find relevant ones by `keywords` (and the concept's
   aliases), not by guessing file names.
4. **People.** Collaborators and reviewers are in `30 - Metadata/Scholars/`.
   Manuscript authorship is *not* taken from there — see Longform below.

## Writing guidelines

- Academic register: precise terminology, hedged claims proportional to the
  evidence, one idea per paragraph, defined acronyms.
- Every factual claim taken from literature carries a citation. Cite with
  Pandoc keys — `[@citekey]`, `[@a2020; @b2021]`, `@citekey` in running text —
  using the `citekey` of the note in `20 - Inputs/Zotero/`. Never invent a key:
  if no note has it, say so and leave a `%% TODO cite %%` marker.
- Link concepts with wiki-links (`[[Concept name]]`) to existing cards. Do not
  create a new concept card to make a link resolve; propose it to the user.
- Keep the author's voice. When revising, change what was asked; propose larger
  rewrites instead of performing them.
- Numbers come from a source (a results file, a table, a cited paper), never
  from memory.

## Where a new draft goes

**Loose draft** — `50 - Outputs/Drafts/<title>.md`, following
`00 - Obsidian/模板/输出笔记模板.md`:

```yaml
---
cate: 方法          # 引言 | 方法 | 结果 | 讨论
date: 2026-10-08
tags:
  - output
concepts:
  - "[[CIMPO]]"     # the cards this output is about — closes the output → concept loop
banner: "00 - Obsidian/img/方法.jpg"
longform: false
---
```

**Manuscript** — a folder under `50 - Outputs/Longform/<project>/`. One folder
holds every draft of the same paper side by side (main manuscript,
supplementary, response letter, cover letter), sharing one `metadata.json`
(authors, affiliations, corresponding author, export template — the single
source of truth for the byline), plus optional `results.json`, a local
`references.bib`, and `figs/` for images. Each draft's index note has a
`longform:` **object** in its frontmatter and `project: <acronym>` pointing back
to the project; scenes use `00 - Obsidian/模板/学术长文本模板 Longform academic template.md`.
Compile the main manuscript before the response letter (the letter cites its
line and figure numbers).

## Do not

- Write into `00 - Obsidian/` (templates, scripts and export assets are
  managed by plugins and overwritten on update).
- Add `concepts:` to input notes, or `keywords` to drafts in place of
  `concepts:`.
- Remove a `concepts:` list that a literature note already carries from
  PaperBell 4.x — migrated notes keep it alongside `keywords`.
- Put people, institutions or dates into `10 - Cards/`.
- Move or rename project folders: the home note must keep the folder's name.
