#!/usr/bin/env python3
"""The report layer every checker in this pack shares.

Three things, and deliberately nothing else: how a finding is printed, how a
threshold is read, and how a `.env` is found. No rule, no principle, no
judgement lives here — those belong to the checker that imports it.

Keeping it in one file is what lets a checker be moved to another pack without
dragging a whole linter behind it as a dependency.

**Copied in.** Origin is SongshGeo/scientific-writting-skills, scripts/report.py,
taken at eb0eca7 — copied rather than depended on, because both packs need it and
neither owns the other. This pack now owns its copy: the `locate` hook below is a
local addition, so the two files are no longer identical and are not meant to be.

Stdlib only.
"""
from __future__ import annotations

import os
from pathlib import Path

# ---------------------------------------------------------------------------
# .env loading (stdlib)
# ---------------------------------------------------------------------------


def load_dotenv(paths: list[Path]) -> None:
    """Populate os.environ from the first existing .env, never overriding a
    real environment variable."""
    for path in paths:
        if not path.is_file():
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except OSError:
            continue
        for raw in text.splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            key = key.strip()
            val = val.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = val
        return


def _envf(key: str, default: float) -> float:
    raw = os.environ.get(key)
    if raw is None:
        return default
    try:
        return float(raw)
    except ValueError:
        return default


# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------


class Report:
    """Accumulates the human-readable report.

    `principle` is set by the driver around each check, so `check()` can print
    the principle at append time rather than the driver splicing it into an
    already-formatted line afterwards.
    """

    def __init__(self) -> None:
        self.lines: list[str] = []
        self.hard = 0
        self.warn = 0
        self.skipped: list[str] = []
        self.not_applicable_count = 0
        self.principle: str | None = None
        # Set by the driver when the document being checked was assembled from
        # several files, so a line number can be reported against the file the
        # author can actually edit. None means "report the number as given".
        self.locate = None

    def check(self, cid: str, status: str, note: str = "") -> None:
        tail = f" — {note}" if note else ""
        self.lines.append(f"[{status:4}] {cid}{tail}")
        if self.principle:
            self.lines.append(f"         ({self.principle})")
        if status == "SKIP":
            self.skipped.append(cid)

    def not_applicable(self, cid: str, why: str) -> None:
        """The check does not apply here — a different fact from SKIP, which
        means the input it needs is absent."""
        self.not_applicable_count += 1
        self.lines.append(f"[n/a ] {cid} — {why}")

    def hard_fail(self, msg: str, line: int | None = None) -> None:
        self.hard += 1
        self.lines.append(f"         HARD {self._loc(line)}{msg}")

    def warning(self, msg: str, line: int | None = None) -> None:
        self.warn += 1
        self.lines.append(f"         WARN {self._loc(line)}{msg}")

    def info(self, msg: str, line: int | None = None) -> None:
        self.lines.append(f"              {self._loc(line)}{msg}")

    def _loc(self, line: int | None) -> str:
        if not line:
            return ""
        if self.locate is not None:
            return f"{self.locate(line)}: "
        return f"L{line}: "
