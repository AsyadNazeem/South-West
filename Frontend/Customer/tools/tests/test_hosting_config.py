"""Automated tests for strict hosting configuration merging."""

import sys
import unittest
from pathlib import Path

TOOLS = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(TOOLS))

from hosting_config import (
    merge_hosting_config,
    REVIEWED_LEGACY,
    PHP_BEGIN,
    PHP_END,
)

CANDIDATE = (
    TOOLS.parent / "public/.htaccess"
).read_bytes()

HANDLER = b"\n".join([
    PHP_BEGIN,
    b'# Set the "ea-php84" package as the default PHP language.',
    b"<IfModule mime_module>",
    b"  AddHandler application/x-httpd-ea-php84___lsphp .php .php8 .phtml",
    b"</IfModule>",
    PHP_END,
    b"",
])

LIVE = REVIEWED_LEGACY.rstrip() + b"\n\n" + HANDLER


class HostingConfigTests(unittest.TestCase):

    def test_valid_merge(self):
        self.assertEqual(
            merge_hosting_config(LIVE, CANDIDATE),
            CANDIDATE + b"\n" + HANDLER,
        )

    def test_current_deployed_configuration(self):
        live = CANDIDATE + b"\n" + HANDLER

        self.assertEqual(
            merge_hosting_config(live, CANDIDATE),
            live,
        )

    def test_modified_deployed_configuration_rejected(self):
        live = CANDIDATE + b"\n" + HANDLER

        modified = live.replace(
            b"RewriteEngine On",
            b"RewriteEngine Off",
        )

        with self.assertRaises(ValueError):
            merge_hosting_config(modified, CANDIDATE)

    def test_production_product_rewrite_condition(self):
        self.assertIn(
            b"RewriteCond %{REQUEST_FILENAME}.html -f",
            CANDIDATE,
        )

        self.assertNotIn(
            b"RewriteCond %{DOCUMENT_ROOT}/product/$1.html -f",
            CANDIDATE,
        )

    def test_handler_preserved_exactly(self):
        merged = merge_hosting_config(LIVE, CANDIDATE)
        self.assertEqual(
            merged[merged.index(PHP_BEGIN):],
            HANDLER,
        )

    def test_single_handler_block(self):
        merged = merge_hosting_config(LIVE, CANDIDATE)
        self.assertEqual(merged.count(PHP_BEGIN), 1)
        self.assertEqual(merged.count(PHP_END), 1)

    def test_test_application_protected(self):
        merged = merge_hosting_config(LIVE, CANDIDATE)
        self.assertIn(
            rb"node26-test\.southwest\.lk",
            merged,
        )

    def test_production_style_comment(self):
        live = LIVE.replace(
            b'# Set the "ea-php84" package as the default PHP language.',
            '# Set the “ea-php84” package as the default “PHP” programming language.'.encode(),
        )
        merged = merge_hosting_config(live, CANDIDATE)
        self.assertEqual(
            merged[merged.index(PHP_BEGIN):],
            live[live.index(PHP_BEGIN):],
        )

    def test_unsafe_live_configurations(self):
        cases = {
            "missing handler": REVIEWED_LEGACY,
            "duplicate handler": LIVE + HANDLER,
            "missing end marker": LIVE.replace(PHP_END, b""),
            "missing begin marker": LIVE.replace(PHP_BEGIN, b""),
            "unknown prefix directive": b"Options +Indexes\n" + LIVE,
            "unknown suffix directive": LIVE + b"Options +Indexes\n",
            "changed legacy rules": LIVE.replace(
                b"RewriteEngine On", b"RewriteEngine Off"
            ),
            "unexpected PHP version": LIVE.replace(
                b"ea-php84", b"ea-php85"
            ),
            "malformed module": LIVE.replace(
                b"<IfModule mime_module>", b"<IfModule unknown_module>"
            ),
            "extra handler directive": LIVE.replace(
                PHP_END, b"Options +Indexes\n" + PHP_END
            ),
            "null byte": LIVE + b"\x00",
            "empty live configuration": b"",
            "incorrect marker order": (
                REVIEWED_LEGACY + PHP_END + b"\n" + PHP_BEGIN
            ),
        }

        for name, live in cases.items():
            with self.subTest(name=name):
                with self.assertRaises(ValueError):
                    merge_hosting_config(live, CANDIDATE)

    def test_unsafe_candidate_configurations(self):
        cases = {
            "duplicate PHP handler": CANDIDATE + HANDLER,
            "unexpected handler": (
                CANDIDATE + b"AddHandler unexpected .html\n"
            ),
            "missing 404 configuration": CANDIDATE.replace(
                b"ErrorDocument 404 /404.html", b""
            ),
            "missing final newline": CANDIDATE.rstrip(),
            "unexpected directive": CANDIDATE + b"Options +Indexes\n",
            "modified redirect": CANDIDATE.replace(
                b"https://southwest.lk/shop",
                b"https://example.com/shop",
            ),
            "removed application protection": CANDIDATE.replace(
                rb"node26-test\.southwest\.lk|", b""
            ),
            "null byte": CANDIDATE + b"\x00",
            "empty candidate": b"",
        }

        for name, candidate in cases.items():
            with self.subTest(name=name):
                with self.assertRaises(ValueError):
                    merge_hosting_config(LIVE, candidate)

    def test_invalid_input_types(self):
        for live, candidate in [
            (None, CANDIDATE),
            (LIVE, None),
            (LIVE.decode(), CANDIDATE),
            (LIVE, CANDIDATE.decode()),
        ]:
            with self.subTest(live_type=type(live), candidate_type=type(candidate)):
                with self.assertRaises(ValueError):
                    merge_hosting_config(live, candidate)


if __name__ == "__main__":
    unittest.main()
