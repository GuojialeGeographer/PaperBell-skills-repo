# Supplementary numbering

An SI document earns its `S` prefix from a raw-LaTeX block placed at the very
top of the body, after the frontmatter:

````markdown
```{=latex}
%% Supplementary numbering: prefix figures and tables with "S".
\renewcommand{\thefigure}{S\arabic{figure}}
\renewcommand{\thetable}{S\arabic{table}}
```
````

Both counters are LaTeX's own, and the SI compiles as its own document, so this
alone yields *Figure S1*, *Table S1*, and every `\ref` in that document follows.
The main manuscript never carries this block.

## Consequences worth stating

**SI labels stay plain.** Because the `S` comes from the counter, an SI figure
is labelled `{#fig:study_area}` and referred to as `Figure \ref{fig:study_area}`
— exactly like a main-text one. There is no `S` anywhere in the source. Writing
`{#fig:s1}` is legal but positional, and goes stale the moment a section moves.

**The number is assigned by order of appearance**, not by anything in the
source. Reordering two SI sections renumbers every figure and table after them,
silently and correctly. Anything that hard-codes a number — a filename, a label,
a hand-written main-text reference — is what breaks.

**SI section numbering is implicit** too: the headings are plain (`## Details of
the historical archives`), and `numbersections: true` in the preset turns them
into S1, S2.1, and so on. The main text cites them by that number in prose,
which is a cross-document reference — see [`crossrefs.md`](crossrefs.md).

## Who writes the block

In a single-file SI, by hand, immediately after the frontmatter.

In a longform project the **Supplementary Information** workflow step injects
it, so it appears in the generated artifact and in none of the `source/` scenes.
Adding it to a scene as well is redundant rather than harmful — pick one, and in
a longform project pick the workflow.

There is no `supplementary: true` document flag that does this. A scene may
carry `supplementary: true` to mark which draft it belongs to, but nothing
consumes it as a numbering switch.
