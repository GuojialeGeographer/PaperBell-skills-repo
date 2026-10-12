"""Read-only PaperBell comparison; optional metadata report outside both vaults."""

import argparse
import hashlib
import json
from collections import Counter
from pathlib import Path


PREFIXES = [
    ("40 - Obsidian/脚本/pandoc/", "00 - Obsidian/pandoc/"),
    ("40 - Obsidian/", "00 - Obsidian/"),
    ("00 - 每日日记/DailyNote/", "30 - Metadata/DailyNote/"),
    ("00 - 每日日记/WeeklyNote/", "30 - Metadata/WeeklyNote/"),
    ("Persons/Scholars/", "30 - Metadata/Scholars/"),
    ("Persons/", "30 - Metadata/"),
    ("Locations/Institutes/", "30 - Metadata/Institutes/"),
    ("Locations/", "30 - Metadata/"),
    ("Cards/", "10 - Cards/"),
    ("Inputs/", "20 - Inputs/"),
    ("Drafts/", "50 - Outputs/Drafts/"),
    ("Projects/", "40 - Projects/"),
    ("Outputs/PaperBell用户文档/", "50 - Outputs/Longform/PaperBell用户文档/"),
]

DEFERRED = ("Inputs/Links/", "Locations/Places/")  # destination is the user's call
TECHNICAL = (".DS_Store", ".Rhistory")
SYSTEM_ACTIONS = ("keep_new_defaults_retain_old_system_file", "retain_source_technical_file")
LONGFORM_RENAMES = [("source/", "manuscript/"), ("imgs/", "figs/")]


def longform_projects(paths):
    """Old writing projects: an Outputs/<name>/ folder with its own Index.md."""
    return {p.split("/")[1] for p in paths
            if p.startswith("Outputs/") and p.count("/") == 2 and p.endswith("/Index.md")}


def inventory(root):
    result = {}
    for path in sorted(root.rglob("*")):
        if path.is_file():
            data = path.read_bytes()
            result[path.relative_to(root).as_posix()] = {
                "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()
            }
    return result


def target_for(relative, projects=()):
    if Path(relative).name in TECHNICAL or relative.startswith(DEFERRED):
        return None  # No destination is proposed for these.
    if relative.startswith("Projects/") and relative.count("/") == 1 and relative.endswith(".md"):
        name = Path(relative).stem
        return f"40 - Projects/{name}/{name}.md"
    parts = relative.split("/", 2)
    if len(parts) == 3 and parts[0] == "Outputs" and parts[1] in projects:
        rest = "Main Manuscript (Index).md" if parts[2] == "Index.md" else parts[2]
        for old, new in LONGFORM_RENAMES:
            if rest.startswith(old):
                rest = new + rest[len(old):]
        return f"50 - Outputs/Longform/{parts[1]}/{rest}"
    for old, new in PREFIXES:
        if relative.startswith(old):
            return new + relative[len(old):]
    if relative.startswith((".obsidian/", ".pandoc/")) or "/" not in relative:
        return relative
    return None  # Unknown folders require a decision; no guessed destination.


def compare(source, target):
    old = inventory(source)
    new = inventory(target)
    projects = longform_projects(old)
    rows = []
    matched = set()
    for relative, before in old.items():
        destination = target_for(relative, projects)
        after = new.get(destination)
        status = "unassigned" if destination is None else "missing"
        if after is not None:
            matched.add(destination)
            status = "identical" if before == after else "different"
        if relative.startswith(DEFERRED):
            action = "defer_for_user_choice"
        elif relative.startswith((".obsidian/", ".pandoc/", "40 - Obsidian/模板/", "40 - Obsidian/脚本/", "Outputs/PaperBell用户文档/")) or relative in ("README.md", "longform-sessions.json") or relative.endswith(".base"):
            action = "keep_new_defaults_retain_old_system_file"
        elif Path(relative).name in TECHNICAL:
            action = "retain_source_technical_file"
        elif status == "identical":
            action = "reuse_new_identical_file"
        elif status == "different":
            action = "review_merge_preserve_new_structure"
        else:
            action = "review_destination_and_dependencies"
        candidates = [p for p in new if Path(p).name == Path(relative).name and p != destination]
        rows.append({"source": relative, "proposed_target": destination,
                     "comparison": status, "proposed_action": action,
                     "migration_status": "planned", "source_metadata": before,
                     "target_metadata": after, "other_same_name_candidates": candidates})
    targets = Counter(r["proposed_target"] for r in rows if r["proposed_target"])
    collisions = sorted(t for t, n in targets.items() if n > 1)  # e.g. imgs/x and figs/x
    return {"source_vault": str(source), "new_base_vault": str(target),
            "source_files": len(old), "new_files": len(new),
            "summary": dict(Counter(r["comparison"] for r in rows)),
            "personal_summary": dict(Counter(r["comparison"] for r in rows
                                             if r["proposed_action"] not in SYSTEM_ACTIONS)),
            "longform_projects": sorted(projects),
            "target_collisions": collisions,
            "mapping_note": "Proposed destinations are comparison hints, not permission to copy or overwrite.",
            "files": rows,
            "new_files_without_mapped_old_file": sorted(set(new) - matched)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("target", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    source, target = args.source.resolve(), args.target.resolve()
    if not source.is_dir() or not target.is_dir():
        parser.error("Both vaults must exist.")
    if source == target or source.is_relative_to(target) or target.is_relative_to(source):
        parser.error("Vaults must be separate, non-nested directories.")
    if args.output:
        output = args.output.resolve()
        if output.is_relative_to(source) or output.is_relative_to(target):
            parser.error("The report must be outside both vaults.")
        if output.exists():
            parser.error("Choose a new report path to preserve previous evidence.")
    report = compare(source, target)
    rendered = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    if args.output:
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(rendered, encoding="utf-8")
        print(json.dumps({k: report[k] for k in ("source_files", "new_files", "summary", "personal_summary")}))
    else:
        print(json.dumps(report, ensure_ascii=True, indent=2))


if __name__ == "__main__":
    main()
