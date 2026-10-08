"""Tables — the binding between an xlsx-table block and the sheet it names.

Owns whether the block resolves to a real sheet and whether that sheet will
render. Whether the table deserves to exist, and what its caption should claim,
are facts about the writing and are checked nowhere in this pack.
"""
from __future__ import annotations

from . import Check
from ._doc import (
    PIPE_DELIM, SHEET_MAIN, SHEET_SI, cells, resource_path, sheet_of, skip_n, where,
)
from ._xlsx import Workbook


def c_pipe_table(doc, rep, th) -> None:
    lines = doc["prose"].splitlines()
    hits = [i for i, ln in enumerate(lines, start=1)
            if PIPE_DELIM.match(ln) and i >= 2 and "|" in lines[i - 2]]
    rep.check("pipe-table", "HARD" if hits else "ok",
              f"{len(hits)} markdown table(s) in the body")
    for line in hits[:8]:
        rep.hard_fail("a hand-written table — its numbers have no source and it is "
                      "typeset outside the house style; move it to the workbook", line)
    if len(hits) > 8:
        rep.info(f"... and {len(hits) - 8} more")

def c_workbook_single(doc, rep, th) -> None:
    found: list[Path] = []
    for base in resource_path(doc["path"]):
        if not base.is_dir():
            continue
        for p in sorted(base.glob("*.xlsx")):
            if not p.name.startswith("~$") and p.resolve() not in {f.resolve() for f in found}:
                found.append(p)
    if not found:
        rep.check("workbook-single", "SKIP", "no workbook on the resource path")
        return
    rep.check("workbook-single", "WARN" if len(found) > 1 else "ok",
              f"{len(found)} workbook(s) on the resource path")
    if len(found) > 1:
        rep.warning("one project, one workbook — two is how a number comes to have "
                    "two values: " + ", ".join(p.name for p in found))

def c_xlsx_exists(doc, rep, th) -> None:
    blocks = doc["blocks"]
    if not blocks:
        rep.check("xlsx-exists", "SKIP", "no xlsx-table blocks in this document")
        return
    missing = [b for b in blocks if b.get("resolved") is None]
    rep.check("xlsx-exists", "HARD" if missing else "ok",
              f"{len(blocks) - len(missing)}/{len(blocks)} block(s) resolve")
    for blk in missing:
        rep.hard_fail(f"{blk.get('file') or '(no file: key)'} is not on the resource "
                      f"path — put the workbook in figs/", blk["line"])

def c_sheet_exists(doc, rep, th) -> None:
    live = [b for b in doc["blocks"] if b.get("resolved") is not None]
    if not live:
        rep.check("sheet-exists", "SKIP", "no block resolves to a workbook")
        return
    bad = []
    for blk in live:
        book = doc["books"][blk["resolved"]]
        if book.error:
            bad.append((blk, f"workbook unreadable: {book.error}"))
        elif blk.get("sheet") and blk["sheet"] not in book.sheets:
            have = ", ".join(sorted(book.sheets)[:6]) or "(none)"
            bad.append((blk, f"no sheet named {blk['sheet']!r} — the workbook has: {have}"))
    rep.check("sheet-exists", "HARD" if bad else "ok",
              f"{len(live) - len(bad)}/{len(live)} sheet(s) found")
    for blk, why in bad:
        rep.hard_fail(why, blk["line"])

def c_caption_for_float(doc, rep, th) -> None:
    blocks = doc["blocks"]
    if not blocks:
        rep.check("caption-for-float", "SKIP", "no xlsx-table blocks in this document")
        return
    unfloated = [b for b in blocks if b.get("label") and not b.get("caption")]
    unlabelled = [b for b in blocks if b.get("caption") and not b.get("label")]
    status = "HARD" if unfloated else ("WARN" if unlabelled else "ok")
    rep.check("caption-for-float", status,
              f"{len(unfloated)} labelled without a caption, "
              f"{len(unlabelled)} captioned without a label")
    for blk in unfloated:
        rep.hard_fail(f"{where(blk)}: label with no caption — the table is inlined "
                      f"unnumbered, so every \\ref to it dangles", blk["line"])
    for blk in unlabelled:
        rep.warning(f"{where(blk)}: a numbered float nothing can refer to — give it "
                    f"a label", blk["line"])

def c_formula_cells(doc, rep, th) -> None:
    live = [b for b in doc["blocks"] if sheet_of(doc, b) is not None]
    if not live:
        rep.check("formula-cells", "SKIP", "no sheet to read")
        return
    bad = []
    for blk in live:
        for row in sheet_of(doc, blk):
            for cell in row:
                if cell.formula_blank:
                    bad.append((blk, cell.ref))
    rep.check("formula-cells", "HARD" if bad else "ok",
              f"{len(bad)} formula cell(s) with no cached value")
    for blk, ref in bad[:8]:
        rep.hard_fail(f"{where(blk)} cell {ref}: a formula with no cached value "
                      f"renders as an empty cell — store the computed number",
                      blk["line"])
    if len(bad) > 8:
        rep.info(f"... and {len(bad) - 8} more")

