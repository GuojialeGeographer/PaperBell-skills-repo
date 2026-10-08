#!/usr/bin/env python3
r"""Report review annotations left in a document that is about to be exported.

**A shim.** The check lives in ``checks/annotations.py`` and runs through
``check_format.py``; this entry point survives because it is what the skills,
the README and the tests already call. It is
``check_format.py --only annotations`` with a friendlier name.

It matters because the failure is silent. No filter in the PaperBell chain knows
CriticMarkup, and the presets enable Pandoc's `mark` and `smart` extensions — so
`{==text==}` reaches the PDF as a **real highlight** wrapped in stray braces and
`{--text--}` as `{-text-}` with a **real en dash**. Those two print as
deliberate typography, which is exactly what a proofreader reads past.

    python3 check_annotations.py MANUSCRIPT.md [MORE.md ...]
    python3 check_annotations.py --list-checks
    python3 check_annotations.py draft.md --strict

Run it last, when the review is closed. While one is still open every mark is
supposed to be there, so simply do not run this.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import check_format  # noqa: E402
from checks import collect  # noqa: E402

# Re-exported so a caller can introspect what this entry point runs.
CHECKS = collect(("annotations",))

ELEMENTS = "annotations"


def main(argv: list[str] | None = None) -> int:
    argv = list(sys.argv[1:] if argv is None else argv)
    if not any(a == "--only" or a.startswith("--only=") for a in argv):
        argv += ["--only", ELEMENTS]
    return check_format.main(argv)


if __name__ == "__main__":
    raise SystemExit(main())
