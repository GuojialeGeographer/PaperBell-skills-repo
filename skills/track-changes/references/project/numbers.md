# Number placeholders — `{{ results1.corr }}`

A headline number is never typed into the prose. The scene carries a
placeholder, and the compile substitutes it:

```markdown
… the instrumental validation data is {{ results1.corr }} ($p < 0.01$) …
```

compiles to *"… the instrumental validation data is 0.35 (p < 0.01) …"*.

## `results.json`

A flat file of namespaces, one per results subsection, each a map of key to
value:

```json
{
  "results1": { "n_datasets": 5, "corr": 0.35, "n_sites_sig005": 18 },
  "results2": { "kappa": 0.2, "kendall_tau": 0.176, "n_samples": 208 },
  "results3": { "tau": 0.19, "w_optimal": 18, "optimal_segment_w": 33 }
}
```

The `replace-json-placeholders` workflow step reads `metadata.json` and
`results.json` and substitutes `{{ }}` delimited paths from either.

**A placeholder whose key is missing does not fail the build.** It reaches the
PDF as literal `{{ results1.corr }}` — conspicuous if you read the output, and
invisible if you do not.

## Why it is worth the indirection

The number in the prose, the number in a table cell, and the number in a figure
all come from one place, so they cannot disagree. Re-running the analysis and
rewriting `results.json` updates the manuscript everywhere at once.

Which also means: **editing a number in the generated artifact is doubly
useless.** It is overwritten at the next compile, and the real value is still
wrong upstream.

## `metadata.json`

The deposition record — title, publication date, description, keywords,
creators — plus a private `_longform` block:

```json
"_longform": {
  "acronym": "CollMemo",
  "author_affiliations": { "Shuang Song": ["Dept …", "…"] },
  "extra_yaml": "corresponding_email: \"…\"\nacknowledgements: \"…\"\n"
}
```

`extra_yaml` is a raw YAML string spliced into the compiled frontmatter, which
is how keys that have no home in the index note reach the artifact. The cover
letter's `{{JournalName}}` resolves from here too.

**Watch for duplication.** Where `metadata.json` also carries a copy of the
`results*` namespaces, there are now two definitions of the same numbers and
nothing reconciles them; they drift, and the drift is silent. Keep the numbers
in `results.json` alone, or accept that the copy has to be regenerated rather
than maintained.
