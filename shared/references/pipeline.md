# The pipeline — filter order, presets, export, and what a wrong PDF means

Markdown → Pandoc → xelatex → PDF or Word, driven from Obsidian's
**enhanced-export** plugin by the *PaperBell* family of commands.

A chain of Lua filters runs in a fixed order, and **that order is the reason for
most rules in this pack**: anything a filter rewrites into raw LaTeX has already
stopped being Markdown by the time a later filter sees it.

## The chains

`undefined.yaml`, the default:

```
mute → quotes-i18n → image → xlsx_table → codeblock → math → callout →
shift_headings → link → div → preamble → highlight → pandoc-crossref → citeproc
```

`paperbell.yaml`, the manuscript PDF preset, interleaves four more:

```
lineno_default → block_ids → manuscript_linelabel → mute → quotes-i18n →
promote_figures → image → xlsx_table → … → pandoc-crossref → citeproc
```

| Added filter | Does |
|---|---|
| `lineno_default` | line numbers on by default; `lineno: false` in frontmatter disables |
| `block_ids` | strips Obsidian `^blockid` markers |
| `manuscript_linelabel` | a no-op except in the line-harvest pass (`-M mslabels=true`), where `<!--ms:ID-->` becomes `\linelabel` |
| `promote_figures` | rescues a figure that lost its blank line and degraded to an inline image — see [`elements/figures.md`](elements/figures.md) |

`response-letter.yaml` runs a different chain entirely, and **two of its
orderings are load-bearing**:

```
manuscript_include → xlsx_table → manuscript_cite → citeproc → responseletter
```

- `manuscript_include.lua` must run **first**: it pulls the quoted manuscript
  spans in, and everything downstream has to see them as ordinary content.
- `citeproc` must run **before** `responseletter.lua`, or a `[@key]` inside a
  response is wrapped in a letter environment before it can be resolved.

The two **Word** presets (`manuscript-obsidian.yaml`, `demo-obsidian.yaml`) run
a different chain again — no `mute`, no `div`, no `highlight`, and no `mark`
extension — then `manuscript-docx → citeproc → figures-at-end → lineno-docx →
nbsp-fix → cjk_format → fullwidth_tables`, with `lineno:`, `figures-at-end:` and
`tables-at-end:` opt-in.

Anything in this pack that names a filter is therefore a statement about the
PDF path; where the `.docx` path differs, the troubleshooting table says so.

## Export

| Command | Config | Out |
|---|---|---|
| PaperBell | `${template}.yaml`, default `undefined.yaml` | PDF, named `<acronym>_<date>.pdf` |
| PaperBell (Word) | `manuscript-obsidian.yaml` | `.docx` |
| PaperBell (Word, short) | `demo-obsidian.yaml` | `.docx` |
| PaperBell (response letter, draft / final / Word) | `response-letter*.yaml` | PDF / `.docx` |

The response letter's draft/final split is a metadata flag, not a separate
config: `--metadata=draft:true` keeps the Chinese gloss, the status badges and
the inline notes; `draft:false` emits reviewer comment and author response only.

Version-to-version diff, through the same pipeline so the diff matches the final
PDF: `latexdiff-md.sh <FILE.md> [OLD_COMMIT] [NEW_COMMIT]`.

## When the PDF is wrong

| Symptom | Cause |
|---|---|
| *not found on resource-path* | The asset is not in `figs/` |
| The table is missing and `\ref` shows `Table ??` | Same cause: the block errored, so no `\label` was ever emitted |
| A cell is blank that has content in Excel | A formula with no cached value — store the computed number |
| `Table ??` with the table present | `@tbl:x` was used instead of `\ref{tbl:x}`, or `caption:` is missing so the table never became a numbered float |
| **Every figure number is one too low, and one figure has no caption** | A figure lost its blank line and parsed as an inline image. If its label is written inside the caption, `promote_figures.lua` cannot rescue it — move the attributes after the parens |
| A style change had no effect | It was made in the wrong defaults file — with no `template:`, the export uses `undefined.yaml` |
| `0.2109999…` | Set `decimals:` |
| A wide table overflows | `landscape: true`, or `widths:`, or set the column widths in Excel |
| A block quote or callout vanished | `mute.lua` returns `nil` for **every** `BlockQuote`, not only the Dataview ones it means to drop. Any block quote is deleted from the PDF |
| `==highlight==` or `%%comment%%` behaves differently in Word | The `.docx` presets run neither `highlight.lua` nor `div.lua`, and do not enable `mark`. The highlight is lost; the comment is **printed** |
| A stray `{`…`}` or a struck-out phrase nobody wrote | A CriticMarkup annotation was left in the source — [`elements/annotations.md`](elements/annotations.md) |
| A `{{ placeholder }}` printed literally | Its key is missing from `results.json` or `metadata.json` — [`project/numbers.md`](project/numbers.md) |
| An edit to the manuscript disappeared | It was made in the generated artifact, not in the scene — [`project/layout.md`](project/layout.md) |
