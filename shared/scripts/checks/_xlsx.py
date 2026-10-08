"""The .xlsx reader — zip + XML, the way xlsx_table.lua does it.

Read with ``zipfile`` rather than a spreadsheet library on purpose: the export
filter reads each cell's *cached value* out of the sheet XML, so reading it the
same way is what stops the checker and the renderer disagreeing about what a
sheet contains.
"""
from __future__ import annotations

import html
import re
import zipfile
from pathlib import Path

# xlsx internals — the same shapes the Lua filter matches.
# xlsx internals — the same shapes the Lua filter matches.
X_ROW = re.compile(r"<row[^>]*>(.*?)</row>", re.S)
X_CELL = re.compile(r"<c([^>]*?)(?:/>|>(.*?)</c>)", re.S)
X_V = re.compile(r"<v[^>]*>(.*?)</v>", re.S)
X_F = re.compile(r"<f[^>]*(?:/>|>.*?</f>)", re.S)
X_T = re.compile(r"<t[^>]*>(.*?)</t>", re.S)
X_SI = re.compile(r"<si>(.*?)</si>", re.S)
X_SHEET = re.compile(r"<sheet\b([^>]*)/?>")
X_REL = re.compile(r"<Relationship\b([^>]*)/?>")
X_ATTR = re.compile(r"([\w:]+)\s*=\s*\"([^\"]*)\"")



class Cell:
    __slots__ = ("ref", "text", "formula_blank")

    def __init__(self, ref: str, text: str, formula_blank: bool) -> None:
        self.ref = ref
        self.text = text
        self.formula_blank = formula_blank


def _attrs(raw: str) -> dict[str, str]:
    return {k: v for k, v in X_ATTR.findall(raw)}


def _shared_strings(z: zipfile.ZipFile) -> list[str]:
    try:
        xml = z.read("xl/sharedStrings.xml").decode("utf-8", "replace")
    except KeyError:
        return []
    return ["".join(html.unescape(t) for t in X_T.findall(si))
            for si in X_SI.findall(xml)]


def _sheet_members(z: zipfile.ZipFile) -> dict[str, str]:
    """Sheet name -> the zip member holding it, in workbook order."""
    try:
        book = z.read("xl/workbook.xml").decode("utf-8", "replace")
    except KeyError:
        return {}
    targets: dict[str, str] = {}
    try:
        rels = z.read("xl/_rels/workbook.xml.rels").decode("utf-8", "replace")
        for raw in X_REL.findall(rels):
            a = _attrs(raw)
            tgt = a.get("Target", "")
            if not tgt:
                continue
            member = tgt[1:] if tgt.startswith("/") else f"xl/{tgt}"
            targets[a.get("Id", "")] = member.replace("xl/xl/", "xl/")
    except KeyError:
        pass
    out: dict[str, str] = {}
    for i, raw in enumerate(X_SHEET.findall(book), start=1):
        a = _attrs(raw)
        name = html.unescape(a.get("name", ""))
        member = targets.get(a.get("r:id", ""), f"xl/worksheets/sheet{i}.xml")
        if member in z.namelist():
            out[name] = member
    return out


def _read_sheet(z: zipfile.ZipFile, member: str, shared: list[str]) -> list[list[Cell]]:
    xml = z.read(member).decode("utf-8", "replace")
    rows: list[list[Cell]] = []
    for body in X_ROW.findall(xml):
        row: list[Cell] = []
        for raw_attr, inner in X_CELL.findall(body):
            a = _attrs(raw_attr)
            inner = inner or ""
            ctype = a.get("t", "n")
            vm = X_V.search(inner)
            if ctype == "s":
                idx = int(vm.group(1)) if vm and vm.group(1).isdigit() else -1
                text = shared[idx] if 0 <= idx < len(shared) else ""
            elif ctype == "inlineStr":
                text = "".join(html.unescape(t) for t in X_T.findall(inner))
            else:
                text = html.unescape(vm.group(1)) if vm else ""
            # A formula whose value was never computed: either no <v> at all, or
            # the empty <v></v> that openpyxl writes. Both render as a blank cell.
            blank = bool(X_F.search(inner)) and not (vm and vm.group(1).strip())
            row.append(Cell(a.get("r", ""), text.strip(), blank))
        rows.append(row)
    return rows


class Workbook:
    """One workbook, read once and shared by every check that needs it."""
    __slots__ = ("path", "sheets", "error")

    def __init__(self, path: Path) -> None:
        self.path = path
        self.sheets: dict[str, list[list[Cell]]] = {}
        self.error: str | None = None
        try:
            with zipfile.ZipFile(path) as z:
                shared = _shared_strings(z)
                for name, member in _sheet_members(z).items():
                    self.sheets[name] = _read_sheet(z, member, shared)
        except (OSError, zipfile.BadZipFile, KeyError) as exc:
            self.error = repr(exc)
