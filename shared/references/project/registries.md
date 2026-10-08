# The harvested registries

Four JSON sidecars at the project root. All four are **outputs of a compile**,
not inputs: nothing reads them to build the PDF, and editing one changes
nothing. They exist so that facts which only become true at typeset time —
what number a float actually got, what page a sentence landed on — can be
checked and quoted afterwards.

Which means all four **go stale the moment the document changes**, and a stale
registry looks exactly like a fresh one. Re-harvest, or distrust.

## `figure-numbers.json` / `table-numbers.json`

Label → the number that was actually printed.

```json
{ "fig:overview": "1",  "fig:wdi": "2",
  "fig:study_area": "S1", "fig:archive_density": "S2" }
```

Main-text floats get bare digits, SI floats the `S` prefix from the counter.
This is the **authority on numbering** — not a sheet name, not a filename, not
a label. A table on the sheet named `Table S10` appears here as `S9` if that is
where it fell, and the registry is right.

Its use: the one place a number is written by hand is a **cross-document
reference** — the main text saying *"Supplementary Information Figure S3"*,
which no `\ref` can reach because the two documents compile separately
([`../elements/crossrefs.md`](../elements/crossrefs.md)). Those hand-written
numbers can be checked against this file, and nothing else can check them.

## `manuscript-lines.json` / `si-lines.json`

Transclusion anchor → where its span landed in the compiled PDF.

```json
"intro-sbs-def": { "sline": 57, "eline": 68, "page": 2 },
"res-1":         { "fig": "2" }
```

Two record shapes: a prose span gets `sline`/`eline`/`page`; a span living
inside a figure caption gets `{"fig": "N"}`, because it has no line of its own.

Produced by a second, `\linelabel`-instrumented pandoc pass —
`manuscript_linelabel.lua` with `-M mslabels=true` — run by the
`harvest-manuscript-lines` workflow step. That step is **off** for the
manuscript workflow and **on** for the supplementary one, so which file is fresh
depends on what was last built.

Its use: a response letter stamps each quoted box with the page and line range
the revised text now occupies, so a reviewer can find it. The lookup falls back
from `manuscript-lines.json` to `si-lines.json` for SI-only spans.

Note that `si-lines.json` is written as a *superset* — the manuscript's entries
plus the SI-only ones — so the two files overlap rather than partition.

## The one thing not to do

Do not treat a registry as a place to *set* a number. It records what happened.
If the number is wrong, the document is wrong; fix the document and harvest
again.
