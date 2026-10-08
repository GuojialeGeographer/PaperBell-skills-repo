# Transclusion anchors — `<!--ms:id-->`

A span of manuscript prose that some other document needs to quote **verbatim
and always current**. The canonical case is a response letter showing the
reviewer exactly what the revised text now says.

```markdown
<!--ms:res-year-to-year-pearson-->The year-to-year Pearson correlation between
the N-WDI and the instrumental validation data is 0.35 ($p < 0.01$), which is
similar to the collected natural proxy datasets (see **Supplementary
Information Table S8**).<!--/ms:res-year-to-year-pearson-->
```

They are HTML comments, so they are invisible in every renderer and in the PDF.
They survive the compile only because the workflow sets
`remove-html-comments: false` — which is why a stray-looking HTML comment in a
scene must never be tidied away.

## Writing one

| Rule | Why |
|---|---|
| **Section-prefixed id** — `intro-`, `res-`, `meth-`, `disc-`, `odd-` | The ids live in one flat namespace across the whole project |
| **Unique** across the project | A duplicate id makes the transclusion ambiguous, and which span wins is not defined |
| **Closed** — every `<!--ms:x-->` has a `<!--/ms:x-->` | An unclosed anchor swallows the rest of the scene |
| Slug describes the claim, not the position | `res-dynamic-kendall-benchmark`, not `res-3` |

They **nest**, and nesting is normal: a wide span for the whole argument, a
narrow one inside it for the single sentence a reviewer asked about.

They may sit **inside a figure caption**, which is how a response letter quotes
one panel's description.

## Quoting one

From a response letter, a fenced `manuscript` block holding one token per line:

````markdown
```manuscript
@res-year-to-year-pearson
```
````

| Token | Pulls |
|---|---|
| `@<anchor-id>` | the span between that anchor pair |
| `@fig:<label>` | the whole figure block, caption and all |
| `![[Scene#Section]]` | an entire scene section, as an Obsidian embed |

Several `@id` lines in one fence stitch separate spans into a single quoted
box. `manuscript_include.lua` resolves all of this, and it **must run first** in
the response-letter chain — see [`../pipeline.md`](../pipeline.md).

## Why not just paste the text

Because the point is that it cannot go stale. A pasted paragraph is correct on
the day it is pasted and wrong after the next revision, silently, in the one
document whose whole purpose is to tell a reviewer what the text now says.

Where a line harvest has run, each quoted box is also stamped with the page and
line range the span occupies in the revised PDF — see
[`registries.md`](registries.md).
