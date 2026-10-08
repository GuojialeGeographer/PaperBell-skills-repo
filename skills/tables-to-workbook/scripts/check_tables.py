#!/usr/bin/env python3
r"""Check the binding between a manuscript's tables and its workbook.

**A shim.** The checks live in ``checks/tables.py`` and ``checks/crossrefs.py``
and run through ``check_format.py``; this entry point survives because it is
what the skills, the README and the tests already call. It is
``check_format.py --only tables,crossrefs`` with a friendlier name.

    python3 check_tables.py FILE [FILE ...] [options]
    python3 check_tables.py --list-checks

Every option ``check_format.py`` takes works here. To check everything rather
than tables alone, call ``check_format.py`` directly.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import check_format  # noqa: E402
from checks import collect  # noqa: E402

# Re-exported so a caller can introspect what this entry point runs.
CHECKS = collect(("tables", "crossrefs", "supplementary"))

ELEMENTS = "tables,crossrefs,supplementary"


def main(argv: list[str] | None = None) -> int:
    argv = list(sys.argv[1:] if argv is None else argv)
    if not any(a == "--only" or a.startswith("--only=") for a in argv):
        argv += ["--only", ELEMENTS]
    return check_format.main(argv)


if __name__ == "__main__":
    raise SystemExit(main())
