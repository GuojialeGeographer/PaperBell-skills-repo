"""Figures — the asset resolves, and the figure can be referred to.

Both checks read the resource path the way the export does: the note's own
directory, ``figs/``, and ``../figs/``. That last one is why a scene under
``source/`` may write a bare filename.
"""
from __future__ import annotations

from . import Check
from ._doc import IMAGE, REF, line_of, resource_path


def _images(doc) -> list[dict]:
    out = []
    for m in IMAGE.finditer(doc["prose"]):
        attr = m.group("attr") or ""
        label = ""
        for tok in attr.split():
            if tok.startswith("#"):
                label = tok[1:]
                break
        out.append({
            "src": m.group("src"),
            "cap": m.group("cap"),
            "label": label,
            "line": line_of(doc["prose"], m.start()),
        })
    return out


def c_figure_asset(doc, rep, th) -> None:
    imgs = [i for i in _images(doc) if not i["src"].startswith(("http:", "https:", "data:"))]
    if not imgs:
        rep.check("figure-asset", "SKIP", "no images in this document")
        return
    bases = resource_path(doc["path"])
    missing = [i for i in imgs if not any((b / i["src"]).is_file() for b in bases)]
    rep.check("figure-asset", "HARD" if missing else "ok",
              f"{len(imgs) - len(missing)}/{len(imgs)} asset(s) on the resource path")
    for i in missing:
        rep.hard_fail(f"{i['src']} is not on the resource path — put it in figs/ "
                      f"beside the note, or it is 'not found on resource-path' "
                      f"at export", i["line"])


def c_figure_label(doc, rep, th) -> None:
    imgs = _images(doc)
    if not imgs:
        rep.check("figure-label", "SKIP", "no images in this document")
        return
    # Only a figure the prose actually refers to needs a label; a decorative
    # image that nothing points at is not a defect.
    referred = {r for r in REF.findall(doc["prose"]) if r.startswith("fig:")}
    if not referred:
        rep.check("figure-label", "SKIP", "no \\ref{fig:...} in the prose")
        return
    unlabelled = [i for i in imgs if not i["label"] and i["cap"].strip()]
    rep.check("figure-label", "WARN" if unlabelled else "ok",
              f"{len(unlabelled)} captioned figure(s) with no label")
    for i in unlabelled:
        rep.warning(f"{i['src']} has a caption but no {{#fig:...}} — the prose "
                    f"refers to {len(referred)} figure label(s), and an "
                    f"unlabelled float cannot answer any of them", i["line"])


CHECKS = [
    Check("figure-asset", "B",
          "the resource path covers the note, figs/, ../figs",
          c_figure_asset),
    Check("figure-label", "C",
          "a figure the prose refers to needs a label to be referred to",
          c_figure_label),
]
