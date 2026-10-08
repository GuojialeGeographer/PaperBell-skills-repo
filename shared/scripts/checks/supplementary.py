"""Supplementary numbering — the raw-LaTeX block that earns the S prefix.

In a longform project the workflow injects this block, so it appears in the
generated artifact and in none of the scenes — which is why the check SKIPs
rather than fires when it is reading assembled scenes.
"""
from __future__ import annotations

from . import Check
from ._doc import FIG_LABEL, S_PREFIX, line_of


def c_si_s_prefix(doc, rep, th) -> None:
    hits = [line_of(doc["raw"], m.start()) for m in S_PREFIX.finditer(doc["raw"])]
    if not hits:
        # In a longform project the Supplementary Information workflow step
        # injects the block, so it is absent from every scene by design. Its
        # absence from the assembled scenes says nothing, and reporting it
        # would fire on every correctly-built project.
        if doc.get("project"):
            rep.check("si-s-prefix", "SKIP",
                      "scenes carry no S-numbering block — the workflow injects it")
            return
        rep.check("si-s-prefix", "WARN", "no S-numbering block")
        rep.warning("an SI numbers its tables S1, S2 — put the "
                    "\\renewcommand{\\thetable}{S\\arabic{table}} block at the top of "
                    "the body, or add the Supplementary Information workflow step")
        return
    # "Late" is not a line number — a long frontmatter is not a defect. The block
    # only renumbers what follows it, so lateness means a float precedes it.
    at = min(hits)
    floats = [b["line"] for b in doc["blocks"]]
    floats += [line_of(doc["text"], m.start()) for m in FIG_LABEL.finditer(doc["text"])]
    before = sorted(ln for ln in floats if ln < at)
    rep.check("si-s-prefix", "WARN" if before else "ok",
              f"S-numbering block at line {at}, {len(before)} float(s) before it")
    if before:
        rep.warning(f"the block only renumbers what follows it, and {len(before)} "
                    f"float(s) come first — move it directly after the frontmatter",
                    before[0])

def c_main_no_s_prefix(doc, rep, th) -> None:
    hits = [line_of(doc["raw"], m.start()) for m in S_PREFIX.finditer(doc["raw"])]
    rep.check("main-no-s-prefix", "HARD" if hits else "ok",
              f"{len(hits)} S-numbering line(s)")
    # One block renews both counters, so report the block, not each line in it.
    if hits:
        rep.hard_fail("the main text would renumber Table 1 as Table S1 — this block "
                      "belongs only in the supplementary document", min(hits))


CHECKS = [
    Check("si-s-prefix", "B",
          "the SI earns its S numbers from a raw-LaTeX block",
          c_si_s_prefix, kind="si"),
    Check("main-no-s-prefix", "B",
          "the main text never carries the S-prefix block",
          c_main_no_s_prefix, kind="main"),
]
