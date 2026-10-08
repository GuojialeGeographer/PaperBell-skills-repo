# Citations

`[@key]`, `[@a; @b]`, or inline `@key`. The style comes from the frontmatter
`csl:`; the bibliography is emitted under *References*, and no `## References`
heading is written by hand.

## Where the keys resolve

Three layers, in the order a key is looked up:

| Layer | What it is |
|---|---|
| The shared library | One vault-wide `mybib.bib`, injected by the export as `--bibliography`. This is why the defaults files carry no `bibliography:` line of their own |
| Project-local `.bib` files | Beside the manuscript, for sources the shared library does not carry |
| — | Nothing else. There is no per-document reference list |

Keys are Better BibTeX style (`@oconnor2022`, `@yang2024a`). A key that resolves
nowhere does not stop the export: citeproc emits **`[@key]` literally, or a bare
`?`**, and the entry is silently missing from the bibliography.

## A project-local `.bib` is a curated file, not a Zotero dump

Where both exist for the same sources — a raw export and a cleaned copy — only
one may be on the bibliography path, or the same key is defined twice and which
definition wins is undefined. Keep the cleaned one; note in its header what was
corrected and when, so a later reader knows it was verified rather than
exported.

Fields differ between the two dialects (`date`/`journaltitle` in biblatex,
`year`/`journal` in BibTeX), and Zotero tag fields (`keywords = {🔍检索,…}`)
serve no purpose in a manuscript.

## Inside a table cell

`[@citekey]` in a workbook cell is resolved by the normal citeproc pass —
`xlsx_table.lua` emits it into the document before citeproc runs. That is how a
borrowed row cites its source.
