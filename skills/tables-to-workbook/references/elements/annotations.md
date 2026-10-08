# Review annotations — what a leftover mark compiles to

The six CriticMarkup marks and the `author="…"` prefix grammar are in
[`../criticmarkup.md`](../criticmarkup.md); writing them is `/track-changes`'s
job. This page owns the one fact that is *this pipeline's*: what happens to a
mark nobody resolved.

**Every mark must be gone before export.** No filter in the chain knows
CriticMarkup, and it does not fail loudly:

| Left in the source | Comes out of the PDF as |
|---|---|
| `{==text==}` | a **real highlight** wrapped in stray braces — `mark` is enabled |
| `{--text--}` | `{–text–}`, with a **real en dash** — pandoc's `smart` is on |
| `{~~old~>new~~}` | `old~>new` struck through — the *replacement* is struck out too |
| the other three, and every prefix | verbatim, braces and all |

The first two are the dangerous ones: they print as deliberate typography, so a
proofreader reads past them. `check_annotations.py` reports what is left; run it
last, when the review is closed, and simply do not run it while one is still
open.

## Notes that are meant to stay

For a note that should live in the source without reaching the PDF, there are
two forms the pipeline does strip: `%%…%%` and `::: {.hidden}` blocks, both
handled by `div.lua`.

Neither survives to the PDF — but note that the **Word presets run no
`div.lua`**, so a `%%…%%` comment does reach a `.docx`.

## A different review mechanism exists

CriticMarkup is the draft-time layer: marks written into a document under
review, resolved before it compiles.

That is not the same thing as a **response letter**, where a reviewer's comment
and the author's reply are permanent content of a document that itself gets
exported. Those use quote callouts and live transclusion, carry no CriticMarkup
at all, and are covered in
[`../project/response-letter.md`](../project/response-letter.md). Do not reach
for CriticMarkup there.

There is also an HTML-comment form, `<!--ms:id-->…<!--/ms:id-->`, which looks
like an annotation and is not one — it is a transclusion anchor, and it is
deliberately preserved through the compile. See
[`../project/anchors.md`](../project/anchors.md). Never strip one as if it were
a stray comment.
