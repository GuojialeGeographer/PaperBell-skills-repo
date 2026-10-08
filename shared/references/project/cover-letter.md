# The cover letter

The one document in a longform project that is **not** assembled from scenes. It
is a `format: single` draft, hand-written, exported in one step — so unlike the
manuscript and the SI, the file you edit is the file that compiles.

```yaml
---
longform:
  format: single
  title: ColMemo_MS
  draftTitle: Cover_letter
  workflow: PaperBell Cover Letter
title: Cover letter — revised submission
manuscript: Archival and palaeoenvironmental documentation of historical …
date: 2026-07-07
to: Dear Dr. …,
corresponding: Shuang Song (song@gea.mpg.de)
---
```

| Key | Does |
|---|---|
| `manuscript` | The paper's title, printed in the letter's opening |
| `to` | The salutation line, verbatim |
| `corresponding` | Name and address of the corresponding author |

Note that `corresponding` here is a **name plus address**, not the bare email
address the manuscript frontmatter wants
([`../elements/frontmatter.md`](../elements/frontmatter.md)). The two keys share
a name and not a format.

## Placeholders

The journal name is not typed:

```markdown
well suited to the broad, interdisciplinary readership of *{{JournalName}}*
```

It resolves from `metadata.json` at compile — see [`numbers.md`](numbers.md) —
which is what keeps the cover letter, the manuscript frontmatter and the
deposition record naming the same venue. `cover_letter.lua` reads the same file
for `PaperTitle`, `AuthorName` and `AuthorEmail`, looking in the note's own
directory and one level up.

Retyping the journal name is the defect this prevents, and it is a costly one:
a cover letter addressed to the wrong journal is the single most visible
formatting error a submission can carry.

## Body

Plain prose. Bold is used for the rhetorical beats a skimming editor should
land on — *"First, it **sharpens the central question**"* — and for nothing
else.
