---
profile: default
layer: carrier
---

# Default profile — the carrier layer

The fields this pack resolves. They say **where an artefact lives and how it is
written down**, which is all this pack claims authority over.

Register, word limits, section names, how many tables the main text carries,
where the statistic sits in a sentence — none of that is here, and this file
names nothing that resolves it. Those are out of scope: this profile describes
what the compiler needs, and stops there.

## Export

| Field | Value |
|---|---|
| `export_pipeline` | **PaperBell** — Markdown → Pandoc ≥ 3.0 → xelatex → PDF or Word. The syntax is [`../references/paperbell-format.md`](../references/paperbell-format.md), and the chain is [`../references/pipeline.md`](../references/pipeline.md) |
| `assets` | `figs/` beside the note; that is what the export's resource path covers |
| `crossrefs` | `\ref{fig:x}` and `\ref{tbl:x}` for both figures and tables — never `@fig:`/`@tbl:` |

## Tables

| Field | Value |
|---|---|
| `table_workbook` | **One workbook per project**, at `<manuscript_dir>/figs/<Acronym>_Tables.xlsx`. A table is never hand-written into the prose; the manuscript carries a pointer to a sheet |
| `sheet_naming` | `Table N` for a main-text table, `Table SN` for an SI one. The prefix is load-bearing — it says which document the sheet belongs to — but **the digits are only an identifier, not the printed number**: LaTeX numbers floats by order of appearance, so a sheet named `Table S10` can print as *Table S9*. `_index` is the registry; any other `_`-prefixed sheet is working data and is never exported |
| `table_source` | Every exported sheet has an `_index` row naming where its numbers came from — a `results.json` key, a script path, or a citation. A sheet with no source is a table whose numbers cannot be traced |

## Review annotations

| Field | Value |
|---|---|
| `annotation_syntax` | **CriticMarkup** — [`../references/criticmarkup.md`](../references/criticmarkup.md) |
| `annotations_at_export` | **None survive.** Nothing in the chain strips them, and two of the six print as plausible typography |
| `persistent_note_form` | `%%…%%` or `::: {.hidden}` — `div.lua` strips both on the PDF path, but not on the Word path |
