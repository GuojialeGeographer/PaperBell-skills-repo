# The response letter

A compiled document like any other, with two conventions of its own: how a
reviewer's comment is encoded, and how the revised manuscript text is shown.

**It carries no CriticMarkup.** A response letter is not a draft under review —
it is a finished document whose content happens to be a review. Reaching for
`{>>…<<}` here is a category error; see
[`../elements/annotations.md`](../elements/annotations.md).

## The reviewer's comment — a quote callout

```markdown
> [!quote] Reviewer #2
> In the ABM code, the z-score formula is wrong due to operation precedence:
> `climate - baseline/std` should be `(climate - baseline)/std`.
>
> ---
> **中文翻译：** 在 ABM 代码中，由于运算优先级问题，z-score 公式是错误的……
```

| Piece | Becomes |
|---|---|
| `> [!quote] Reviewer #N` | a `\section` on first appearance |
| a trailing `(…)` in the title — `Reviewer #1 (Remarks on code availability)` | a `\subsection*` |
| `---` then `**中文翻译：**` | a `\zh{}` gloss, kept in the draft build and dropped from the final |
| `> [!comment]` | the reviewer's opening summary, rather than a numbered point |

`responseletter.lua` does this, and it must run **after** `citeproc` — a `[@key]`
inside a response has to resolve before the letter environment wraps it.

## The author's reply

A bare paragraph led by a bold label. No callout, no environment:

```markdown
**Response:** We are grateful to the reviewer for catching this. It was a
genuine bug …
```

## Showing the revised text

Never pasted. A fenced `manuscript` block pulls the current text live from the
scene:

````markdown
```manuscript
@res-year-to-year-pearson
```
````

The tokens, and how to write the anchors they point at, are in
[`anchors.md`](anchors.md). Where a line harvest has run, each box is stamped
with the page and line range the span occupies in the revised PDF
([`registries.md`](registries.md)).

Line numbers quoted *from* a reviewer (*"Lines 103–104"*) are their text and
stay inside the callout verbatim. Line numbers pointing *at* the revision are
generated — never typed.

## Draft and final

One template, two builds, selected by a metadata flag rather than a separate
config:

| `--metadata=draft:` | Emits |
|---|---|
| `true` | the Chinese gloss, status/difficulty badges, inline notes |
| `false` | reviewer comment and author response only — the submission build |

## Figures

Response-letter figures use ordinary Pandoc syntax and their own label
namespace, so a `{#fig:bug_compare}` here does not collide with, and will not
appear in, the manuscript's figure numbering.