def c_header_row(doc, rep, th) -> None:
    live = [b for b in doc["blocks"] if sheet_of(doc, b) is not None]
    if not live:
        rep.check("header-row", "SKIP", "no sheet to read")
        return
    findings = []
    for blk in live:
        rows = sheet_of(doc, blk)
        first = cells(rows[0]) if rows else []
        if not first:
            continue
        caption_like = (len(first) == 1
                        and len(first[0].split()) >= th["table_caption_min_words"])
        skip = skip_n(blk)
        if caption_like and skip == 0:
            findings.append((blk, "row 1 is a caption but skip_n is 0, so the "
                                  "caption will be typeset as the header row"))
        elif not caption_like and skip >= 1:
            findings.append((blk, f"skip_n is {skip}, which drops a row that looks "
                                  f"like the header: {' | '.join(first[:4])}"))
    rep.check("header-row", "WARN" if findings else "ok",
              f"{len(live) - len(findings)}/{len(live)} sheet(s) laid out as expected")
    for blk, why in findings:
        rep.warning(f"{where(blk)}: {why}", blk["line"])

def c_sheet_kind(doc, rep, th) -> None:
    named = [b for b in doc["blocks"]
             if b.get("sheet") and (SHEET_MAIN.match(b["sheet"]) or SHEET_SI.match(b["sheet"]))]
    if not named:
        rep.check("sheet-kind", "SKIP", "no sheet named 'Table N' or 'Table SN'")
        return
    want_si = doc["kind"] == "si"
    wrong = [b for b in named if bool(SHEET_SI.match(b["sheet"])) != want_si]
    rep.check("sheet-kind", "WARN" if wrong else "ok",
              f"{len(named) - len(wrong)}/{len(named)} sheet name(s) match a "
              f"{doc['kind']} document")
    for blk in wrong:
        rep.warning(f"{blk['sheet']} in a {doc['kind']} document — the sheet name is "
                    f"the table's number, so main text takes 'Table N' and the SI "
                    f"takes 'Table SN'", blk["line"])

def _index_rows(book: Workbook) -> tuple[list[list[str]], int] | None:
    """The _index sheet as rows of text, plus the column holding the source."""
    for name, rows in book.sheets.items():
        if name.strip().lower() != "_index":
            continue
        table = [[c.text for c in row] for row in rows]
        head = [c.lower() for c in table[0]] if table else []
        col = head.index("source") if "source" in head else 3
        return table[1:], col
    return None

def c_sheet_index(doc, rep, th) -> None:
    live = [b for b in doc["blocks"] if sheet_of(doc, b) is not None]
    if not live:
        rep.check("sheet-index", "SKIP", "no sheet to trace")
        return
    findings: list[tuple[dict | None, str]] = []
    # A workbook with no registry at all is one finding about the workbook, not one
    # per table in it.
    unregistered = {b["resolved"] for b in live
                    if _index_rows(doc["books"][b["resolved"]]) is None}
    for path in sorted(unregistered):
        findings.append((None, f"{path.name} has no _index sheet — one row per "
                               f"table: sheet, label, caption, source, updated"))
    traced = 0
    for blk in live:
        if blk["resolved"] in unregistered:
            continue
        rows, col = _index_rows(doc["books"][blk["resolved"]])
        name = (blk.get("sheet") or "").strip().lower()
        row = next((r for r in rows if r and r[0].strip().lower() == name), None)
        if row is None:
            findings.append((blk, f"{blk.get('sheet')} is not registered in _index"))
        elif len(row) <= col or not row[col].strip():
            findings.append((blk, f"{blk.get('sheet')} is registered with no source — "
                                  f"a table whose numbers cannot be checked is a "
                                  f"claim with no citation"))
        else:
            traced += 1
    rep.check("sheet-index", "HARD" if findings else "ok",
              f"{traced}/{len(live)} table(s) traced to a source")
    for blk, why in findings:
        rep.hard_fail(why, blk["line"] if blk else None)


CHECKS = [
    Check("pipe-table", "B",
          "a table is data, and data lives in the workbook",
          c_pipe_table),
    Check("workbook-single", "B",
          "profiles/default.md table_workbook — one project, one workbook",
          c_workbook_single),
    Check("xlsx-exists", "B",
          "the resource path covers the note, figs/, ../figs",
          c_xlsx_exists),
    Check("sheet-exists", "B",
          "a block names a sheet, and the sheet has to exist",
          c_sheet_exists),
    Check("caption-for-float", "B",
          "caption: is what makes a table a numbered float",
          c_caption_for_float),
    Check("formula-cells", "C",
          "xlsx_table.lua reads cached values — a live formula renders blank",
          c_formula_cells),
    Check("header-row", "C",
          "tables-to-workbook step 2 — row 1 caption, row 2 header, hence skip_n: 1",
          c_header_row),
    Check("sheet-kind", "C",
          "the S in a sheet name says which document it belongs to",
          c_sheet_kind),
    Check("sheet-index", "T",
          "a table whose numbers have no source is a claim with no citation",
          c_sheet_index),
]
