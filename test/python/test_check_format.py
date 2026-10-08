#!/usr/bin/env python3
"""Self-test for check_format.py — stdlib only, no pytest required.

    python3 test/python/test_check_format.py

The same two properties as the other two suites, pulling against each other the
same way:

  1. **Recall** — every defect planted in `fixtures/bad/` is found.
  2. **Precision** — `fixtures/good/` is a compliant manuscript-and-SI pair
     sharing one workbook, and must produce no findings at all. It doubles as the
     worked example the skill points at, so a change that makes it noisy is a
     change to the pack's own gold standard.

The `.xlsx` fixtures are committed; regenerate them with
`python3 test/python/fixtures/make_table_workbooks.py` (needs openpyxl, which this suite
does not).

Add a case here whenever you add a check.
"""
from __future__ import annotations

import io
import sys
from contextlib import redirect_stdout
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent  # repo root
sys.path.insert(0, str(ROOT / "shared" / "scripts"))

import check_format  # noqa: E402
from checks import collect  # noqa: E402

# Every element except annotations, which has its own suite.
CHECKS = [c for c in collect() if c.element != "annotations"]
ELEMENTS = ",".join(sorted({c.element for c in CHECKS}))

FIX = HERE / "fixtures"
BAD_MAIN = FIX / "bad" / "bad-tables.md"
BAD_SI = FIX / "bad" / "bad-supplementary.md"
GOOD_MAIN = FIX / "good" / "good-tables.md"
GOOD_SI = FIX / "good" / "good-supplementary.md"
# A prose fixture with no tables in it at all — every check should SKIP for
# want of an input rather than fire.
NO_TABLES = FIX / "no-tables.md"
# A longform project: two index notes over one scene folder, so directory
# mode and the scene line map are exercised rather than merely present.
PROJECT = FIX / "project"

# Each planted defect: check id -> a fragment that must appear in its output.
MUST_FIND = {
    "csl-present": "csl is empty",
    "filename-keys": "date is not set",
    "corresponding-email": "'yes'",
    "figure-asset": "Missing_Figure.png",
    "figure-label": "has a caption but no",
    "bib-key-resolves": "ghost2099",
    "pipe-table": "a hand-written table",
    "workbook-single": "Extra_Tables.xlsx",
    "xlsx-exists": "Missing_Tables.xlsx",
    "sheet-exists": "no sheet named 'Table 9'",
    "caption-for-float": "label with no caption",
    "crossref-syntax": "@tbl:params",
    "label-ref": "fig:nowhere",
    "formula-cells": "cell B4",
    "header-row": "row 1 is a caption but skip_n is 0",
    "sheet-kind": "Table S3 in a main document",
    "sheet-index": "no _index sheet",
    "si-s-prefix": "no S-numbering block",
    "main-no-s-prefix": "renumber Table 1 as Table S1",
}

# Checks with no planted defect. Listing one here is a deliberate choice rather
# than an omission — the completeness test below fails when a check appears in
# neither set, so adding a check forces the decision.
KNOWN_UNTESTED: set[str] = set()


def run(argv: list[str]) -> tuple[int, str]:
    buf = io.StringIO()
    with redirect_stdout(buf):
        code = check_format.main(list(argv) + ["--only", ELEMENTS])
    return code, buf.getvalue()


