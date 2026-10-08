# CriticMarkup — the review annotation layer

A **draft-time** layer: comments and proposed edits written into the markdown, so a
review lands beside the sentence it is about rather than in a chat log. It is
markdown convention, not any one pipeline's — an editor renders and resolves it, and
an export chain generally does not know it exists.

| Source | What it fixes |
|---|---|
| The `track-changes-review` skill shipped with the *Claudian* Obsidian plugin | The six marks, the `key="value"` prefix, and the review discipline |
| The `track-changes` plugin in the author's vault | The editor that actually renders accept/reject |

**Scope.** This reference owns how an annotation is *written*. What the annotation
should say is out of scope. What happens to one left in the source at export
time is the pipeline's — [`elements/annotations.md`](elements/annotations.md) for
this author's.

## The six marks

| Mark | Proposes |
|---|---|
| `{>>text<<}` | a comment — the default; nothing is changed |
| `{++text++}` | adding this text |
| `{--text--}` | deleting this text |
| `{~~old~>new~~}` | replacing old with new |
| `{==text==}` | a highlight: look here, with no proposal attached |
| `{=+text+=}` | text the assistant *inserted*, flagged so the author can strip it |

## The attribution prefix

One or more `key="value"` pairs placed between the `{` and the sigil:

```
{author="Claude" date="2026-08-13">>a comment<<}
```

Keys are lowercase, values double-quoted and free of `"`, `{`, `}` and newlines, no
space after the `{`, and the closing quote abuts the sigil. `{author="Claude++x++}`
does not parse and stays as literal text — which is the safe failure, since a greedy
parser would swallow the prose after it.

The prefix sits **outside** the payload, so accept/reject strips it automatically;
attribution written inside the payload (`{>>Claude: text<<}`) leaks into the output.
`date` is display-only — omit it rather than guess.

## Reading an annotated document

A draft under review is read as **the text as it stands today**: nothing accepted.
A comment and a proposed insertion are not yet the author's prose and drop out; a
proposed deletion is still in the text and stays.

| Mark | Resolves to |
|---|---|
| `{>>comment<<}`, `{++added++}` | nothing |
| `{--deleted--}`, `{==highlight==}`, `{=+inserted+=}` | its payload, unwrapped |
| `{~~old~>new~~}` | `old` |

`scripts/criticmarkup.py` implements exactly this. A prose linter has to mask every
document through it before counting anything — otherwise a sentence-length,
adjacency or word-frequency measure is taken over text nobody published — which is
why any prose linter needs this grammar, and why the file is small enough to
copy wherever it is needed.
