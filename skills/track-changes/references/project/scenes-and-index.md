# Scenes and index notes

## The index note

One per output document. It carries the longform assembly instructions *and*
the document's frontmatter, and it is where you edit `csl:`, the title, the
authors — never in the generated artifact.

```yaml
---
project: COFLAB
longform:
  format: scenes
  title: ColMemo_MS
  draftTitle: Manuscript            # → output file ColMemo_MS_Manuscript.md
  workflow: PaperBell Manuscript    # → which compile pipeline runs
  sceneFolder: /source
  scenes:                           # ORDERED — this is the assembly order
    - Introduction
    - Results
    - Discussion
    - Methods
    - Metadata
  ignoredFiles:                     # every scene belonging to another draft
    - Historical data
    - Reviewer 1
    - …
template: pdf
acronym: CollMemo
csl: nature
title: …
abstract: …
authors: [ … ]
affiliations: [ … ]
---
```

| Key | Does |
|---|---|
| `draftTitle` | Names the output: `<title>_<draftTitle>.md` |
| `workflow` | Selects the compile pipeline by name — see below |
| `scenes` | The **ordered** assembly list. Reordering here reorders the document, and renumbers every float after the move |
| `ignoredFiles` | The scenes that belong to the *other* drafts |
| `sceneFolder` | Where the scenes live, project-relative |

`scenes` and `ignoredFiles` together **partition** `sceneFolder`. All three
index notes therefore list all the scenes between them. A scene in neither list
is the failure mode worth watching for: it is not obviously missing from
anywhere, it just quietly stops being part of any document.

The three index notes also duplicate the shared frontmatter — abstract, title,
authors, affiliations — verbatim. Nothing reconciles them, so they drift. When
you change one, change all of them.

## The workflows

| `workflow` | Does |
|---|---|
| `PaperBell Manuscript` | strip frontmatter → concatenate scenes → remove comments (markdown only, **HTML kept**) → substitute `{{ }}` placeholders → add frontmatter from `metadata.json` → write the artifact → export |
| `PaperBell Supplementary` | the same, **plus** the step that injects the `S`-numbering block, plus the line harvest |
| `PaperBell Response Letter` | concatenate → frontmatter → export through the response-letter template |
| `PaperBell Cover Letter` | a single export step; no concatenation |

Two consequences of the manuscript workflow worth knowing:

- **HTML comments are deliberately kept** (`remove-html-comments: false`). That
  is what preserves the `<!--ms:id-->` anchors — see [`anchors.md`](anchors.md).
  Do not "clean up" a stray-looking HTML comment.
- The `S`-numbering block lives in the *workflow*, not in any scene. Looking for
  it in `source/` and not finding it is expected.

## A scene

```yaml
---
longform: true
scene_alias: Results        # becomes the section heading
supplementary: true         # marks it as belonging to the SI draft
---
```

**A scene carries no top-level heading.** Its `## Results` is injected from
`scene_alias` at compile time, so the body starts at `###`. Adding an H2 that
repeats the alias produces a duplicated heading in the artifact.

`supplementary: true` marks which draft a scene belongs to. It is *not* a
numbering switch — nothing consumes it to turn on `S` prefixes. That is the
workflow's job, [`../elements/supplementary.md`](../elements/supplementary.md).
