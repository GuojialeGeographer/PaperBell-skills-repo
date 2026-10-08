---
name: tables-to-workbook
description: Put every table a manuscript needs into the project's one spreadsheet workbook — one sheet per table, each registered with the source of its numbers — and leave only a pointer in the prose. Use when a draft needs a table, or when a hand-written markdown table has to move into the workbook.
---

# Tables to workbook

A table is data, not prose. Its home is the project's **single workbook**, one
sheet per table; the manuscript carries a pointer to that sheet and nothing else.

Two defects this prevents, and they are the reason the rule is absolute. A table
typed into markdown carries hand-typed numbers whose only copy is the prose — the
one thing this pack forbids. And it is typeset outside the house style: the
export builds three-line booktabs tables from the workbook, so a markdown table
compiles as a plain grid, sized and referenced by different machinery from every
other table in the paper.

## 1. Find the workbook

`<manuscript_dir>/figs/<Acronym>_Tables.xlsx`, where `<Acronym>` is the
frontmatter `acronym` — for example `ColMemo_MS/figs/ColMemo_Tables.xlsx`. It
sits in `figs/` because that is where the export resolves assets
(`references/elements/figures.md`).

**One workbook per project.** Main-text tables and SI tables share it; the sheet
name says which. If a second workbook already exists, merge it and delete it —
two workbooks is how a number comes to have two values.

Sheet naming:

| Sheet | Holds |
|---|---|
| `Table 1`, `Table 2`, … | A main-text table |
| `Table S1`, `Table S2`, … | An SI table |
| `_index` | The registry — step 3 |
| `_<anything>` | Working data, never exported |

The `S` says which document the sheet belongs to, and that part is checked. The
digits are **an identifier, not the printed number** — LaTeX numbers floats by
order of appearance, so a sheet named `Table S10` prints as *Table S9* if it
happens to come ninth. Never derive a number from a sheet name; use `\ref{}`.

## 2. Write the sheet

One layout, so every block that points at a sheet is configured the same way:

| Row | Holds |
|---|---|
| 1 | The caption, in column A — the sheet is then self-describing when opened |
| 2 | The header: one column name per column, with its unit |
| 3+ | The data, one row per case, ordered by the argument |

Because row 1 is the caption, **every block carries `skip_n: 1`**.

- **Values, not formulas.** The export reads cached cell values; a formula
  written by `openpyxl` has none, and the cell renders blank in the PDF with no
  error. Compute in Python, write the number.
- **Numbers come from where the paper's numbers come from** — a `results.json`
  key, a script, or a citation for borrowed rows. Never retyped from a figure or
  a log. This skill does not decide whether a number is right — it records which
  source it came from, so someone else can.
- **Set the column widths in Excel** if the default layout is wrong. The export
  normalises them to the text width, so a sheet that fits one page in Excel fits
  the page in the PDF.
- Merged cells render as the value in the first row with the spanned rows blank.
  A cell may hold `$maths$` and `[@citekey]`.

```python
import openpyxl
wb = openpyxl.load_workbook(path)          # create with Workbook() if absent
ws = wb.create_sheet("Table S1")
ws.append(["Parameters of the memory model, with the range each was swept over."])
ws.append(["Parameter", "Symbol", "Default", "Swept range"])
ws.append(["Memory length", "$L_{\\max}$", 20, "5–50"])
wb.save(path)
```

## 3. Register it in `_index`

One row per exported sheet, five columns:

| `sheet` | `label` | `caption` | `source` | `updated` |
|---|---|---|---|---|
| `Table S1` | `tbl:params` | Parameters of the memory model… | `results.json:sweep_bounds` | 2026-08-12 |

`source` is the Trace landing point: the results key, the script path, or the
citation the rows came from. A sheet with no source is a table whose numbers
cannot be checked, which is the same defect as a claim with no citation.

Make the `label` **semantic** (`tbl:params`), not positional (`tbl:s1`).
Renumbering a table then renames one sheet and edits one `_index` row, instead of
chasing every `\ref` in the manuscript — and a positional label goes wrong
silently the moment the printed number stops matching it.

## 4. Point the manuscript at it

Under the PaperBell pipeline, a fenced `xlsx-table` block at the place the table
belongs, and `Table \ref{tbl:params}` in the prose — never `@tbl:params`. The
block's keys, and what happens when `caption:` is missing, are in
`references/elements/tables.md`.

````
```xlsx-table
file: ColMemo_Tables.xlsx
sheet: Table S1
caption: Parameters of the memory model, with the range each was swept over.
label: tbl:params
skip_n: 1
```
````

Under any other pipeline the workbook stays the single source: point at the sheet
in a comment where the table belongs, and generate the submission's table from
that sheet at build time. Do not paste the values into the prose.

## 5. Verify

```
python3 scripts/check_tables.py MANUSCRIPT.md
python3 scripts/check_tables.py SUPPLEMENTARY.md --kind si
```

Then open the exported PDF and look at the table. A blank cell where the sheet
has a value means a formula with no cached value; `Table ??` means the block
errored or `caption:` is missing.

## Completion criterion

Every table in the manuscript is a sheet in the one workbook; every sheet is row
1 caption, row 2 header, data below; every exported sheet has an `_index` row
naming the source of its numbers; every block carries `caption:` and `label:`;
every label is referred to at least once with `\ref{}` and every `\ref{tbl:…}`
resolves; `check_tables.py` reports no HARD findings; and any sheet whose source
you could not establish is reported to the user rather than left blank.

## Reference

- `references/elements/tables.md` — the `xlsx-table` block and the sheet-name rule
- `references/elements/crossrefs.md` — why both figures and tables take `\ref{}`
- `profiles/default.md` — `table_workbook`, `sheet_naming`, `table_source`
- `scripts/check_tables.py` — `--list-checks` for what is enforced
