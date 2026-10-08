"""Review annotations left in a document that is about to be exported.

CriticMarkup is a draft-time layer and every mark has to be gone before the
document compiles. The failure is silent: no filter in the chain knows the
grammar, and because the presets enable `mark` and pandoc's `smart`, two of the
six forms print as deliberate typography rather than as stray syntax — which is
exactly what a proofreader reads past.

Nothing here has a `kind`: a leftover mark is a defect in any document.

Run these last, when the review is closed. While one is open the marks are
supposed to be there.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from criticmarkup import CRITIC_ANY  # noqa: E402

from . import Check  # noqa: E402

# What each form does if it survives to export, read off the local toolchain
# rather than assumed. Named per finding because the first two are the
# dangerous ones — they print as deliberate typography, not as stray syntax.
CRITIC_FATE = {
    "==": "prints as a real highlight inside stray braces (`mark` is on)",
    "--": "prints as {–text–}, with a real en dash (`smart` is on)",
    "~~": "strikes out old AND new, and prints the ~> arrow",
    ">>": "prints verbatim, prefix and all",
    "++": "prints verbatim, prefix and all",
    "=+": "prints verbatim, prefix and all",
}


def c_leftover_annotation(doc, rep, th) -> None:
    # `prose` has fenced blocks blanked with the line count kept, so a document
    # that *documents* CriticMarkup — this pack's own reference, a style guide,
    # a tutorial — can be checked without every example firing.
    text = doc["prose"]
    hits = [(text.count("\n", 0, m.start()) + 1, m.group(1))
            for m in CRITIC_ANY.finditer(text)]
    rep.check("leftover-annotation", "HARD" if hits else "ok",
              f"{len(hits)} found")
    for line, sigil in hits[:10]:
        rep.hard_fail(f"review annotation left in the text — "
                      f"{CRITIC_FATE[sigil]}; resolve it, or move the note "
                      f"into %%...%%, before exporting", line)
    if len(hits) > 10:
        rep.hard_fail(f"... and {len(hits) - 10} more")


CHECKS = [
    Check("leftover-annotation", "L",
          "an annotation is not prose, and the pipeline does not strip it",
          c_leftover_annotation),
]
