"""Cross-references — the \ref rule, and every reference resolving.

Across two documents there is no \ref to check: a manuscript and its supplement
compile separately, so those references are hand-written prose. That is why an
orphan label is only a WARN here — it may well be referred to from the other
document. See references/elements/crossrefs.md.
"""
from __future__ import annotations

from . import Check
from ._doc import CROSSREF_AT, FIG_LABEL, REF, line_of


def c_crossref_syntax(doc, rep, th) -> None:
    hits = [(m.group(0), line_of(doc["prose"], m.start()))
            for m in CROSSREF_AT.finditer(doc["prose"])]
    rep.check("crossref-syntax", "HARD" if hits else "ok",
              f"{len(hits)} crossref-style reference(s)")
    for tok, line in hits[:8]:
        target = tok.lstrip("-@").split(":", 1)[0]
        rep.hard_fail(f"{tok} — figures and tables are both referred to with "
                      f"\\ref{{{target}:…}}; an xlsx table is raw LaTeX before "
                      f"pandoc-crossref ever sees it", line)
    if len(hits) > 8:
        rep.info(f"... and {len(hits) - 8} more")

def c_label_ref(doc, rep, th) -> None:
    defined = {b["label"]: b["line"] for b in doc["blocks"] if b.get("label")}
    defined.update({m.group(1): line_of(doc["prose"], m.start())
                    for m in FIG_LABEL.finditer(doc["prose"])})
    used = {}
    for m in REF.finditer(doc["prose"]):
        used.setdefault(m.group(1), line_of(doc["prose"], m.start()))
    if not defined and not used:
        rep.check("label-ref", "SKIP", "no labels and no references in this document")
        return
    orphans = [(lab, ln) for lab, ln in defined.items() if lab not in used]
    # Only labels this script knows how to define: an \ref{eq:…} or \ref{sec:…} is
    # someone else's business.
    dangling = [(lab, ln) for lab, ln in used.items()
                if lab.startswith(("tbl:", "fig:")) and lab not in defined]
    rep.check("label-ref", "HARD" if dangling else ("WARN" if orphans else "ok"),
              f"{len(defined)} label(s), {len(orphans)} orphan, {len(dangling)} dangling")
    for lab, line in orphans:
        # Only a WARN: an SI float referred to from the main text is an orphan
        # here and perfectly correct, because a cross-document reference is
        # hand-written prose and carries no \ref at all.
        rep.warning(f"{lab} is defined and never referred to in this document — "
                    f"either the reference is missing, or it lives in the other "
                    f"document as prose", line)
    for lab, line in dangling:
        rep.hard_fail(f"\\ref{{{lab}}} resolves to nothing — it will print as ??", line)


CHECKS = [
    Check("crossref-syntax", "B",
          "figures and tables both take \\ref{} — @tbl:x never resolves",
          c_crossref_syntax),
    Check("label-ref", "B",
          "every label referred to, every \\ref resolving — figures and\n"
          " tables alike",
          c_label_ref),
]
