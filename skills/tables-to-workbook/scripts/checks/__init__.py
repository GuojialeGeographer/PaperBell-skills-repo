"""The check registry — one module per carrier element.

A ``Check`` carries its own applicability and its own principle, so the driver
never needs to know what any individual check is about. Two dimensions decide
whether a check runs, and they mean different things:

``kind``
    Which document this check is *about* — ``"main"``, ``"si"``, or ``None``
    for every document. A check that does not apply here reports ``n/a``.
    Applicability is metadata, never an early return inside the function.

the check's own SKIP
    Whether the *input* it reads is present at all — no ``xlsx-table`` block,
    no workbook, no bibliography. That is the function's own business, and it
    reports SKIP.

``element`` is the group the check belongs to, and is what ``--only figures``
selects on.
"""
from __future__ import annotations

from importlib import import_module

PASSES = {
    "B": "Binding",   # the document and its artefacts agree
    "C": "Cells",     # the contents of a sheet
    "T": "Trace",     # a number can be followed back to its source
    "L": "Leftovers",  # draft-time marks that must be gone
}

# Order matters: it is the order findings are reported in, and it runs from
# "is the document even addressable" outwards to "is the review closed".
ELEMENTS = [
    "frontmatter",
    "figures",
    "tables",
    "citations",
    "crossrefs",
    "supplementary",
    "annotations",
]


class Check:
    """One check, its applicability, and the principle printed with it."""

    __slots__ = ("cid", "pass_", "principle", "fn", "kind", "element")

    def __init__(self, cid, pass_, principle, fn, kind=None, element=""):
        self.cid = cid
        self.pass_ = pass_
        self.principle = principle
        self.fn = fn
        self.kind = kind
        self.element = element

    def applies_to(self, kind: str) -> bool:
        return self.kind is None or self.kind == kind

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<Check {self.element}/{self.cid}>"


def collect(elements=None) -> list[Check]:
    """Every check from every element module, in ELEMENTS order."""
    out: list[Check] = []
    for name in ELEMENTS:
        if elements and name not in elements:
            continue
        mod = import_module(f".{name}", __package__)
        for chk in mod.CHECKS:
            chk.element = name
            out.append(chk)
    return out
