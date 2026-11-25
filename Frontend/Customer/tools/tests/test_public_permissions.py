"""Regression tests for public product permissions."""

import os
import stat
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from public_permissions import (
    create_public_product_directory,
    verify_public_product_tree,
)


class PublicPermissionsTests(unittest.TestCase):

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)

        self.root = Path(self.temp.name)
        self.private = self.root / "private"
        self.private.mkdir(mode=0o700)
        self.private.chmod(0o700)

        self.product = self.private / "product"

    def mode(self, path):
        return stat.S_IMODE(path.stat().st_mode)

    def create_snapshot(self):
        create_public_product_directory(self.product)

        snapshot = self.product / "example.html"
        snapshot.write_text("<html>Product</html>")
        snapshot.chmod(0o644)

        return snapshot

    def test_original_umask_defect(self):
        previous = os.umask(0o077)

        try:
            self.product.mkdir(mode=0o755)
            self.assertEqual(self.mode(self.product), 0o700)
        finally:
            os.umask(previous)

    def test_corrected_directory_under_restrictive_umask(self):
        previous = os.umask(0o077)

        try:
            self.create_snapshot()
            self.assertEqual(self.mode(self.product), 0o755)
            verify_public_product_tree(self.product)
        finally:
            os.umask(previous)

    def test_private_directory_remains_private(self):
        self.create_snapshot()
        self.assertEqual(self.mode(self.private), 0o700)

    def test_reject_private_product_directory(self):
        self.create_snapshot()
        self.product.chmod(0o700)

        with self.assertRaises(ValueError):
            verify_public_product_tree(self.product)

    def test_reject_incorrect_snapshot_permissions(self):
        snapshot = self.create_snapshot()
        snapshot.chmod(0o600)

        with self.assertRaises(ValueError):
            verify_public_product_tree(self.product)

    def test_reject_empty_directory(self):
        create_public_product_directory(self.product)

        with self.assertRaises(ValueError):
            verify_public_product_tree(self.product)

    def test_reject_unexpected_file(self):
        self.create_snapshot()
        (self.product / "unexpected.txt").write_text("test")

        with self.assertRaises(ValueError):
            verify_public_product_tree(self.product)

    def test_reject_snapshot_symlink(self):
        snapshot = self.create_snapshot()
        (self.product / "alias.html").symlink_to(snapshot)

        with self.assertRaises(ValueError):
            verify_public_product_tree(self.product)

    def test_reject_directory_symlink(self):
        self.create_snapshot()
        alias = self.private / "alias"
        alias.symlink_to(self.product, target_is_directory=True)

        with self.assertRaises(ValueError):
            verify_public_product_tree(alias)

    def test_valid_product_tree(self):
        self.create_snapshot()
        verify_public_product_tree(self.product)


if __name__ == "__main__":
    unittest.main()
