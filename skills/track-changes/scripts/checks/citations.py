"""Citations — every `[@key]` resolves against a bibliography.

Only checkable when the bibliography is **declared**. Most documents here resolve
against a shared vault-wide library that the export injects as `--bibliography`
and that is not visible from the document at all, so a key missing from the
`.bib` files lying beside it means nothing: a real manuscript cites hundreds of
keys and keeps two local files for a handful of SI sources.

So this check SKIPs unless the frontmatter names a `bibliography:`. That is the
one case where the set of `.bib` files is claimed to be complete, and a key
outside it is a real defect rather than a guess.
"""
from __future__ import annotations

from . import Check
from ._doc import BIB_ENTRY, CITE, frontmatter, line_of

# Keys pandoc-crossref owns; they are not bibliography entries.
CROSSREF_PREFIXES = ("fig:", "tbl:", "eq:", "sec:", "lst:")


def _declared_bibs(doc) -> list:
    """The .bib files the frontmatter names, resolved beside the document."""
    raw = frontmatter(doc).get("bibliography", "").strip()
    if not raw:
        return []
    raw = raw.strip("[]")
    base = doc["path"].resolve().parent
    out = []
    for name in (p.strip().strip("\"'") for p in raw.split(",")):
        if not name:
            continue
        cand = base / name
        if cand.is_file():
            out.append(cand)
    return out


def _bib_keys(doc) -> tuple[set[str], list[str]]:
    keys: set[str] = set()
    names: list[str] = []
    for bib in _declared_bibs(doc):
        try:
            keys.update(BIB_ENTRY.findall(bib.read_text(encoding="utf-8", errors="replace")))
        except OSError:
            continue
        names.append(bib.name)
    return keys, names


def c_bib_key_resolves(doc, rep, th) -> None:
    cited = [(m.group(1), line_of(doc["prose"], m.start()))
             for m in CITE.finditer(doc["prose"])
             if not m.group(1).startswith(CROSSREF_PREFIXES)]
    if not cited:
        rep.check("bib-key-resolves", "SKIP", "no citations in this document")
        return
    keys, names = _bib_keys(doc)
    if not names:
        rep.check("bib-key-resolves", "SKIP",
                  "no bibliography: in the frontmatter — the shared library the "
                  "export injects is not readable from here")
        return
    missing = sorted({(k, ln) for k, ln in cited if k not in keys})
    rep.check("bib-key-resolves", "WARN" if missing else "ok",
              f"{len({k for k, _ in cited}) - len({k for k, _ in missing})}"
              f"/{len({k for k, _ in cited})} key(s) in {', '.join(names)}")
    for key, line in missing[:10]:
        rep.warning(f"@{key} is in none of {', '.join(names)} — if it is not in "
                    f"the shared library either, citeproc prints the key "
                    f"literally and drops the entry", line)
    if len(missing) > 10:
        rep.warning(f"... and {len(missing) - 10} more")


CHECKS = [
    Check("bib-key-resolves", "B",
          "a key that resolves nowhere prints literally and is dropped\n"
          " from the bibliography",
          c_bib_key_resolves),
]
