---
name: paperbell
description: Write a manuscript in the PaperBell export conventions, or convert an existing markdown document to them.
disable-model-invocation: true
---

# PaperBell

The carrier syntax the author's manuscripts compile from: Markdown → Pandoc →
xelatex → PDF or Word. The rules live in `references/`, one page per element; this
is the order to apply them in, and the list of what a conversion has to touch.

**This skill owns encoding only.** What the claim is, how the section is
structured, which register it is written in — untouched here, and out of scope.
A run of this skill should change how the document is written down, not what it
says. If a document also needs its prose worked on, that is a separate job for a
separate tool.

## 1. Settle what the document is

Main manuscript, supplementary information, cover letter, or response to
reviewers. The answer decides the frontmatter `template`, whether the `S`-prefix
block belongs at the top (step 7), and which export command produces the final
file. Ask if it is genuinely ambiguous; do not infer an SI from the filename
alone.

## 2. Frontmatter

`csl`, `acronym`, and `date` are required — a missing `csl` is a missing
bibliography, and `acronym` plus `date` *are* the output filename. Leave
`template` unset unless the document is a cover letter or slides. `corresponding`
takes an email address, which is printed verbatim.

The full key table, and where each key lives in a longform project, are in
`references/elements/frontmatter.md`.

## 3. Body syntax

Headings `#`/`##`/`###`, numbered by the template, with no H1 repeating the
frontmatter title. `*italic*`, `**bold**`, `==highlight==`, standard footnotes.
Maths as `$…$` and `$$…$$`. Nothing here should surprise a Markdown writer; the
surprises are all in the next four steps.

## 4. Figures

```markdown
![Caption text](CollMemo_study_area.png){#fig:study_area width=70%}
```

Attributes **after** the closing paren. The in-caption form
(`![Caption {#fig:x}](…)`) also parses, but `promote_figures.lua` cannot rescue
it when a figure loses its blank line, and the failure is a silent one-off in
every later figure number — `references/elements/figures.md` has the mechanism.

The image file goes in `figs/` beside the note — that is what the export's
resource path covers, so either `figs/name.png` or the bare `name.png` resolves.
Composing the figure itself is out of scope.

## 5. Tables

Hand off to `/tables-to-workbook`, which owns the workbook, the sheet layout, and
the source registry. What this skill needs from it is one `xlsx-table` block per
table, each carrying `caption:` and `label:` — without a caption the table never
becomes a numbered float and every reference to it dangles.

## 6. Citations and cross-references

Citations are `[@key]` against the shared `mybib.bib`; the style follows the
frontmatter `csl`.

**Figures and tables are both referred to with `\ref{}`** — `Figure \ref{fig:x}`,
`Table \ref{tbl:x}`. `@tbl:x` looks right and silently fails, because an
`xlsx-table` has already become raw LaTeX before `pandoc-crossref` runs. One rule,
applied to both.

## 7. Supplementary numbering

An SI document opens, directly after the frontmatter, with the raw-LaTeX block
that prefixes both counters with `S` — quoted in full in
`references/elements/supplementary.md`. The main manuscript never carries it. If the
document is produced through the longform workflow, the **Supplementary
Information** step injects it instead; adding it by hand as well double-prefixes
nothing but is redundant, so pick one.

## 8. Review annotations come out before export

A reviewed draft carries CriticMarkup — `{>>comment<<}`, `{++add++}`,
`{--delete--}`, `{~~old~>new~~}`, `{==highlight==}`, `{=+inserted+=}`, each
optionally prefixed `{author="Claude"…}`. It is a **draft-time layer**: no filter in
the chain knows it, so anything left behind prints. Two forms print *disguised* —
`{==x==}` as a real highlight in stray braces, `{--x--}` with a real en dash — which
is why this is a step and not a note.

Resolve every mark: accept it, reject it, or, if the note must stay with the source,
move it into `%%…%%`, which `div.lua` does strip. Writing the annotations in the
first place is `/track-changes`'s job; the grammar of the prefix is in
`references/criticmarkup.md`.

## 9. Converting an existing document

Everything above, plus the transformations that actually recur:

| Found | Becomes |
|---|---|
| A markdown pipe table | A sheet in the workbook plus an `xlsx-table` block — `/tables-to-workbook` |
| `@fig:x`, `@tbl:x`, `[@fig:x]` | `Figure \ref{fig:x}`, `Table \ref{tbl:x}` |
| `![](image.png)` anywhere but `figs/` | Move the file to `figs/`, path relative |
| An image with no label, referred to in the text | `{#fig:x}` after the parens, `\ref{fig:x}` in the prose |
| `![Cap {#fig:x}](…)` — label inside the caption | Move the braces after the parens; the in-caption form defeats `promote_figures.lua` |
| An H1 repeating the title | Delete it, or demote the whole heading tree |
| `supplementary: true` in the frontmatter | Nothing consumes it — replace with the `S`-numbering block |
| A hand-numbered *"Table 2 shows…"* | `Table \ref{tbl:…}`; hand numbering breaks on the first reorder |
| Any CriticMarkup mark | Resolved, or moved into `%%…%%` — step 8. Never carried into an export |

Wikilinks, `> [!note]` callouts, `::: {.hidden}` divs and `==highlight==` need no
conversion — filters handle them. Dataview queries are stripped at export, so
anything load-bearing inside one has to be written out first.

## 10. Verify

```
python3 scripts/check_tables.py MANUSCRIPT.md
python3 scripts/check_annotations.py MANUSCRIPT.md
```

A document can be perfectly encoded and badly written; these checkers see only
the first. If the prose also needs auditing, that is a different tool's job and
nothing here calls it.

Then export once and read the PDF. Three failures are invisible in the source and
obvious in the output: a blank cell where a formula had no cached value, `Table
??` where a reference did not resolve, and an asset that never arrived because it
was not in `figs/`.

## Completion criterion

Frontmatter carries `csl`, `acronym`, and `date`; every asset referenced by the
document is in `figs/`; every table is an `xlsx-table` block with `caption:` and
`label:`; every figure and table reference is `\ref{}` and resolves; the
`S`-numbering block is present in the SI and absent from the main text;
`check_annotations.py` and `check_tables.py` report no HARD findings; and the
document compiles.

## Reference

- `references/paperbell-format.md` — the index; one page per element beneath it
- `references/criticmarkup.md` — the annotation marks, written by `/track-changes`
