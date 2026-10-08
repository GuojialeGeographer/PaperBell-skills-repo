# Attribution

Everything in `references/` is a **distilled standard restated in our own
words** — decision rules and the behaviour actually observed — not a
reproduction. Short quotations are marked and kept brief.

## The local toolchain

`paperbell-format.md` distils a standard that is neither published nor a book:
the author's own **PaperBell 写作与导出规范**, kept in their Obsidian vault
alongside the Pandoc filters, templates, and defaults it documents. The pack
enforces it through `scripts/check_tables.py`, so the source matters.

| Source | What this pack takes |
|---|---|
| `40 - Obsidian/脚本/Pandoc/PaperBell 写作与导出规范.md` | The frontmatter keys, the `figs/` asset rule, the `xlsx-table` block, the `\ref{}` cross-reference rule, the S-prefix supplementary block, the export commands |
| The Lua filters in the same directory — `xlsx_table.lua`, `image.lua`, `link.lua`, `callout.lua`, `math.lua`, `div.lua`, `mute.lua` — several by [github.com/zcysxy](https://github.com/zcysxy) | What the pipeline does that the spec does not say: cached-value-only cell reading, the Obsidian constructs that survive conversion, which comment forms are stripped |

Pandoc, `pandoc-crossref`, and xelatex are the compilers behind all of it, and
the two behaviours this pack asserts about them — that an `xlsx-table` becomes
raw LaTeX before `pandoc-crossref` runs, so `@tbl:` never resolves, and that no
filter in any preset recognises CriticMarkup, so a leftover mark prints — were
read off the filter chain and the defaults files rather than assumed.

## The annotation layer

`criticmarkup.md` distils the `track-changes-review` skill shipped with the
*Claudian* Obsidian plugin, whose editor is the thing that renders and resolves
the marks. The pack takes the six marks, the `{author="…"…}` prefix that sits
outside the payload so accept/reject strips it, and the review discipline. The
rule that annotations must be gone before export is the pack's own, and is
enforced by `scripts/check_annotations.py`.

## Where the two copied files came from

`scripts/report.py` and `scripts/criticmarkup.py` were copied from
[SongshGeo/scientific-writting-skills](https://github.com/SongshGeo/scientific-writting-skills)
(MIT) at `eb0eca7`; each carries a provenance header. That repo is also where
the `.env`-plus-env-var configuration convention, the skip-if-absent checker
pattern, and the report format come from, and it in turn credits
`project-to-paper` and Matt Pocock's `writing-great-skills` for them.

They were copied rather than depended on: about 140 lines of stdlib with no
policy in either. This pack owns its copies and is free to change them, so this
section is a credit, not a link in a chain.
