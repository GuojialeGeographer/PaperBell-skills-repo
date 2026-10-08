#!/usr/bin/env python3
"""Self-test for check_annotations.py — stdlib only, no pytest required.

    python3 test/python/test_check_annotations.py

The two properties, as everywhere else in this pack:

  1. **Recall** — every mark planted in `fixtures/bad-annotations.md` is found,
     all six forms, each named with what it would print as.
  2. **Precision** — a document with no annotations is silent, a mark inside a
     fenced block is documentation rather than a note on this draft, and a
     malformed mark does not swallow the prose after it.
"""
from __future__ import annotations

import io
import sys
import tempfile
from contextlib import redirect_stdout
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent  # repo root
sys.path.insert(0, str(ROOT / "shared" / "scripts"))

import check_annotations  # noqa: E402
import criticmarkup  # noqa: E402

FIXTURE = HERE / "fixtures" / "bad-annotations.md"

# One planted mark per form, and the phrase the report must use for it. The two
# at the top are the ones that make this check worth running: they reach the
# PDF as deliberate-looking typography, so a proofreader reads past them.
MUST_NAME = {
    "real highlight": "{==…==}",
    "real en dash": "{--…--}",
    "strikes out old AND new": "{~~old~>new~~}",
    "prints verbatim": "{>>…<<}, {++…++} and {=+…+=}",
}

# Prose with nothing to report. Note the `%%…%%` comment and the `==mark==`:
# the first is a form the pipeline does strip, the second is not CriticMarkup.
CLEAN = """\
# Nitrogen supply controls grassland recovery after drought

Grasslands recovered faster where nitrogen was ==abundant==, and the recovery
rate rose by a factor of 2.8 in the fertilised plots (p = 0.002, n = 48).

%%A note meant to stay in the source; div.lua strips it.%%
"""

# The grammar is precise, not greedy. Kept here as well as in the writing
# pack's test_check_prose.py because scripts/criticmarkup.py is deliberately
# copied between packs, and each copy has to be held to the same behaviour.
GRAMMAR_CASES = [
    ('a {author="C">>note<<} b', 1),
    ('a {author="C" date="2026-08-13"++new++} b', 1),
    ("a {--old--} b", 1),
    ("a {~~old~>new~~} b", 1),
    ("a {==hl==} b", 1),
    ("a {=+drafted+=} b", 1),
    ('a {author="C++x++} b', 0),      # prefix quote never closes: not a mark
    ("a ==plain mark== b", 0),        # not CriticMarkup at all
    ("a {>>one<<} b {>>two<<} c", 2),
]


def run(argv: list[str]) -> tuple[int, str]:
    buf = io.StringIO()
    with redirect_stdout(buf):
        code = check_annotations.main(argv)
    return code, buf.getvalue()


def main() -> int:
    failures: list[str] = []

    # --- 1. recall on the planted fixture ---------------------------------
    if not FIXTURE.exists():
        print(f"FAIL  fixture missing: {FIXTURE}")
        return 1
    code, out = run([str(FIXTURE)])
    if "6 found" not in out:
        failures.append("did not report all six planted marks:\n    "
                        + out.strip().replace("\n", "\n    "))
    for phrase, form in MUST_NAME.items():
        if phrase not in out:
            failures.append(f"{form} was found but not named: "
                            f"no {phrase!r} in the report")
    if code == 0:
        failures.append("a document carrying annotations exited 0")

    # The fenced block holds two more marks and the `%%…%%` comment one more
    # opportunity to over-fire. "6 found" above already proves neither counted,
    # but say so explicitly so a regression names itself.
    if "8 found" in out:
        failures.append("marks inside a fenced block were counted as "
                        "annotations on the document")

    # --- 2. every check is exercised --------------------------------------
    for check in check_annotations.CHECKS:
        if check.cid not in out:
            failures.append(f"{check.cid}: check did not run")

    # --- 3. precision on a clean document ---------------------------------
    with tempfile.TemporaryDirectory() as td:
        tmp = Path(td) / "clean.md"
        tmp.write_text(CLEAN, encoding="utf-8")
        code, out = run([str(tmp)])
    noisy = [line for line in out.splitlines()
             if line.startswith("[WARN") or line.startswith("[HARD")]
    if noisy:
        failures.append("a document with no annotations produced findings:\n"
                        "    " + "\n    ".join(noisy))
    if code != 0:
        failures.append(f"a clean document exited {code}, expected 0")

    # --- 4. the grammar is precise, not greedy ----------------------------
    for src, want in GRAMMAR_CASES:
        got = len(criticmarkup.CRITIC_ANY.findall(src))
        if got != want:
            failures.append(f"CRITIC_ANY on {src!r} matched {got}, "
                            f"want {want}")

    # --- 5. graceful degradation ------------------------------------------
    code, out = run(["/definitely/not/here.md"])
    if "does not exist" not in out or code != 0:
        failures.append("a missing file should SKIP, not fail")

    code, out = run(["--list-checks"])
    if code != 0 or "leftover-annotation" not in out:
        failures.append("--list-checks is broken")

    # --- report ------------------------------------------------------------
    if failures:
        print(f"{len(failures)} failure(s):\n")
        for f in failures:
            print(f"  FAIL  {f}")
        return 1
    print(f"ok — 6 planted marks found, all {len(MUST_NAME)} fates named, "
          f"clean document silent")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
