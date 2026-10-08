# PaperBell — the carrier syntax

The **encoding** of a document: how a figure, a table, a citation, a
cross-reference and the supplementary numbering are written so the export
pipeline can compile them. This page is the index; one page per element sits
beneath it.

This distils a standard rather than a book, and the standard is local — the
author's own:

| Source | What it fixes |
|---|---|
| The author's **PaperBell 写作与导出规范**, kept in their Obsidian vault | The frontmatter keys, the asset layout, the export commands |
| `.../pandoc/filters/*.lua` — chiefly `xlsx_table.lua`, `image.lua`, `promote_figures.lua`, `math.lua` | What the pipeline actually does, which is occasionally more than the spec says |
| Pandoc ≥ 3.0 · `pandoc-crossref` · xelatex with xeCJK | The compiler behind it all |

**Scope.** This reference owns carrier syntax and nothing else. What the claim
is, how the section is structured, which register it is written in — out of
scope here, and not delegated anywhere either.

## The elements

| Page | Owns |
|---|---|
| [`elements/frontmatter.md`](elements/frontmatter.md) | The required keys, and where they live in a single file vs a longform project |
| [`elements/body-and-math.md`](elements/body-and-math.md) | Headings, emphasis, maths, and which Obsidian constructs survive |
| [`elements/figures.md`](elements/figures.md) | `figs/`, the image form, and why the attributes go after the parens |
| [`elements/tables.md`](elements/tables.md) | The `xlsx-table` block, its keys, and why a sheet name is not a number |
| [`elements/citations.md`](elements/citations.md) | `[@key]`, the bibliography layers, the `csl` style |
| [`elements/crossrefs.md`](elements/crossrefs.md) | `\ref{}` for both figures and tables — and the hand-written case across documents |
| [`elements/supplementary.md`](elements/supplementary.md) | The `S`-prefix block, and why SI labels stay plain |
| [`elements/annotations.md`](elements/annotations.md) | What a leftover CriticMarkup mark compiles to |

## Below the elements

| Page | Owns |
|---|---|
| [`pipeline.md`](pipeline.md) | The filter chains, the presets, the export commands, and the symptom→cause table |
| [`criticmarkup.md`](criticmarkup.md) | The six marks and the attribution prefix |
| [`project/`](project/) | The longform project layer: scenes, index notes, transclusion anchors, number placeholders, and the harvested registries |

## The one fact behind most of the rules

The Lua filters run in a **fixed order**, so anything a filter rewrites into raw
LaTeX has stopped being Markdown by the time a later filter sees it. That is why
`@tbl:x` cannot work, why a figure that lost its blank line loses its number,
and why a CriticMarkup mark prints instead of failing. [`pipeline.md`](pipeline.md)
has the chains.
