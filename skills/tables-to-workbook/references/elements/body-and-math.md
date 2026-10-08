# Body text and maths

- Headings `#`/`##`/`###`, numbered automatically. Do not repeat the frontmatter
  `title` as an H1 — `shift_headings.lua` demotes headings as needed.
- `*italic*`, `**bold**`, `==highlight==` (`highlight.lua`), standard footnotes.
- Chinese needs no markup; xeCJK handles it, and `quotes-i18n.lua` fixes the
  quotation marks at a CJK boundary.

Input format:
`markdown+tex_math_single_backslash+wikilinks_title_after_pipe+mark+autolink_bare_uris+pipe_tables`.

## Maths

`$inline$` and `$$display$$`, with `tex_math_single_backslash` on. `math.lua`
rewrites a few incompatibilities, e.g. `\mathbb{1}` → `\mathbbm{1}`.

Display maths is **not numbered by default** and carries no label mechanism in
routine use, so an equation cannot be cross-referenced the way a figure can.
`pandoc-crossref` is configured for it (`eqnPrefixTemplate: ($$i$$)`), so the
capability is there the moment a document needs it — but a document that refers
to "equation 3" in prose is hand-numbering, with all the fragility of a
hand-written cross-document reference.

Inline `$…$` for anything short enough to sit in a sentence is the house habit,
and most Methods sections use nothing else.

## Obsidian constructs that survive

More than expected. `link.lua` converts wikilinks
(`wikilinks_title_after_pipe` is on), `callout.lua` renders `> [!note]` callouts
as LaTeX environments, `div.lua` hides `::: {.hidden}` blocks, and `mute.lua`
strips dataview queries.

Two traps in that list:

- **`mute.lua` returns `nil` for every `BlockQuote`**, not only the Dataview
  ones it means to drop. Any block quote is deleted from the PDF. A callout is
  safe; a plain `>` quotation is not.
- Anything load-bearing inside a dataview query has to be written out first,
  because the query is stripped rather than evaluated.
