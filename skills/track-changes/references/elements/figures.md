# Figures — and where every asset lives

How a figure is written down so the export gives it a caption, a number, and a
label that `\ref` can reach.

## Assets live in `figs/`

Images **and** table workbooks go in a `figs/` directory beside the note. The
export passes `--resource-path` for the note's own directory, `figs/`, and
`../figs/`, so a file in `figs/` resolves both when the note is compiled in
place and when it is compiled from a longform section directory. A file
anywhere else is a *"not found on resource-path"* error at export time.

Because the resource path already covers `figs/`, the path written in the
document may be either `figs/name.png` or the bare `name.png`. A scene under
`source/` uses the bare form — it reaches the image through `../figs/` — and
that is the form the worked projects use throughout.

## The form

```markdown
![Caption text](CollMemo_figure1.png){#fig:overview width=70%}
```

Caption in the brackets, path in the parens, **Pandoc attributes after the
closing paren**: `#fig:label` defines the label, `width=70%` and friends size
it.

### Why the attributes go after the parens

`image.lua` also accepts the attributes *inside* the caption —
`![Caption {#fig:x width=70%} | 500x300](path.png)`, with the Obsidian alias
pipe stripped. It works, and older documents use it. Prefer the trailing form
anyway, because the two are not equally safe:

`promote_figures.lua` exists to rescue a figure that lost its blank line and
got parsed as an inline image at the end of the previous paragraph — which the
longform compile causes routinely, by gluing a closing `<!--/ms:id-->` up
against the image. It decides what to rescue by testing `img.identifier`.

That field is populated by Pandoc's own attribute parsing, i.e. only by the
trailing form. `promote_figures.lua` runs **before** `image.lua`, so an
in-caption `{#fig:x}` is still unparsed text at that moment and the identifier
is empty. The figure is not rescued: it stays inline, emits no `\caption` and no
`\label`, is not counted, and **every figure after it shifts by one** — with no
error anywhere. The trailing form is the one the rescue can see.

## Panel labels

Panels are bold letters inside the caption, and referred to by suffixing the
reference: `**a.**` in the caption, `**Figure \ref{fig:overview}a**` in the
prose. There is no separate subfigure mechanism.

## Referring to one

`Figure \ref{fig:x}` — never `@fig:x`. The rule and the reason are in
[`crossrefs.md`](crossrefs.md).

## Naming the files

One convention across a project, so a stray asset is visible in a directory
listing: `<Acronym>_figure1.png` for the main text, `<Acronym>_SI_<topic>.png`
for the supplement, `<Acronym>_Response_Figure1.png` for a response letter.

Main-text names carry the number because those figures are few and stable. SI
names are **topic-based**, because SI numbering is assigned at compile time by
order of appearance — a file called `..._FigureS7.png` becomes a lie the first
time a section is reordered.
