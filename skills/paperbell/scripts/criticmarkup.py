#!/usr/bin/env python3
r"""CriticMarkup: the patterns, and how an annotated document reads today.

The six marks and the ``key="value"`` prefix grammar are stated once, in
``references/criticmarkup.md``. This is that grammar as regexes, plus the one
operation every consumer needs: resolve a reviewed draft to **the text as it
stands today** — nothing accepted, so a proposed insertion goes and a proposed
deletion stays.

Two packs need this and neither owns the other, so this file is copied rather
than shared. Keep the two copies identical; the grammar is stable and the
reference is the arbiter. The other copy is
SongshGeo/scientific-writting-skills, scripts/criticmarkup.py, at eb0eca7.

Stdlib only.
"""
from __future__ import annotations

import re

# The optional prefix is `key="value"` pairs between the brace and the sigil,
# with no leading space and the closing quote abutting the sigil; a value may
# not contain a quote, a brace, or a newline. Requiring that grammar is the
# precision buy (CLAUDE.md rule 4): a malformed mark — {author="X++text++} with
# the quote unclosed — matches nothing and keeps its text, rather than a loose
# pattern swallowing a paragraph of real prose. Payloads may not span a blank
# line for the same reason.
_CM_PREFIX = r'(?:[a-z]+="[^"{}\n]*"\s*)*'
_CM_BODY = r"(?:(?!\n[ \t]*\n).)*?"


def _critic(sigil_open: str, sigil_close: str) -> re.Pattern:
    return re.compile(r"\{" + _CM_PREFIX + re.escape(sigil_open)
                      + r"(" + _CM_BODY + r")" + re.escape(sigil_close)
                      + r"\}", re.S)


# The six forms are mutually exclusive at the opening sigil, so no ordering
# between them is needed; all of them must run before a maths collapse and
# before anything that reads a bare `==...==`.
CRITIC_DROP = (_critic(">>", "<<"), _critic("++", "++"))
CRITIC_KEEP = (_critic("==", "=="), _critic("=+", "+="), _critic("--", "--"))
# A substitution proposes replacing old with new; the document still reads
# `old`, so the arrow and everything after it goes.
CRITIC_SUB = _critic("~~", "~~")

# Any mark at all, with its opening sigil captured — for a consumer that wants
# to find annotations rather than resolve them.
CRITIC_ANY = re.compile(
    r"\{" + _CM_PREFIX + r"(>>|\+\+|--|~~|==|=\+)" + _CM_BODY
    + r"(?:<<|\+\+|--|~~|==|\+=)\}", re.S)


def _pad(kept: str, whole: str) -> str:
    """Keep the line count stable when a mark's dropped half held newlines."""
    return kept + "\n" * (whole.count("\n") - kept.count("\n"))


def strip_critic(text: str) -> str:
    """Resolve CriticMarkup to the text as the document currently reads."""
    for pat in CRITIC_DROP:
        text = pat.sub(lambda m: _pad("", m.group(0)), text)
    for pat in CRITIC_KEEP:
        text = pat.sub(lambda m: _pad(m.group(1), m.group(0)), text)
    return CRITIC_SUB.sub(
        lambda m: _pad(m.group(1).split("~>")[0], m.group(0)), text)
