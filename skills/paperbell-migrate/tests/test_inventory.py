"""Tests for scripts/inventory.py (stdlib only; exits non-zero on failure)."""

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parent.parent / "scripts" / "inventory.py"
sys.path.insert(0, str(SCRIPT.parent))

import inventory  # noqa: E402


def write(root, relative, text="x"):
    path = root / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def snapshot(root):
    return {p.relative_to(root).as_posix(): p.read_bytes() for p in sorted(root.rglob("*")) if p.is_file()}


class TargetFor(unittest.TestCase):
    def test_folder_mapping(self):
        cases = {
            "00 - 每日日记/DailyNote/2025-01-01.md": "30 - Metadata/DailyNote/2025-01-01.md",
            "00 - 每日日记/WeeklyNote/2025-W01.md": "30 - Metadata/WeeklyNote/2025-W01.md",
            "Inputs/Zotero/a.md": "20 - Inputs/Zotero/a.md",
            "Persons/Scholars/A.md": "30 - Metadata/Scholars/A.md",
            "Locations/Institutes/B.md": "30 - Metadata/Institutes/B.md",
            "Cards/Concepts/c.md": "10 - Cards/Concepts/c.md",
            "Drafts/d.md": "50 - Outputs/Drafts/d.md",
            "40 - Obsidian/脚本/pandoc/x.lua": "00 - Obsidian/pandoc/x.lua",
            "40 - Obsidian/img/x.png": "00 - Obsidian/img/x.png",
        }
        for old, new in cases.items():
            with self.subTest(old=old):
                self.assertEqual(inventory.target_for(old), new)

    def test_project_page_gets_its_own_folder(self):
        self.assertEqual(inventory.target_for("Projects/ABSESpy.md"), "40 - Projects/ABSESpy/ABSESpy.md")
        self.assertEqual(inventory.target_for("Projects/ABSESpy/cover.png"), "40 - Projects/ABSESpy/cover.png")

    def test_longform_demo_renames(self):
        self.assertEqual(inventory.target_for("Outputs/demo/Index.md"),
                         "50 - Outputs/Longform/demo/Main Manuscript (Index).md")
        self.assertEqual(inventory.target_for("Outputs/demo/source/1.md"),
                         "50 - Outputs/Longform/demo/manuscript/1.md")
        self.assertEqual(inventory.target_for("Outputs/demo/imgs/a.png"),
                         "50 - Outputs/Longform/demo/figs/a.png")

    def test_unknown_folder_has_no_guessed_destination(self):
        self.assertIsNone(inventory.target_for("MyStuff/note.md"))
        self.assertIsNone(inventory.target_for("Outputs/MyPaper/Index.md"))

    def test_root_and_config_files_keep_their_path(self):
        self.assertEqual(inventory.target_for("README.md"), "README.md")
        self.assertEqual(inventory.target_for(".obsidian/app.json"), ".obsidian/app.json")


class VaultPair:
    """Fixture only: an old and a new vault plus a record dir outside both."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        base = Path(self.tmp.name)
        self.old, self.new, self.out = base / "old", base / "new", base / "records"
        write(self.old, "Inputs/Books/same.md", "same")
        write(self.old, "Inputs/Books/changed.md", "old")
        write(self.old, "Inputs/Zotero/only-old.md")
        write(self.old, "Inputs/Links/link.md")
        write(self.old, "Locations/Places/place.md")
        write(self.old, "40 - Obsidian/模板/t.md")
        write(self.old, "Cards/list.base")
        write(self.old, "MyStuff/note.md")
        write(self.new, "20 - Inputs/Books/same.md", "same")
        write(self.new, "20 - Inputs/Books/changed.md", "new")
        write(self.new, "30 - Metadata/Scholars/only-new.md")
        write(self.new, "elsewhere/only-old.md")

    def tearDown(self):
        self.tmp.cleanup()

class Compare(VaultPair, unittest.TestCase):
    def rows(self):
        report = inventory.compare(self.old, self.new)
        return report, {r["source"]: r for r in report["files"]}

    def test_comparison_and_actions(self):
        report, rows = self.rows()
        self.assertEqual(report["source_files"], 8)
        self.assertEqual(rows["Inputs/Books/same.md"]["comparison"], "identical")
        self.assertEqual(rows["Inputs/Books/same.md"]["proposed_action"], "reuse_new_identical_file")
        self.assertEqual(rows["Inputs/Books/changed.md"]["comparison"], "different")
        self.assertEqual(rows["Inputs/Books/changed.md"]["proposed_action"], "review_merge_preserve_new_structure")
        self.assertEqual(rows["Inputs/Zotero/only-old.md"]["comparison"], "missing")
        self.assertEqual(rows["Inputs/Zotero/only-old.md"]["other_same_name_candidates"], ["elsewhere/only-old.md"])
        self.assertEqual(rows["MyStuff/note.md"]["comparison"], "unassigned")
        self.assertIsNone(rows["MyStuff/note.md"]["proposed_target"])
        self.assertIn("30 - Metadata/Scholars/only-new.md", report["new_files_without_mapped_old_file"])

    def test_links_and_places_are_deferred(self):
        _, rows = self.rows()
        for source in ("Inputs/Links/link.md", "Locations/Places/place.md"):
            self.assertEqual(rows[source]["proposed_action"], "defer_for_user_choice")

    def test_old_system_files_are_not_imported(self):
        _, rows = self.rows()
        for source in ("40 - Obsidian/模板/t.md", "Cards/list.base"):
            self.assertEqual(rows[source]["proposed_action"], "keep_new_defaults_retain_old_system_file")

    def test_nothing_is_marked_done(self):
        _, rows = self.rows()
        self.assertEqual({r["migration_status"] for r in rows.values()}, {"planned"})


class Cli(VaultPair, unittest.TestCase):
    def run_cli(self, *args):
        return subprocess.run([sys.executable, "-B", str(SCRIPT), *map(str, args)],
                              capture_output=True, text=True)

    def test_read_only_and_writes_report_outside_vaults(self):
        before = snapshot(self.old), snapshot(self.new)
        output = self.out / "report.json"
        result = self.run_cli(self.old, self.new, "--output", output)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual((snapshot(self.old), snapshot(self.new)), before)
        self.assertEqual(json.loads(output.read_text(encoding="utf-8"))["source_files"], 8)
        self.assertEqual(json.loads(result.stdout)["source_files"], 8)

    def assert_refused(self, result, fragment):
        # argparse's parser.error exits 2; a traceback would exit 1
        self.assertEqual(result.returncode, 2, result.stderr)
        self.assertIn(fragment, result.stderr)

    def test_refuses_report_inside_a_vault(self):
        for vault in (self.old, self.new):
            result = self.run_cli(self.old, self.new, "--output", vault / "report.json")
            self.assert_refused(result, "outside both vaults")
            self.assertFalse((vault / "report.json").exists())

    def test_refuses_to_overwrite_an_existing_report(self):
        output = self.out / "report.json"
        write(self.out, "report.json", "earlier evidence")
        self.assert_refused(self.run_cli(self.old, self.new, "--output", output), "new report path")
        self.assertEqual(output.read_text(encoding="utf-8"), "earlier evidence")

    def test_refuses_same_or_nested_vaults(self):
        self.assert_refused(self.run_cli(self.old, self.old), "separate, non-nested")
        self.assert_refused(self.run_cli(self.old, self.old / "Inputs"), "separate, non-nested")


if __name__ == "__main__":
    unittest.main()
