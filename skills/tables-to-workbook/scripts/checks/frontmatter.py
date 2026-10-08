"""Frontmatter — the keys the export cannot supply for itself.

In a longform project these live in the index note, not in the generated
artifact, and ``_project.py`` supplies them from there. Handed a bare artifact
with no frontmatter at all, every check here SKIPs rather than guessing: a
document with no YAML block is not necessarily a document with a missing key.
"""
from __future__ import annotations

import re

from . import Check
from ._doc import frontmatter

EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _sibling_index(doc) -> bool:
    """Is this file a generated artifact of a longform project?

    Evidence, not a guess: a longform index note sitting in the same directory.
    """
    if doc.get("project"):
        return False          # already reading the index note itself
    try:
        return any(doc["path"].resolve().parent.glob("*Index.md"))
    except OSError:
        return False


def c_csl_present(doc, rep, th) -> None:
    fm = frontmatter(doc)
    if not fm:
        rep.check("csl-present", "SKIP", "no frontmatter to read")
        return
    val = fm.get("csl", "").strip()
    if val:
        rep.check("csl-present", "ok", f"csl: {val}")
        return
    # An empty `csl:` in a *generated* artifact means the key was consumed by the
    # build, not that it is missing — references/elements/frontmatter.md says so,
    # and a check that contradicts this pack's own reference is the check that is
    # wrong. A sibling index note is the evidence that this file is generated.
    if "csl" in fm and _sibling_index(doc):
        rep.check("csl-present", "SKIP",
                  "csl is empty in a generated artifact — the index note carries it")
        return
    where = "index note" if doc.get("project") else "frontmatter"
    state = "empty" if "csl" in fm else "absent"
    rep.check("csl-present", "HARD", f"csl is {state}")
    rep.hard_fail(f"csl is {state} in the {where} — a missing style is a missing "
                  f"bibliography, not a default one")


def c_filename_keys(doc, rep, th) -> None:
    fm = frontmatter(doc)
    if not fm:
        rep.check("filename-keys", "SKIP", "no frontmatter to read")
        return
    # A longform index note routinely omits date:, because the workflow supplies
    # it at build time. Asking for it there is a false positive, and a checker
    # that cries wolf about the normal case stops being read.
    wanted = ("acronym",) if doc.get("project") else ("acronym", "date")
    missing = [k for k in wanted if not fm.get(k, "").strip()]
    rep.check("filename-keys", "WARN" if missing else "ok",
              f"{len(missing)} of {'/'.join(wanted)} missing")
    for key in missing:
        rep.warning(f"{key} is not set — acronym and date are the output "
                    f"filename, <acronym>_<date>.pdf")


def c_corresponding_email(doc, rep, th) -> None:
    fm = frontmatter(doc)
    raw = fm.get("corresponding", "").strip()
    if not raw:
        rep.check("corresponding-email", "SKIP", "no corresponding: key")
        return
    if EMAIL.match(raw):
        rep.check("corresponding-email", "ok", raw)
        return
    rep.check("corresponding-email", "WARN", f"not an address: {raw!r}")
    rep.warning(f"corresponding: {raw!r} is printed verbatim after "
                f"'Corresponding author:' — it wants an email address, so "
                f"writing 'yes' prints the word yes")


CHECKS = [
    Check("csl-present", "B",
          "a missing style is a missing bibliography, not a default one",
          c_csl_present),
    Check("filename-keys", "B",
          "acronym and date are the output filename",
          c_filename_keys),
    Check("corresponding-email", "C",
          "corresponding: is printed verbatim, so it wants an address",
          c_corresponding_email),
]
