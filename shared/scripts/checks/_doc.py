"""Loading and parsing a document: the shapes every element check reads.

Holds no rule. A check imports what it needs from here and states its own
principle; nothing in this module decides whether anything is wrong.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from report import _envf  # noqa: E402

from ._xlsx import Cell, Workbook  # noqa: E402

# ---------------------------------------------------------------------------
# Thresholds
# ---------------------------------------------------------------------------


def env_name(key: str) -> str:
    """The environment variable a threshold key is read from."""
    return f"PAPERBELL_{key.upper()}"


def _threshold(key: str, default: float) -> float:
    """Read ``PAPERBELL_<KEY>``, falling back to the old ``SWS_`` spelling.

    ``key`` carries its own element prefix (``table_caption_min_words``), so a
    threshold belonging to some other element does not silently acquire a
    ``TABLE_`` one. The ``SWS_`` prefix is what this pack used before it stopped
    deferring to another pack; it is still honoured so an existing ``.env`` does
    not quietly stop taking effect, but new keys should use ``PAPERBELL_``.
    """
    fallback = _envf(f"SWS_{key.upper()}", default)
    return _envf(env_name(key), fallback)


def build_thresholds() -> dict[str, float]:
    """Defaults are argued for in env.example, not invented here."""
    return {
        # A row-1 cell of at least this many words is a caption, not a column
        # heading. Column headings are short by nature, so the two rarely collide.
        "table_caption_min_words": _threshold("table_caption_min_words", 4),
    }


# ---------------------------------------------------------------------------
# Patterns
# ---------------------------------------------------------------------------

FRONTMATTER = re.compile(r"\A---\n.*?\n---\n", re.S)
FENCE = re.compile(r"^(```+|~~~+).*?^\1\s*$", re.S | re.M)

# An xlsx-table block: the filter accepts `xlsx-table` and the alias `xlsx`.
XLSX_BLOCK = re.compile(r"^(```+)\s*(?:xlsx-table|xlsx)\s*\n(.*?)^\1\s*$", re.S | re.M)
CONFIG_LINE = re.compile(r"^\s*([\w-]+)\s*:\s*(.*?)\s*$")

# A markdown pipe table is only a table once the delimiter row appears; requiring it
# keeps prose that happens to contain a pipe out of the finding list.
PIPE_DELIM = re.compile(r"^\s{0,3}\|?[\s:|-]*-{3,}[\s:|-]*\|[\s:|-]*$")

REF = re.compile(r"\\ref\{([^}]+)\}")
FIG_LABEL = re.compile(r"\{#(fig:[A-Za-z0-9_:.-]+)[^}]*\}")
# pandoc-crossref's own reference syntax, which an xlsx table never answers to.
CROSSREF_AT = re.compile(r"(?<![\w@])-?@(tbl|fig):[A-Za-z0-9_:.-]+")

S_PREFIX = re.compile(r"\\renewcommand\s*\{?\s*\\the(table|figure)\s*\}?\s*\{\s*S\\arabic")

SI_NAME = re.compile(r"suppl|supporting|(^|[-_])si([-_.]|$)", re.I)
SI_TITLE = re.compile(r"^\s*(?:#\s*|title:\s*[\"']?)\s*supplementary", re.I | re.M)

SHEET_MAIN = re.compile(r"^table\s*0*(\d+)\s*$", re.I)
SHEET_SI = re.compile(r"^table\s*s\s*0*(\d+)\s*$", re.I)

# An image: caption, target, and any trailing Pandoc attribute block.
IMAGE = re.compile(r"!\[(?P<cap>[^\]]*)\]\((?P<src>[^)\s]+)[^)]*\)(?:\{(?P<attr>[^}]*)\})?")
# A citation key in a [@a; @b] group or a bare inline @key.
CITE = re.compile(r"(?<![\w@])-?@([A-Za-z][\w:.#$%&+?<>~/-]*)")
BIB_ENTRY = re.compile(r"^@\w+\s*\{\s*([^,\s]+)\s*,", re.M)
YAML_KEY = re.compile(r"^([A-Za-z_][\w-]*)\s*:\s*(.*?)\s*$", re.M)


# ---------------------------------------------------------------------------
# Parsing the manuscript
# ---------------------------------------------------------------------------


def blank_fences(text: str) -> str:
    """Blank fenced blocks, keeping the line count so line numbers stay true."""
    return FENCE.sub(lambda m: "\n" * m.group(0).count("\n"), text)


def line_of(text: str, pos: int) -> int:
    return text[:pos].count("\n") + 1


def parse_blocks(text: str) -> list[dict]:
    out = []
    for m in XLSX_BLOCK.finditer(text):
        cfg: dict[str, str] = {}
        for raw in m.group(2).splitlines():
            hit = CONFIG_LINE.match(raw)
            if not hit:
                continue
            val = re.sub(r"\s*--.*$", "", hit.group(2)).strip()
            val = re.sub(r"^\"(.*)\"$|^'(.*)'$", lambda x: x.group(1) or x.group(2) or "", val)
            cfg[hit.group(1).lower()] = val
        cfg["line"] = line_of(text, m.start())
        out.append(cfg)
    return out


def resource_path(path: Path) -> list[Path]:
    """The directories the export searches, in its order."""
    here = path.resolve().parent
    return [here, here / "figs", here.parent / "figs"]


def detect_kind(path: Path, raw: str) -> str:
    """By filename and title only — never by the S-prefix block, which is the
    thing the SI checks are here to look for."""
    if SI_NAME.search(path.stem) or SI_TITLE.search(raw):
        return "si"
    return "main"


def load(path: Path, kind: str) -> dict | None:
    try:
        raw = path.read_text(encoding="utf-8")
    except OSError:
        return None
    body = FRONTMATTER.sub(lambda m: "\n" * m.group(0).count("\n"), raw)
    blocks = parse_blocks(body)
    books: dict[Path, Workbook] = {}
    for blk in blocks:
        resolved = None
        for base in resource_path(path):
            cand = base / blk.get("file", "")
            if blk.get("file") and cand.is_file():
                resolved = cand.resolve()
                break
        blk["resolved"] = resolved
        if resolved is not None and resolved not in books:
            books[resolved] = Workbook(resolved)
    return {
        "path": path,
        "label": str(path),
        "kind": kind if kind != "auto" else detect_kind(path, raw),
        "raw": raw,
        "text": body,
        "prose": blank_fences(body),
        "blocks": blocks,
        "books": books,
    }


def sheet_of(doc: dict, blk: dict) -> list[list[Cell]] | None:
    book = doc["books"].get(blk.get("resolved"))
    if book is None or book.error:
        return None
    name = blk.get("sheet")
    if not name:                       # the filter falls back to the first sheet
        return next(iter(book.sheets.values()), None)
    return book.sheets.get(name)


def cells(row: list[Cell]) -> list[str]:
    return [c.text for c in row if c.text]


def skip_n(blk: dict) -> int:
    try:
        return max(0, int(blk.get("skip_n", "0") or 0))
    except ValueError:
        return 0


def where(blk: dict) -> str:
    return f"{blk.get('sheet') or '(first sheet)'} in {blk.get('file') or '(no file)'}"



def frontmatter(doc: dict) -> dict[str, str]:
    """The document's own YAML block, flat keys only.

    A longform project's real frontmatter lives in its index note, not here;
    ``_project.py`` supplies that and stores it under the same key.
    """
    if "frontmatter" in doc:
        return doc["frontmatter"]
    m = FRONTMATTER.match(doc["raw"])
    if not m:
        return {}
    return {k.lower(): v.strip("\"'") for k, v in YAML_KEY.findall(m.group(0))}
