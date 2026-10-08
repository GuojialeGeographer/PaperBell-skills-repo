#!/usr/bin/env python3
r"""Check how a document is written down, one carrier element at a time.

Deterministic, stdlib only. Every check belongs to an **element** — frontmatter,
figures, tables, citations, crossrefs, supplementary, annotations — and names
the principle behind each finding.

Two ways a check can decline to say anything, and they mean different things:
a check whose *input* is absent (no image, no workbook, no bibliography) reports
SKIP; a check that is about the other kind of document reports n/a. Both are
counted separately, because "there are no tables here" and "this check is about
the SI" are different facts.

Usage
-----
    python3 check_format.py TARGET [TARGET ...] [options]

TARGET is either a markdown file, or a **longform project directory** — a
directory holding one or more ``*_Index.md`` notes. Given a directory, the
scenes are assembled in the index's order and every finding is reported against
the scene file that can actually be edited, rather than against the generated
artifact.

    --kind KIND       main | si | auto   (default: auto)
    --only A,B        run only these checks or elements
    --skip A,B        run everything except these checks or elements
    --strict          treat warnings as failures
    --list-checks     print every check with its element, pass, kind, principle

Configuration
-------------
Thresholds are ``PAPERBELL_*`` environment variables, or a ``.env`` at the cwd or
up to three parents (real environment wins). The older ``SWS_`` spelling is still
read as a fallback. See ``env.example`` next to this script.

Exit code is non-zero if any HARD problem is found, or with --strict any WARN.

Scope
-----
This pack owns encoding only. Nothing here judges whether a table deserves to
exist, what a caption should claim, or how a sentence reads.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from checks import ELEMENTS, PASSES, collect  # noqa: E402
from checks._doc import build_thresholds, env_name, load  # noqa: E402
from checks._project import load_project  # noqa: E402
from report import Report, load_dotenv  # noqa: E402


def analyse(doc: dict, rep: Report, th: dict, selected: list) -> None:
    # An assembled project reports against the scene file, not the concatenation.
    rep.locate = doc.get("locate")
    rep.lines.append(f"\n=== {doc['label']} ({doc['kind']} document) ===")
    rep.lines.append(f"{len(doc['blocks'])} xlsx-table block(s), "
                     f"{len(doc['books'])} workbook(s) resolved")
    for pass_id, pass_name in PASSES.items():
        in_pass = [c for c in selected if c.pass_ == pass_id]
        if not in_pass:
            continue
        rep.lines.append(f"\n-- {pass_id}  {pass_name} --")
        for check in in_pass:
            if not check.applies_to(doc["kind"]):
                rep.not_applicable(check.cid, f"reads the {check.kind} document")
                continue
            rep.principle = check.principle
            try:
                check.fn(doc, rep, th)
            except Exception as exc:  # a broken check must not kill the run
                rep.principle = None
                rep.check(check.cid, "SKIP", f"check errored: {exc!r}")
            finally:
                rep.principle = None
    rep.locate = None


def expand(raw: str, all_checks: list, ap) -> set[str]:
    """A selector names either a check id or a whole element."""
    want = {c.strip() for c in raw.split(",") if c.strip()}
    ids = {c.cid for c in all_checks}
    out: set[str] = set()
    unknown = []
    for name in want:
        if name in ids:
            out.add(name)
        elif name in ELEMENTS:
            out.update(c.cid for c in all_checks if c.element == name)
        else:
            unknown.append(name)
    if unknown:
        ap.error(f"unknown check or element: {', '.join(sorted(unknown))}\n"
                 f"elements are: {', '.join(ELEMENTS)}")
    return out


def documents(target: Path, kind: str) -> list[dict]:
    """Every document a target names — one for a file, one per index note."""
    if target.is_dir():
        return load_project(target, kind)
    doc = load(target, kind)
    return [doc] if doc else []


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("targets", nargs="*", type=Path,
                    help="markdown files, or a longform project directory")
    ap.add_argument("--kind", choices=("main", "si", "auto"), default="auto")
    ap.add_argument("--only", default=None, help="comma-separated check ids or elements")
    ap.add_argument("--skip", default=None, help="comma-separated check ids or elements")
    ap.add_argument("--strict", action="store_true", help="treat warnings as failures")
    ap.add_argument("--list-checks", action="store_true",
                    help="print every check and threshold, then exit")
    args = ap.parse_args(argv)

    all_checks = collect()

    cwd = Path.cwd()
    load_dotenv([cwd / ".env", *[p / ".env" for p in list(cwd.parents)[:3]]])
    th = build_thresholds()

    # Selection happens before --list-checks, not after: an entry point that
    # supplies a default --only (the check_tables / check_annotations shims)
    # must advertise exactly the checks it will actually run.
    selected = all_checks
    if args.only:
        want = expand(args.only, all_checks, ap)
        selected = [c for c in all_checks if c.cid in want]
    if args.skip:
        drop = expand(args.skip, all_checks, ap)
        selected = [c for c in selected if c.cid not in drop]

    if args.list_checks:
        print("checks (element / id / kind / principle):\n")
        for pass_id, pass_name in PASSES.items():
            in_pass = [c for c in selected if c.pass_ == pass_id]
            if not in_pass:
                continue
            print(f"  {pass_id}  {pass_name}")
            for c in in_pass:
                print(f"       {c.element:14} {c.cid:22} "
                      f"[{c.kind or 'any':4}] {c.principle}")
        print("\nthresholds (override with PAPERBELL_* env vars or a .env file):\n")
        for key, val in sorted(th.items()):
            print(f"  {env_name(key):38} {val:g}")
        return 0

    if not args.targets:
        ap.error("no target given (use --list-checks to inspect the checks)")

    rep = Report()
    for target in args.targets:
        docs = documents(target, args.kind)
        if not docs:
            rep.lines.append(f"\n=== {target} ===")
            rep.check("read", "SKIP",
                      "does not exist, could not be read, or holds no index note")
            continue
        for doc in docs:
            if "skipped_draft" in doc:
                rep.lines.append(f"\n=== {doc['skipped_draft']} ===")
                rep.check("draft", "SKIP",
                          f"a {doc['kind']} draft — its figures and quoted prose "
                          f"arrive by transclusion, so nothing here resolves "
                          f"statically")
                continue
            analyse(doc, rep, th, selected)

    print("\n".join(rep.lines))
    print(f"\n=== {rep.hard} hard problem(s), {rep.warn} warning(s), "
          f"{len(rep.skipped)} skipped (input absent), "
          f"{rep.not_applicable_count} n/a (other document kind) ===")
    if rep.hard or (args.strict and rep.warn):
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
