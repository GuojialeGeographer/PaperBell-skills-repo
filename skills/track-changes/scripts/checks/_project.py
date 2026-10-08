"""Loading a longform project, so findings land on the file you can edit.

The files at a longform project's root are generated. Editing one is wasted
work: the next compile overwrites it, and the real mistake is still upstream in
a scene or an index note. So when handed a directory, assemble the scenes the
way the index note says and keep a map back to ``(scene, line)`` — a finding
then names ``source/Results.md:14`` rather than a line in an artifact.

Only enough YAML is parsed to find the scene list and the flat frontmatter keys.
That is deliberate: this pack is stdlib-only, and a real YAML parser would be a
dependency bought for two block-sequences.
"""
from __future__ import annotations

import bisect
import re
from pathlib import Path

from ._doc import FRONTMATTER, YAML_KEY, blank_fences

INDEX_GLOB = "*Index.md"
LONGFORM_KEY = re.compile(r"^longform\s*:", re.M)

# `  - Introduction` under a key, at any indent.
LIST_ITEM = re.compile(r"^\s*-\s+(.+?)\s*$")

# An indented `key: value` — the longform block's own keys. Values only; a key
# introducing a block sequence (empty value) is not captured.
NESTED_KEY = re.compile(r"^[ \t]+([A-Za-z_][\w-]*)\s*:[ \t]+(\S.*?)\s*$", re.M)

# draftTitle -> the kind of document that draft is. Matched on a substring, not
# an exact key: an unrecognised title silently becoming "main" would fire
# `main-no-s-prefix` as a HARD on a perfectly correct supplement, and a wrong
# HARD on a correct document is the most expensive thing this checker can do.
DRAFT_KIND = (
    ("suppl", "si"),
    ("response", "rl"),
    ("rebuttal", "rl"),
    ("cover", "cl"),
    ("manuscript", "main"),
)


# `si` only as a whole word — it is a substring of far too much to match loosely.
DRAFT_SI_WORD = re.compile(r"\bsi\b", re.I)


def draft_kind(draft_title: str) -> str:
    lowered = draft_title.lower()
    for needle, kind in DRAFT_KIND:
        if needle in lowered:
            return kind
    return "si" if DRAFT_SI_WORD.search(lowered) else "main"


# Drafts this pack does not yet model well enough to check. See load_project().
SKIPPED_KINDS = {"rl", "cl"}


def _block_list(text: str, key: str) -> list[str]:
    """The items of a `key:` block sequence, stopping at the next key.

    Anything that is not a list item ends the sequence, whatever its indent. A
    deeper non-item line means a nested mapping has started, and continuing
    would absorb *its* items into this list.
    """
    m = re.search(rf"^(\s*){key}\s*:\s*$", text, re.M)
    if not m:
        return []
    indent = len(m.group(1))
    out = []
    for raw in text[m.end():].splitlines():
        if not raw.strip():
            continue
        item = LIST_ITEM.match(raw)
        if item is None or len(raw) - len(raw.lstrip()) <= indent:
            break
        out.append(item.group(1).strip("\"'"))
    return out


def _longform_block(head: str) -> str:
    """Just the `longform:` mapping — from its key to the next top-level one."""
    m = LONGFORM_KEY.search(head)
    if not m:
        return ""
    rest = head[m.end():].splitlines()
    out = []
    for raw in rest:
        if raw.strip() and not raw[:1].isspace():
            break               # back at column 0: a new top-level key
        out.append(raw)
    return "\n".join(out)


def _index_meta(path: Path) -> dict | None:
    try:
        raw = path.read_text(encoding="utf-8")
    except OSError:
        return None
    m = FRONTMATTER.match(raw)
    if not m or not LONGFORM_KEY.search(m.group(0)):
        return None
    head = m.group(0)
    flat = {k.lower(): v.strip("\"'") for k, v in YAML_KEY.findall(head)}
    # draftTitle, sceneFolder and workflow are nested under `longform:`, so the
    # top-level-only YAML_KEY never sees them. Read them from *that block only*:
    # scanning the whole frontmatter would also pick up `name:` and `email:` out
    # of every author entry, and the last one written would win.
    nested = {k.lower(): v.strip("\"'")
              for k, v in NESTED_KEY.findall(_longform_block(head))}
    return {
        "frontmatter": flat,
        "scenes": _block_list(head, "scenes"),
        "scene_folder": nested.get("scenefolder", "/source").strip("/"),
        "draft_title": nested.get("drafttitle", path.stem),
    }