def main() -> int:
    failures: list[str] = []

    for path in (BAD_MAIN, BAD_SI, GOOD_MAIN, GOOD_SI, NO_TABLES,
                 PROJECT / "Demo_MS_Index.md",
                 PROJECT / "source" / "Results.md"):
        if not path.exists():
            print(f"FAIL  fixture missing: {path}")
            return 1
    for book in ("good/figs/ColMemo_Tables.xlsx",
                 "bad/figs/Bad_Tables.xlsx",
                 "bad/figs/Extra_Tables.xlsx"):
        if not (FIX / book).exists():
            print(f"FAIL  workbook fixture missing: {book} — regenerate with "
                  f"test/python/fixtures/make_table_workbooks.py")
            return 1

    # --- 1. recall on the planted fixtures --------------------------------
    _, out = run([str(BAD_MAIN), str(BAD_SI)])
    for cid, fragment in MUST_FIND.items():
        block = _block_for(out, cid)
        if block is None:
            failures.append(f"{cid}: check did not run")
        elif block.splitlines()[0].startswith(("[ok", "[SKIP")):
            failures.append(f"{cid}: passed on a file that plants this defect")
        elif fragment.lower() not in block.lower():
            failures.append(f"{cid}: ran but never mentioned {fragment!r}")

    # --- 2. every check is either covered or explicitly waived -------------
    all_ids = {c.cid for c in CHECKS}
    accounted = set(MUST_FIND) | KNOWN_UNTESTED
    if all_ids - accounted:
        failures.append("check(s) in neither MUST_FIND nor KNOWN_UNTESTED: "
                        + ", ".join(sorted(all_ids - accounted)))
    if accounted - all_ids:
        failures.append("test names check(s) that no longer exist: "
                        + ", ".join(sorted(accounted - all_ids)))

    # --- 3. precision on a compliant manuscript ----------------------------
    code, out = run([str(GOOD_MAIN), str(GOOD_SI), "--strict"])
    noisy = [ln for ln in out.splitlines()
             if ln.lstrip().startswith(("WARN", "HARD"))]
    if noisy:
        failures.append("a compliant manuscript produced findings:\n    "
                        + "\n    ".join(noisy))
    if code != 0:
        failures.append(f"compliant manuscript exited {code} under --strict, "
                        f"expected 0")

    # --- 4. the two document kinds stay apart ------------------------------
    if "[n/a ] si-s-prefix" not in out:
        failures.append("an si-only check did not report n/a on the main document")
    if "[n/a ] main-no-s-prefix" not in out:
        failures.append("a main-only check did not report n/a on the SI")

    # --- 5. the kind is detected, and --kind overrides it ------------------
    _, out = run([str(GOOD_SI)])
    if "(si document)" not in out:
        failures.append("a file named *-supplementary.md was not detected as SI")
    _, out = run([str(GOOD_SI), "--kind", "main"])
    if "(main document)" not in out:
        failures.append("--kind did not override the detected kind")

    # --- 6. a longform project directory -----------------------------------
    # The reason directory mode exists is that the root artifacts are generated:
    # a finding has to name the scene the author can actually edit, at the line
    # it is really on. Assert both, because a line map that is built and never
    # read looks exactly like one that works.
    _, out = run([str(PROJECT)])
    if "-> Manuscript" not in out or "-> Supplementary_Information" not in out:
        failures.append("both index notes should resolve to their own document")
    if "(si document)" not in out:
        failures.append("draftTitle: Supplementary_Information should give kind si")
    if "source/Results.md:L6" not in out:
        failures.append("a finding should name the scene file and its real line "
                        "(source/Results.md:L6), not a line of the concatenation")
    if "source/Results.md:L8" not in out:
        failures.append("the second finding's line did not map back to its scene")

    # --- 7. graceful degradation ------------------------------------------
    code, out = run([str(NO_TABLES), "--strict"])
    if code != 0 or "[SKIP]" not in out:
        failures.append("a document with no tables should SKIP its way to 0")

    code, out = run(["/definitely/not/here.md"])
    if "does not exist" not in out or code != 0:
        failures.append("a missing file should SKIP, not fail")

    code, out = run(["--list-checks"])
    if code != 0 or "sheet-index" not in out:
        failures.append("--list-checks is broken")

    # --- report ------------------------------------------------------------
    if failures:
        print(f"{len(failures)} failure(s):\n")
        for f in failures:
            print(f"  FAIL  {f}")
        return 1
    print(f"ok — {len(MUST_FIND)} planted defects found, "
          f"{len(KNOWN_UNTESTED)} checks waived, "
          f"compliant manuscript silent under --strict")
    return 0


def _block_for(out: str, cid: str) -> str | None:
    """The report block for one check: its status line plus indented detail.

    A check runs once per file, so the same id appears more than once — including
    as `n/a` on the document kind it does not read. Prefer a block with a finding
    in it, then any real one.
    """
    lines = out.splitlines()
    blocks = []
    for i, line in enumerate(lines):
        if not line.startswith("[") or not line.split("] ", 1)[-1].startswith(cid):
            continue
        block = [line]
        for nxt in lines[i + 1:]:
            if nxt.startswith(("[", "--", "==")):
                break
            block.append(nxt)
        blocks.append("\n".join(block))
    if not blocks:
        return None
    for block in blocks:
        if block.startswith(("[HARD", "[WARN")):
            return block
    for block in blocks:
        if not block.startswith("[n/a"):
            return block
    return blocks[0]


if __name__ == "__main__":
    raise SystemExit(main())
