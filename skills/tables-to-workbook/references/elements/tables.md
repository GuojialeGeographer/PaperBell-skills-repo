# Tables — the `xlsx-table` block

A table is **never** hand-written Markdown. It is a sheet in a workbook,
embedded by `xlsx_table.lua`, which reads the sheet at export time and emits a
booktabs three-line table. Which sheet, in which workbook, and how the workbook
is organised is the job of `/tables-to-workbook`; this is the block that points
at it.

````markdown
```xlsx-table
file: CollMemo_Tables.xlsx
sheet: Table S1
caption: Climate information from different archives.
label: tbl:s1
skip_n: 1
```
````

| Key | Default | Does |
|---|---|---|
| `file` | — **required** | Workbook, resolved on the resource path (so: in `figs/`) |
| `sheet` | first sheet | Which sheet to render |
| `caption` | none | **Presence promotes the table to a numbered float.** Without it the table is inlined and unnumbered — and any `\ref` to it dangles |
| `label` | none | The `\label`, referenced as `Table \ref{tbl:x}` |
| `notes` | none | Small-font notes under the table; takes `^superscript^`, `*em*`, `$maths$` |
| `skip_n` | `0` | Drop *n* leading rows; the next row becomes the header |
| `range` | used area | `A1:E6`-style crop |
| `align` | auto | Verbatim column spec — `llrll`, `p{}`, `>{}`, `\|` |
| `widths` | — | Per column: blank = natural, `0.3` = 30% of the line, `3cm` |
| `fontsize` | `small` | A size word or a point value |
| `placement` | `!ht` | Float placement, captioned floats only |
| `decimals` | — | Round numeric cells to *n* places; float noise is cleaned regardless |
| `landscape` | `false` | Rotated page plus `longtable` — for wide tables |
| `longtable` | `false` | Break a long table across pages, repeating the header |

Column width priority: `align` > `widths` > **the column widths set in Excel**,
normalised to the line width > automatic `l`/`r`. A sheet that fits one page in
Excel fits the page here.

Inside a cell: `$maths$` passes through, `[@citekey]` is resolved by the normal
citeproc pass, and merged cells render as their value in the first row with the
spanned rows blank.

**Values, not formulas.** The filter reads each cell's cached value (`<v>` in
the sheet XML). A formula written by a library that does not compute it —
`openpyxl` among them — has no cached value, so the cell renders **empty** in
the PDF with no error anywhere. Store computed numbers.

## The sheet name is an identifier, not a number

`Table N` for a main-text sheet, `Table SN` for an SI one. The **prefix** is
load-bearing: it says which document the sheet belongs to, and a `Table S3`
pointed at from the main text is a defect.

The **digits are not the printed number.** LaTeX numbers floats by order of
appearance in the compiled document, so a sheet named `Table S10` prints as
*Table S9* whenever it happens to come ninth. Real projects drift this way and
it is not an error — it is what the numbering rule means. Two consequences:

- Never read a table's number off a sheet name, a filename, or a label.
  `\ref{tbl:x}` is the only thing that stays right.
- Make labels **semantic** (`tbl:params`), not positional (`tbl:s1`). A
  positional label does not break anything, but it stops being true silently.

Where a project harvests the compiled numbers, `table-numbers.json` records what
each label actually printed as — see
[`../project/registries.md`](../project/registries.md). That file, not the sheet
name, is the authority.
