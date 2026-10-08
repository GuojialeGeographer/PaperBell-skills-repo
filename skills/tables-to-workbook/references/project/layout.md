# The longform project layout

A single-file document compiles from the file you edit. A **longform project**
does not: the files at the project root are *generated*, and the source of truth
is a directory of scenes.

```
ColMemo_MS/
├── CollMemo_MS_Index.md                     ← draft definition: Manuscript
├── CollMemo_SI_Index.md                     ← draft definition: Supplementary
├── CollMemo_RL_Index.md                     ← draft definition: Response letter
│
├── ColMemo_MS_Manuscript.md                 ← GENERATED
├── ColMemo_MS_Supplementary_Information.md  ← GENERATED
├── ColMemo_MS_Response_letter.md            ← GENERATED
├── ColMemo_MS_Cover_letter.md               ← hand-written (format: single)
│
├── figure-numbers.json  table-numbers.json  ← harvested, see registries.md
├── manuscript-lines.json  si-lines.json     ← harvested
├── results.json  metadata.json              ← authored, see numbers.md
├── <project>.bib                            ← project-local bibliography
│
├── figs/     every image, plus the one tables workbook
└── source/   the scenes — the only files a human edits
```

## The rule

**Never edit a generated artifact.** An edit to `ColMemo_MS_Manuscript.md`
survives exactly until the next compile, and the mistake is invisible while you
are making it: the file is ordinary Markdown in the ordinary place, and it reads
like the manuscript because it *is* the manuscript, one build stale.

Every correction goes into `source/<scene>.md`, or into the index note if it is
frontmatter. The one exception is the cover letter, which is a `format: single`
draft with no scenes and is edited directly.

This is also why a checker should be pointed at the project directory rather
than at the artifact: findings then land on the file that can be fixed.

## `figs/`

Images **and** the tables workbook, flat, one directory. The export's
`--resource-path` covers the note's own directory, `figs/`, and `../figs/` — the
last of which is what lets a scene under `source/` write a bare filename and
still resolve.

Naming is `<Acronym>_`-prefixed and tiered by document, so a stray asset shows
up in a directory listing: `<Acronym>_figure1.png`,
`<Acronym>_SI_<topic>.png`, `<Acronym>_Response_Figure1.png`, and one
`<Acronym>_Tables.xlsx`. Why SI names are topic-based rather than numbered is in
[`../elements/figures.md`](../elements/figures.md).

## `source/`

One file per scene. A scene belongs to exactly one draft, and which one is
decided by the index notes, not by the filename — see
[`scenes-and-index.md`](scenes-and-index.md).
