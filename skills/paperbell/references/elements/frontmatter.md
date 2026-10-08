# Frontmatter

```yaml
---
title: "The title"
date: "2026-06-18"        # also the export filename's date part
acronym: "CollMemo"       # export filename = <acronym>_<date>.pdf
csl: "nature"             # nature | apa | pnas — resolves to csl/<csl>.csl
template: paperbell       # optional; empty -> undefined.yaml, the default style
authors:
  - name: "Shuang Song"
    affiliation: [1, 2]
    corresponding: "song@gea.mpg.de"
affiliations:
  - index: 1
    name: "Max Planck Institute of Geoanthropology, Jena, Germany."
---
```

| Key | Rule |
|---|---|
| `csl` | **Required.** A missing style is a missing bibliography, not a default one |
| `acronym`, `date` | **Required.** They *are* the output filename |
| `template` | Omit it. Empty resolves to `undefined.yaml`, which is the house manuscript style; `paperbell` differs only in fonts |
| `corresponding` | An **email address**, printed verbatim after *Corresponding author:*. Writing `"yes"` prints the word *yes* |

## Where these keys actually live

The table above describes a **single-file document** — one `.md` that is
compiled directly. That is the simple case, and the checkers assume it when
handed one file.

A longform project is different, and it is the common case for a manuscript.
There the keys live in the project's **index note**, one per output document,
and the compiled `*_Manuscript.md` at the project root is a *generated* file
that nobody edits. So:

- `csl:` is set on the index note. The generated artifact often carries
  `csl: ""` — that is not a missing style, it is a key that was already consumed.
- `date:` is frequently absent from the index and supplied at build time.
- `template:` is set (`template: pdf`) rather than omitted, because the longform
  workflow selects the preset by name rather than by the empty default.

Editing frontmatter therefore means editing the index note, not the artifact.
The layout, and which key belongs to which file, are in
[`../project/scenes-and-index.md`](../project/scenes-and-index.md).

**Do not "fix" a generated artifact's frontmatter.** The next compile
overwrites it, and the real key is still wrong upstream.
