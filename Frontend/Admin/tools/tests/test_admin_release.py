"""Automated safety tests for Admin release preparation."""

import hashlib
import importlib.util
import json
import os
import platform
import shutil
import subprocess
import sys
import tempfile
import unittest

from pathlib import Path


TOOL = Path(__file__).resolve().parents[1] / "admin_release.py"

SPEC = importlib.util.spec_from_file_location(
    "admin_release", TOOL
)

release = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(release)

ENTRY = "assets/index-AbCd1234.js"
STYLE = "assets/index-EfGh5678.css"
NEW_ENTRY = "assets/index-IjKl9012.js"


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def snapshot(root):
    return {
        path.relative_to(root).as_posix(): digest(path)
        for path in root.rglob("*")
        if path.is_file() and not path.is_symlink()
    }


@unittest.skipUnless(
    platform.system() == "Darwin",
    "Local macOS release rehearsal tests",
)
class AdminReleaseTests(unittest.TestCase):

    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(
            prefix="sw-admin-unit-"
        )
        self.addCleanup(self.temporary.cleanup)

        self.root = Path(self.temporary.name).resolve()
        self.root.chmod(0o700)

        self.dist = self.root / "Admin/dist"
        self.live = self.root / "admin"

        self.dist.mkdir(parents=True)

        for name in release.BRANDING:
            (self.dist / name).write_text(
                f"Branding fixture: {name}"
            )

        shutil.copy2(
            release.ADMIN / "public/.htaccess",
            self.dist / ".htaccess",
        )

        (self.dist / "assets").mkdir()
        (self.dist / ".vite").mkdir()

        (self.dist / ENTRY).write_text(
            "console.log('original');"
        )

        (self.dist / STYLE).write_text(
            "body { color: black; }"
        )

        self.write_index(ENTRY)
        self.write_manifest(ENTRY)

        shutil.copytree(
            self.dist,
            self.live,
            ignore=shutil.ignore_patterns(".vite"),
        )

        self.protected = {
            ".user.ini": "Hosting configuration",
            "php.ini": "PHP configuration",
            ".well-known/protected.txt": "Protected",
            "assets.pre-old/protected.js": "Old bundle",
        }

        for name, content in self.protected.items():
            path = self.live / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content)

    def write_index(self, entry):
        (self.dist / "index.html").write_text(
            '<!DOCTYPE html><html><head>'
            '<link rel="icon" href="/Favicon.webp">'
            f'<script type="module" src="/{entry}"></script>'
            f'<link rel="stylesheet" href="/{STYLE}">'
            '</head><body><div id="app"></div></body></html>'
        )

    def write_manifest(self, entry):
        release.write_json(
            self.dist / ".vite/manifest.json",
            {
                "index.html": {
                    "file": entry,
                    "isEntry": True,
                    "css": [STYLE],
                }
            },
        )

    def changed_candidate(self):
        (self.dist / ENTRY).unlink()

        (self.dist / NEW_ENTRY).write_text(
            "console.log('updated');"
        )

        self.write_index(NEW_ENTRY)
        self.write_manifest(NEW_ENTRY)

    def prepared_job(self):
        self.changed_candidate()

        job = self.root / "release-job"

        result = release.prepare(
            self.dist,
            self.live,
            job,
        )

        self.assertEqual(result["status"], "PREPARED")
        return job

    def test_no_changes(self):
        result = release.inspect(self.dist, self.live)

        self.assertEqual(result["status"], "NO_CHANGES")
        self.assertEqual(result["payload"], [])

    def test_no_change_creates_no_package(self):
        output = self.root / "release-job"

        result = release.prepare(
            self.dist,
            self.live,
            output,
        )

        self.assertEqual(result["status"], "NO_CHANGES")
        self.assertFalse(output.exists())

    def test_protected_entries_preserved(self):
        result = release.inspect(self.dist, self.live)

        self.assertEqual(
            set(result["untouched_live_entries"]),
            {
                ".user.ini",
                "php.ini",
                ".well-known",
                "assets.pre-old",
            },
        )

    def test_old_bundles_retained(self):
        old = "assets/legacy-AbCd1234.js"

        (self.live / old).write_text("Historical bundle")

        result = release.inspect(self.dist, self.live)

        self.assertIn(
            old,
            result["retain_existing_bundles"],
        )

        self.assertIn(
            old,
            result["additional_live_bundles"],
        )

    def test_immutable_bundle_conflict(self):
        (self.live / ENTRY).write_text("Conflicting bundle")

        with self.assertRaisesRegex(
            ValueError, "Immutable bundle conflict"
        ):
            release.inspect(self.dist, self.live)

    def test_branding_change_blocked(self):
        (self.dist / "Favicon.webp").write_text("Changed")

        with self.assertRaisesRegex(
            ValueError, "Branding resource needs separate review"
        ):
            release.inspect(self.dist, self.live)

    def test_routing_change_blocked(self):
        (self.dist / ".htaccess").write_text("Changed routing")

        with self.assertRaisesRegex(
            ValueError, "routing configuration differs"
        ):
            release.inspect(self.dist, self.live)

    def test_missing_manifest_blocked(self):
        (self.dist / ".vite/manifest.json").unlink()

        with self.assertRaisesRegex(
            ValueError, "manifest is missing"
        ):
            release.inspect(self.dist, self.live)

    def test_missing_manifest_dependency_blocked(self):
        path = self.dist / ".vite/manifest.json"

        manifest = json.loads(path.read_text())

        manifest["index.html"]["dynamicImports"] = [
            "missing-chunk"
        ]

        release.write_json(path, manifest)

        with self.assertRaisesRegex(
            ValueError, "Missing manifest dependency"
        ):
            release.inspect(self.dist, self.live)

    def test_duplicate_manifest_keys_blocked(self):
        path = self.dist / ".vite/manifest.json"

        path.write_text(
            '{"index.html": {}, "index.html": {}}'
        )

        with self.assertRaisesRegex(
            ValueError, "Duplicate manifest key"
        ):
            release.inspect(self.dist, self.live)

    def test_unlisted_bundle_blocked(self):
        (self.dist / NEW_ENTRY).write_text("Unlisted")

        with self.assertRaisesRegex(
            ValueError, "Bundles absent from manifest"
        ):
            release.inspect(self.dist, self.live)

    def test_missing_manifest_resource_blocked(self):
        path = self.dist / ".vite/manifest.json"
        manifest = json.loads(path.read_text())

        manifest["missing.js"] = {
            "file": NEW_ENTRY,
        }

        release.write_json(path, manifest)

        with self.assertRaisesRegex(
            ValueError, "Missing manifest resource"
        ):
            release.inspect(self.dist, self.live)

    def test_missing_html_resource_blocked(self):
        self.write_index(NEW_ENTRY)

        with self.assertRaisesRegex(
            ValueError, "Missing HTML reference"
        ):
            release.inspect(self.dist, self.live)

    def test_candidate_symlink_blocked(self):
        path = self.dist / ENTRY
        path.unlink()
        path.symlink_to(self.live / ENTRY)

        with self.assertRaisesRegex(
            ValueError, "Candidate symlink rejected"
        ):
            release.inspect(self.dist, self.live)

    def test_unexpected_candidate_file_blocked(self):
        (self.dist / "unexpected.php").write_text("Unexpected")

        with self.assertRaisesRegex(
            ValueError, "Unexpected candidate resource"
        ):
            release.inspect(self.dist, self.live)

    def test_unexpected_live_asset_blocked(self):
        (self.live / "assets/unexpected.php").write_text(
            "Unexpected"
        )

        with self.assertRaisesRegex(
            ValueError, "Unexpected live asset"
        ):
            release.inspect(self.dist, self.live)

    def test_changed_release_preparation(self):
        self.changed_candidate()

        before_dist = snapshot(self.dist)
        before_live = snapshot(self.live)

        output = self.root / "release-job"

        result = release.prepare(
            self.dist,
            self.live,
            output,
        )

        self.assertEqual(result["status"], "PREPARED")

        self.assertEqual(
            result["assets_first"],
            [NEW_ENTRY],
        )

        self.assertEqual(
            result["pages_last"],
            ["index.html"],
        )

        self.assertEqual(
            set(snapshot(output / "payload")),
            {NEW_ENTRY, "index.html"},
        )

        self.assertEqual(
            set(snapshot(output / "backup")),
            {"index.html"},
        )

        self.assertTrue((output / "READY").is_file())

        self.assertEqual(
            snapshot(self.dist), before_dist
        )

        self.assertEqual(
            snapshot(self.live), before_live
        )

    def test_private_package_permissions(self):
        job = self.prepared_job()

        self.assertEqual(
            job.stat().st_mode & 0o777,
            0o700,
        )

    def test_existing_output_blocked(self):
        self.changed_candidate()

        output = self.root / "existing"
        output.mkdir(mode=0o700)

        marker = output / "protected.txt"
        marker.write_text("Protected")

        before = snapshot(output)

        with self.assertRaisesRegex(
            ValueError, "Output already exists"
        ):
            release.prepare(
                self.dist, self.live, output
            )

        self.assertEqual(snapshot(output), before)

    def test_public_output_blocked(self):
        self.changed_candidate()

        public = self.root / "public_html"
        public.mkdir(mode=0o700)

        with self.assertRaisesRegex(
            ValueError, "Output cannot be inside a web root"
        ):
            release.prepare(
                self.dist,
                self.live,
                public / "release",
            )

    def test_recovery_from_actual_package(self):
        previous = digest(self.live / "index.html")
        job = self.prepared_job()

        job_before = snapshot(job)
        live_before = snapshot(self.live)

        output = self.root / "recovery"

        result = release.restore_preview(job, output)

        self.assertEqual(
            result["status"],
            "RECOVERY_PREVIEW_COMPLETE",
        )

        self.assertEqual(
            digest(output / "index.html"),
            previous,
        )

        self.assertEqual(snapshot(job), job_before)
        self.assertEqual(snapshot(self.live), live_before)

    def test_corrupted_backup_blocked(self):
        job = self.prepared_job()

        (job / "backup/index.html").write_text("Corrupted")

        output = self.root / "recovery"

        with self.assertRaisesRegex(
            ValueError, "Backup checksum mismatch"
        ):
            release.restore_preview(job, output)

        self.assertFalse(output.exists())

    def test_missing_backup_blocked(self):
        job = self.prepared_job()
        (job / "backup/index.html").unlink()

        with self.assertRaisesRegex(
            ValueError, "Missing or unexpected backup files"
        ):
            release.restore_preview(
                job, self.root / "recovery"
            )

    def test_unsafe_backup_filename_blocked(self):
        job = self.prepared_job()

        release.write_json(
            job / "backup-sha256.json",
            {"../index.html": "0" * 64},
        )

        with self.assertRaisesRegex(
            ValueError, "Unexpected backup file inventory"
        ):
            release.restore_preview(
                job, self.root / "recovery"
            )

    def test_incomplete_release_blocked(self):
        job = self.prepared_job()
        (job / "READY").unlink()

        with self.assertRaisesRegex(
            ValueError, "Release preparation is incomplete"
        ):
            release.restore_preview(
                job, self.root / "recovery"
            )

    def test_concurrent_preparation_blocked(self):
        with release.preparation_lock(self.live):
            result = subprocess.run(
                [
                    sys.executable,
                    str(TOOL),
                    "prepare",
                    str(self.dist),
                    str(self.live),
                    str(self.root / "release-job"),
                ],
                capture_output=True,
                text=True,
                timeout=10,
                env={
                    **os.environ,
                    "PYTHONDONTWRITEBYTECODE": "1",
                },
            )

        self.assertEqual(result.returncode, 1)

        self.assertIn(
            "Another Admin release preparation is running",
            result.stdout,
        )

        self.assertFalse(
            (self.root / "release-job").exists()
        )

    def test_lock_released_after_exception(self):
        with self.assertRaises(RuntimeError):
            with release.preparation_lock(self.live):
                raise RuntimeError("Simulated failure")

        with release.preparation_lock(self.live):
            pass


if __name__ == "__main__":
    unittest.main()
