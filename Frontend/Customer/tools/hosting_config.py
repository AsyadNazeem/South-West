"""Strict customer hosting configuration merge.

This module performs no filesystem writes or activation.
Unknown hosting configurations require operator review.
"""

import re
import hashlib


PHP_BEGIN = b"# php -- BEGIN cPanel-generated handler, do not edit"
PHP_END = b"# php -- END cPanel-generated handler, do not edit"

REVIEWED_LEGACY = b'<IfModule mod_rewrite.c>\n    RewriteEngine On\n    RewriteBase /\n\n    RewriteRule ^index\\.html$ - [L]\n\n    # Serve prerendered information pages at their original extensionless URLs.\n    RewriteRule ^(contact|faq|shipping|returns|about|privacy-policy|terms)$ $1.html [END]\n\n    RewriteCond %{REQUEST_FILENAME} !-f\n    RewriteCond %{REQUEST_FILENAME} !-d\n    RewriteRule . /index.html [L]\n</IfModule>\n\nOptions -MultiViews\n\n<IfModule mod_headers.c>\n    <FilesMatch "[.]html$">\n        Header set Cache-Control "no-cache"\n    </FilesMatch>\n</IfModule>\n'


REVIEWED_CANDIDATE_SHA256 = "51c16bf7099c0f540c927a0c5f5f66d6f83f8506df3cd80a6313a5287f1a2a35"


def require(condition, message):
    if not condition:
        raise ValueError(message)


def merge_hosting_config(live, candidate):
    """Return reviewed customer rules plus preserved PHP handler."""

    require(
        isinstance(live, bytes)
        and isinstance(candidate, bytes),
        "Configurations must be supplied as bytes",
    )

    require(
        b"\x00" not in live and b"\x00" not in candidate,
        "Invalid configuration content",
    )

    require(
        live.count(PHP_BEGIN) == 1
        and live.count(PHP_END) == 1,
        "Expected exactly one cPanel PHP handler block",
    )

    require(
        PHP_BEGIN not in candidate
        and PHP_END not in candidate,
        "Candidate already contains cPanel handler markers",
    )

    require(
        b"addhandler" not in candidate.lower()
        and b"mime_module" not in candidate.lower(),
        "Candidate contains unexpected handler directives",
    )

    start = live.index(PHP_BEGIN)
    end = live.index(PHP_END) + len(PHP_END)

    require(start < end, "Invalid PHP handler ordering")

    prefix = live[:start]
    suffix = live[end:]

    reviewed_prefix = prefix.rstrip(b" \t\r\n")

    require(
        reviewed_prefix == REVIEWED_LEGACY.rstrip(b" \t\r\n")
        or hashlib.sha256(
            reviewed_prefix + b"\n"
        ).hexdigest() == REVIEWED_CANDIDATE_SHA256,
        "Unexpected hosting directives; operator review required",
    )

    require(
        not suffix.strip(),
        "Unexpected directives after PHP handler",
    )

    handler = live[start:]

    lines = live[start:end].splitlines()

    require(
        len(lines) == 6,
        "Unexpected PHP handler structure",
    )

    require(
        lines[0] == PHP_BEGIN
        and lines[-1] == PHP_END,
        "Invalid PHP handler markers",
    )

    require(
        lines[1].startswith(b"# Set the "),
        "Unexpected PHP handler comment",
    )

    require(
        lines[2].strip() == b"<IfModule mime_module>"
        and lines[4].strip() == b"</IfModule>",
        "Invalid PHP handler module",
    )

    require(
        re.fullmatch(
            rb"AddHandler application/x-httpd-ea-php84___lsphp "
            rb"\.php \.php8 \.phtml",
            lines[3].strip(),
        ) is not None,
        "Unexpected PHP handler directive",
    )

    require(
        candidate.startswith(b"Options -MultiViews"),
        "Unexpected candidate configuration",
    )

    require(
        b"ErrorDocument 404 /404.html" in candidate,
        "Candidate missing reviewed 404 configuration",
    )

    require(
        candidate.endswith(b"\n"),
        "Candidate must end with a newline",
    )

    require(
        hashlib.sha256(candidate).hexdigest()
        == REVIEWED_CANDIDATE_SHA256,
        "Candidate differs from reviewed SEO configuration",
    )

    return candidate + b"\n" + handler