def _assemble(root: Path, meta: dict) -> tuple[str, list[tuple[int, Path]]]:
    """Concatenate the scenes; return the text and a line map into it.

    The map is a list of ``(first_assembly_line, scene_path)`` in ascending
    order, so ``_locator`` can resolve an assembly line with one bisect. A
    scene's own frontmatter is blanked rather than dropped, keeping its line
    count, so the offset back into the scene file is exact.
    """
    folder = root / meta["scene_folder"]
    text_parts: list[str] = []
    line_map: list[tuple[int, Path]] = []
    cursor = 1
    for name in meta["scenes"]:
        scene = folder / f"{name}.md"
        if not scene.is_file():
            continue
        raw = scene.read_text(encoding="utf-8", errors="replace")
        body = FRONTMATTER.sub(lambda m: "\n" * m.group(0).count("\n"), raw)
        line_map.append((cursor, scene))
        text_parts.append(body)
        cursor += body.count("\n") + 2   # +2 for the blank line between scenes
        text_parts.append("\n\n")
    return "".join(text_parts), line_map


def _locator(root: Path, line_map: list[tuple[int, Path]]):
    """Turn an assembly line number into ``scene.md:LN`` — the editable file.

    This is the whole point of pointing the checker at a directory: a finding
    reported against a line of the concatenation is a finding nobody can act on.
    """
    starts = [start for start, _ in line_map]

    def locate(line: int) -> str:
        i = bisect.bisect_right(starts, line) - 1
        if i < 0:
            return f"L{line}"
        start, scene = line_map[i]
        try:
            name = scene.relative_to(root)
        except ValueError:
            name = scene
        return f"{name}:L{line - start + 1}"

    return locate


def load_project(root: Path, kind: str = "auto") -> list[dict]:
    """One document per index note, scenes assembled in the index's order."""
    docs: list[dict] = []
    skipped: list[tuple[str, str]] = []
    for index in sorted(root.glob(INDEX_GLOB)):
        meta = _index_meta(index)
        if meta is None:
            continue
        this_kind = (kind if kind != "auto"
                     else draft_kind(meta["draft_title"]))
        # A response letter is not a self-contained document: its figures and
        # its quoted prose arrive through ```manuscript transclusion, so every
        # \ref in it resolves at compile time and none of them resolve here.
        # Checking it would report a page of defects that are not defects.
        # Modelling the anchors is a separate piece of work; until then, skip.
        if this_kind in SKIPPED_KINDS:
            skipped.append((index.name, this_kind))
            continue
        text, line_map = _assemble(root, meta)
        if not text.strip():
            continue
        # Reuse the single-file loader for everything below the assembly, by
        # handing it the assembled text through a synthetic document.
        doc = _as_doc(root, index, meta, this_kind, text, line_map)
        docs.append(doc)
    for name, why in skipped:
        docs.append({"skipped_draft": name, "kind": why})
    return docs


def _as_doc(root, index, meta, kind, text, line_map) -> dict:
    from ._doc import Workbook, parse_blocks, resource_path

    blocks = parse_blocks(text)
    books: dict[Path, Workbook] = {}
    # The same three directories the export searches; never a second copy.
    bases = resource_path(root / "_assembled.md")
    for blk in blocks:
        resolved = None
        for base in bases:
            cand = base / blk.get("file", "")
            if blk.get("file") and cand.is_file():
                resolved = cand.resolve()
                break
        blk["resolved"] = resolved
        if resolved is not None and resolved not in books:
            books[resolved] = Workbook(resolved)
    return {
        "path": root / "_assembled.md",     # for resource_path(); never read
        "project": root,
        "index": index,
        "label": f"{index.name} -> {meta['draft_title']} "
                 f"({len(meta['scenes'])} scenes)",
        "kind": kind,
        "frontmatter": meta["frontmatter"],
        "raw": text,
        "text": text,
        "prose": blank_fences(text),
        "blocks": blocks,
        "books": books,
        "locate": _locator(root, line_map),
    }
