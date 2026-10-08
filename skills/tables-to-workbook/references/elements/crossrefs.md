# Cross-references — one rule, two habits to unlearn

## Inside one document

| Object | Label it | Refer to it |
|---|---|---|
| Figure | `![…](…){#fig:x}` | `Figure \ref{fig:x}` |
| Table | `label: tbl:x` in the block | `Table \ref{tbl:x}` |
| Reference | the key in the bibliography | `[@key]` |

**Figures and tables are both referred to with native `\ref{}`.**
`pandoc-crossref` would offer `@fig:x`/`@tbl:x`, but an `xlsx-table` has already
become raw LaTeX before crossref runs, so `@tbl:x` never resolves — it prints
literally or leaves `Table ??`. Figures survive as LaTeX floats carrying a real
`\label`, so `\ref` works for them too. One rule beats two, and the one that
works everywhere is `\ref`.

The word *Figure* or *Table* is written by hand in front of the `\ref`; nothing
inserts it. Main-text prose conventionally bolds the whole thing
(`**Figure \ref{fig:overview}a**`), the SI conventionally does not — that is
typography, not a rule.

## Across two documents — there is no `\ref`

A main manuscript and its supplement **compile as separate documents**, so no
label in one is visible from the other. Every MS↔SI reference is therefore
literal prose, written by hand and numbered by hand:

```markdown
(see **Supplementary Information Figure S3**)
**Supplementary Information Table S8**
(corresponding to the main text Figure 4b)
```

This is the one place in the whole carrier where a number is typed rather than
resolved, which makes it the one place a reorder breaks silently: the SI gains a
figure, everything after it shifts, and the main text still says *Figure S3*.
Nothing in the pipeline notices.

Two habits contain it:

- Put the cross-document number in as few places as possible, and never in a
  place a reader will not check.
- Where a project harvests `figure-numbers.json` / `table-numbers.json` after a
  compile, those files say what each label actually printed as, and a
  hand-written *Figure S3* can be checked against them. See
  [`../project/registries.md`](../project/registries.md).

Section references across documents are the same — bold names, not numbers,
wherever a name will do: `(see **Methods**)`, `**Supplementary Information
S2.1**`.
