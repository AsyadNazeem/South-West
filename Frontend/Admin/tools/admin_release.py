#!/usr/bin/env python3

"""Prepare independent Admin releases without publishing files."""

import argparse
import fcntl
from contextlib import contextmanager
import hashlib
import json
import os
import platform
import re
import shutil
import tempfile

from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit


ADMIN = Path(__file__).resolve().parents[1]

BUNDLE = re.compile(
    r"assets/[\w.-]+-[\w-]{8}\.(?:js|css)",
    re.ASCII,
)

BRANDING = {
    "Favicon.webp",
    "SWLogo.png",
    "SWLogoBlack.webp",
    "SWfavicon.png",
    "SWfavicon1.png",
    "favicon.svg",
    "icons.svg",
}

PROTECTED = BRANDING | {".htaccess"}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def directory(path):
    path = Path(path).absolute()

    require(
        ".." not in path.parts,
        f"Path traversal rejected: {path}",
    )

    resolved = path.resolve(strict=True)

    require(
        path == resolved
        or (
            platform.system() == "Darwin"
            and str(resolved) == "/private" + str(path)
            and str(path).startswith("/var/")
        ),
        f"Aliased directory rejected: {path}",
    )

    require(
        resolved.is_dir() and not path.is_symlink(),
        f"Invalid directory: {path}",
    )

    return resolved


def scan_candidate(root):
    result = {}

    for path in sorted(root.rglob("*")):
        relative = path.relative_to(root).as_posix()

        require(
            not path.is_symlink(),
            f"Candidate symlink rejected: {relative}",
        )

        if path.is_dir():
            require(
                relative in {"assets", ".vite"},
                f"Unexpected candidate directory: {relative}",
            )
            continue

        require(
            path.is_file(),
            f"Special candidate file rejected: {relative}",
        )

        if relative == ".DS_Store":
            continue

        require(
            relative in {"index.html", ".vite/manifest.json"}
            or relative in PROTECTED
            or BUNDLE.fullmatch(relative),
            f"Unexpected candidate resource: {relative}",
        )

        require(
            path.stat().st_size > 0,
            f"Empty candidate resource: {relative}",
        )

        result[relative] = digest(path)

    require(
        ".vite/manifest.json" in result,
        "Candidate manifest is missing",
    )

    return result


def scan_live(root):
    result = {}

    required = PROTECTED | {"index.html"}

    for name in sorted(required):
        path = root / name

        require(
            path.is_file() and not path.is_symlink(),
            f"Invalid required live resource: {name}",
        )

        require(
            path.stat().st_size > 0,
            f"Empty live resource: {name}",
        )

        result[name] = digest(path)

    assets = root / "assets"

    require(
        assets.is_dir() and not assets.is_symlink(),
        "Invalid live assets directory",
    )

    for path in sorted(assets.iterdir()):
        relative = f"assets/{path.name}"

        require(
            path.is_file() and not path.is_symlink(),
            f"Unsafe live asset: {relative}",
        )

        require(
            BUNDLE.fullmatch(relative),
            f"Unexpected live asset: {relative}",
        )

        require(
            path.stat().st_size > 0,
            f"Empty live asset: {relative}",
        )

        result[relative] = digest(path)

    return result


def preserved_live_entries(root):
    managed = PROTECTED | {"index.html", "assets"}

    return sorted(
        path.name
        for path in root.iterdir()
        if path.name not in managed
    )


class IndexReferences(HTMLParser):

    def __init__(self):
        super().__init__()
        self.references = set()
        self.modules = set()

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)

        if tag == "script":
            value = attrs.get("src")

        elif tag == "link":
            value = attrs.get("href")

        else:
            return

        if not value:
            return

        parsed = urlsplit(value)

        if parsed.scheme or parsed.netloc:
            return

        relative = parsed.path.lstrip("/")

        if not relative:
            return

        require(
            ".." not in Path(relative).parts,
            f"Unsafe HTML reference: {value}",
        )

        self.references.add(relative)

        if tag == "script" and attrs.get("type") == "module":
            self.modules.add(relative)


def validate_index(root, files):
    require(
        "index.html" in files,
        "Missing index.html",
    )

    parser = IndexReferences()
    parser.feed(
        (root / "index.html").read_text(encoding="utf-8")
    )

    require(
        bool(parser.modules),
        "No module entry found in index.html",
    )

    for reference in parser.references:
        require(
            reference in files,
            f"Missing HTML reference: {reference}",
        )

    for module in parser.modules:
        require(
            BUNDLE.fullmatch(module)
            and module.endswith(".js"),
            f"Invalid module entry: {module}",
        )


def reject_duplicate_keys(pairs):
    result = {}

    for key, value in pairs:
        require(
            key not in result,
            f"Duplicate manifest key: {key}",
        )
        result[key] = value

    return result


def validate_manifest(root, files):
    manifest_path = root / ".vite/manifest.json"

    require(
        ".vite/manifest.json" in files,
        "Candidate manifest is missing",
    )

    manifest = json.loads(
        manifest_path.read_text(encoding="utf-8"),
        object_pairs_hook=reject_duplicate_keys,
    )

    require(
        isinstance(manifest, dict) and bool(manifest),
        "Invalid or empty Vite manifest",
    )

    resources = set()
    entries = set()

    def validate_resource(name):
        require(
            isinstance(name, str)
            and BUNDLE.fullmatch(name),
            f"Invalid manifest resource: {name}",
        )

        require(
            name in files,
            f"Missing manifest resource: {name}",
        )

        resources.add(name)

    for key, entry in manifest.items():
        require(
            isinstance(key, str) and bool(key),
            "Invalid manifest entry key",
        )

        require(
            isinstance(entry, dict),
            f"Invalid manifest entry: {key}",
        )

        require(
            "file" in entry,
            f"Missing output file: {key}",
        )

        validate_resource(entry["file"])

        for field in ("css", "assets"):
            values = entry.get(field, [])

            require(
                isinstance(values, list),
                f"Invalid manifest field: {key}.{field}",
            )

            for value in values:
                validate_resource(value)

                if field == "css":
                    require(
                        value.endswith(".css"),
                        f"Invalid CSS resource: {value}",
                    )

        for field in ("imports", "dynamicImports"):
            dependencies = entry.get(field, [])

            require(
                isinstance(dependencies, list),
                f"Invalid dependency list: {key}.{field}",
            )

            for dependency in dependencies:
                require(
                    isinstance(dependency, str)
                    and dependency in manifest,
                    f"Missing manifest dependency: {dependency}",
                )

        for field in ("isEntry", "isDynamicEntry"):
            if field in entry:
                require(
                    isinstance(entry[field], bool),
                    f"Invalid entry flag: {key}.{field}",
                )

        if entry.get("isEntry") is True:
            entries.add(entry["file"])

    require(
        bool(entries),
        "Manifest contains no application entry",
    )

    candidate_bundles = {
        name for name in files
        if BUNDLE.fullmatch(name)
    }

    missing = candidate_bundles - resources

    require(
        not missing,
        f"Bundles absent from manifest: {sorted(missing)}",
    )

    require(
        resources == candidate_bundles,
        "Manifest resource coverage mismatch",
    )

    parser = IndexReferences()

    parser.feed(
        (root / "index.html").read_text(encoding="utf-8")
    )

    require(
        bool(parser.modules),
        "No HTML module entry found",
    )

    require(
        parser.modules <= entries,
        "HTML module entry missing from Vite manifest",
    )

    require(
        {
            name for name in parser.references
            if BUNDLE.fullmatch(name)
        } <= resources,
        "HTML references an unlisted bundle",
    )

    return {
        "entries": len(manifest),
        "resources": len(resources),
        "application_entries": sorted(entries),
        "coverage_complete": True,
    }


def inspect(dist, live):
    dist = directory(dist)
    live = directory(live)

    require(
        dist != live
        and dist not in live.parents
        and live not in dist.parents,
        "Candidate and live roots overlap",
    )

    require(
        dist.name == "dist" and dist.parent.name == "Admin",
        "Expected an Admin/dist candidate",
    )

    require(
        live.name == "admin",
        "Expected an admin document root",
    )

    if platform.system() == "Linux":
        require(
            live == Path("/home/southwes/public_html/admin"),
            "Unexpected production Admin root",
        )

    candidate = scan_candidate(dist)
    current = scan_live(live)

    validate_index(dist, candidate)
    manifest_summary = validate_manifest(dist, candidate)
    validate_index(live, current)

    require(
        PROTECTED <= candidate.keys(),
        "Missing protected candidate resources",
    )

    require(
        PROTECTED <= current.keys(),
        "Missing protected live resources",
    )

    require(
        candidate[".htaccess"]
        == digest(ADMIN / "public/.htaccess"),
        "Candidate routing configuration differs from source",
    )

    for name in BRANDING:
        require(
            candidate[name] == current[name],
            f"Branding resource needs separate review: {name}",
        )

    candidate_bundles = {
        name for name in candidate
        if BUNDLE.fullmatch(name)
    }

    live_bundles = {
        name for name in current
        if BUNDLE.fullmatch(name)
    }

    require(
        bool(candidate_bundles),
        "No candidate bundles found",
    )

    for name in candidate_bundles & live_bundles:
        require(
            candidate[name] == current[name],
            f"Immutable bundle conflict: {name}",
        )

    new_bundles = sorted(candidate_bundles - live_bundles)
    index_changed = (
        candidate["index.html"] != current["index.html"]
    )

    payload = new_bundles + (
        ["index.html"] if index_changed else []
    )

    return {
        "status": "PREPARED" if payload else "NO_CHANGES",
        "candidate": candidate,
        "manifest": manifest_summary,
        "live": current,
        "assets_first": new_bundles,
        "pages_last": ["index.html"] if index_changed else [],
        "payload": payload,
        "retain_existing_bundles": sorted(live_bundles),
        "additional_live_bundles": sorted(
            live_bundles - candidate_bundles
        ),
        "preserve": sorted(PROTECTED),
        "untouched_live_entries": preserved_live_entries(live),
        "index_changed": index_changed,
    }


def private_output(path, dist, live):
    path = Path(path).absolute()
    parent = directory(path.parent)
    out = parent / path.name

    require(
        not out.exists() and not out.is_symlink(),
        "Output already exists",
    )

    require(
        not any(
            part in {"public_html", "public_www", "www", "htdocs"}
            for part in out.parts
        ),
        "Output cannot be inside a web root",
    )

    require(
        parent.stat().st_uid == os.getuid(),
        "Output parent has unexpected owner",
    )

    require(
        parent.stat().st_mode & 0o777 == 0o700,
        "Output parent must have mode 0700",
    )

    for root in (dist, live):
        require(
            out != root
            and root not in out.parents
            and out not in root.parents,
            "Output overlaps an input root",
        )

    system = platform.system()

    if system == "Darwin":
        approved = Path(tempfile.gettempdir()).resolve()

    elif system == "Linux":
        approved = directory(
            Path("/home/southwes/southwest-releases")
        )

        require(
            Path.home().resolve() == Path("/home/southwes"),
            "Unexpected hosting account",
        )

        require(
            approved.stat().st_uid == os.getuid()
            and approved.stat().st_mode & 0o777 == 0o700,
            "Unsafe private release directory",
        )

    else:
        raise ValueError("Unsupported operating system")

    require(
        approved in out.parents,
        "Output outside approved private directory",
    )

    out.mkdir(mode=0o700, exist_ok=False)
    return out


def write_json(path, data):
    path.write_text(
        json.dumps(data, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def verified_copy(source, destination, expected):
    require(
        source.is_file() and not source.is_symlink(),
        f"Invalid copy source: {source}",
    )

    require(
        digest(source) == expected,
        f"Source changed: {source}",
    )

    destination.parent.mkdir(
        parents=True,
        exist_ok=True,
        mode=0o700,
    )

    require(
        not destination.exists(),
        f"Destination already exists: {destination}",
    )

    shutil.copy2(source, destination)

    require(
        digest(destination) == expected,
        f"Copied file checksum mismatch: {destination}",
    )


@contextmanager
def preparation_lock(live):
    live = directory(live)

    flags = (
        os.O_RDONLY
        | os.O_DIRECTORY
        | os.O_NOFOLLOW
    )

    descriptor = os.open(live, flags)

    try:
        try:
            fcntl.flock(
                descriptor,
                fcntl.LOCK_EX | fcntl.LOCK_NB,
            )

        except BlockingIOError as exc:
            raise ValueError(
                "Another Admin release preparation is running"
            ) from exc

        opened = os.fstat(descriptor)
        current = live.stat()

        require(
            (opened.st_dev, opened.st_ino)
            == (current.st_dev, current.st_ino),
            "Live Admin directory changed during locking",
        )

        yield

    finally:
        os.close(descriptor)


def prepare(dist, live, output):
    live = directory(live)

    with preparation_lock(live):
        return prepare_locked(dist, live, output)


def prepare_locked(dist, live, output):
    dist = directory(dist)
    live = directory(live)

    inventory = inspect(dist, live)

    if inventory["status"] == "NO_CHANGES":
        return inventory

    out = private_output(output, dist, live)

    payload_hashes = {}
    backup_hashes = {}

    for name in inventory["payload"]:
        expected = inventory["candidate"][name]

        verified_copy(
            dist / name,
            out / "payload" / name,
            expected,
        )

        payload_hashes[name] = expected

    if inventory["index_changed"]:
        name = "index.html"
        expected = inventory["live"][name]

        verified_copy(
            live / name,
            out / "backup" / name,
            expected,
        )

        backup_hashes[name] = expected

    require(
        scan_candidate(dist) == inventory["candidate"],
        "Candidate changed during preparation",
    )

    require(
        scan_live(live) == inventory["live"],
        "Live Admin changed during preparation",
    )

    write_json(out / "inventory.json", inventory)
    write_json(out / "payload-sha256.json", payload_hashes)
    write_json(out / "backup-sha256.json", backup_hashes)

    (out / "READY").write_text(
        "Admin preparation complete. Activation not performed.\n",
        encoding="utf-8",
    )

    return {
        **inventory,
        "private_release": str(out),
    }


def read_release_json(job, name):
    path = job / name

    require(
        path.is_file() and not path.is_symlink(),
        f"Invalid release metadata: {name}",
    )

    return json.loads(
        path.read_text(encoding="utf-8"),
        object_pairs_hook=reject_duplicate_keys,
    )


def restore_preview(job, output):
    job = directory(job)

    require(
        job.stat().st_uid == os.getuid()
        and job.stat().st_mode & 0o777 == 0o700,
        "Release job must be private and owned by current user",
    )

    system = platform.system()

    if system == "Darwin":
        approved = Path(tempfile.gettempdir()).resolve()

    elif system == "Linux":
        approved = directory(
            Path("/home/southwes/southwest-releases")
        )

        require(
            Path.home().resolve() == Path("/home/southwes"),
            "Unexpected hosting account",
        )

        require(
            approved.stat().st_uid == os.getuid()
            and approved.stat().st_mode & 0o777 == 0o700,
            "Unsafe private release directory",
        )

    else:
        raise ValueError("Unsupported operating system")

    require(
        approved in job.parents,
        "Release job outside approved private directory",
    )

    require(
        not any(
            part in {"public_html", "public_www", "www", "htdocs"}
            for part in job.parts
        ),
        "Release job cannot be inside a web root",
    )

    ready = job / "READY"

    require(
        ready.is_file() and not ready.is_symlink(),
        "Release preparation is incomplete",
    )

    require(
        ready.read_text(encoding="utf-8").strip()
        == "Admin preparation complete. Activation not performed.",
        "Invalid release readiness marker",
    )

    inventory = read_release_json(job, "inventory.json")
    hashes = read_release_json(job, "backup-sha256.json")

    require(
        isinstance(inventory, dict)
        and inventory.get("status") == "PREPARED",
        "Invalid release inventory",
    )

    require(
        isinstance(hashes, dict),
        "Invalid backup checksum metadata",
    )

    require(
        isinstance(inventory.get("index_changed"), bool),
        "Invalid index change flag",
    )

    expected_names = (
        {"index.html"} if inventory["index_changed"] else set()
    )

    require(
        set(hashes) == expected_names,
        "Unexpected backup file inventory",
    )

    for name, checksum in hashes.items():
        require(
            isinstance(checksum, str)
            and re.fullmatch(r"[a-f0-9]{64}", checksum),
            f"Invalid backup checksum: {name}",
        )

    backup = job / "backup"

    require(
        not backup.is_symlink(),
        "Backup directory cannot be a symlink",
    )

    if not expected_names:
        require(
            not backup.exists()
            or (
                backup.is_dir()
                and not list(backup.iterdir())
            ),
            "Unexpected files in empty backup",
        )

        return {
            "status": "NO_BACKUP_REQUIRED",
            "recovered_files": [],
        }

    require(
        backup.is_dir(),
        "Backup directory is missing",
    )

    require(
        {path.name for path in backup.iterdir()} == expected_names,
        "Missing or unexpected backup files",
    )

    previous = inventory.get("live")

    require(
        isinstance(previous, dict),
        "Invalid previous live inventory",
    )

    for name, checksum in hashes.items():
        require(
            previous.get(name) == checksum,
            f"Backup differs from recorded live inventory: {name}",
        )

        path = backup / name

        require(
            path.is_file() and not path.is_symlink(),
            f"Unsafe backup resource: {name}",
        )

        require(
            digest(path) == checksum,
            f"Backup checksum mismatch: {name}",
        )

    metadata_before = {
        name: digest(job / name)
        for name in (
            "READY",
            "inventory.json",
            "backup-sha256.json",
        )
    }

    out = private_output(output, job, backup)

    for name, checksum in hashes.items():
        verified_copy(
            backup / name,
            out / name,
            checksum,
        )

    for name, checksum in hashes.items():
        require(
            digest(backup / name) == checksum,
            f"Backup changed during recovery: {name}",
        )

        require(
            digest(out / name) == checksum,
            f"Recovered checksum mismatch: {name}",
        )

    require(
        {
            name: digest(job / name)
            for name in metadata_before
        } == metadata_before,
        "Release metadata changed during recovery",
    )

    return {
        "status": "RECOVERY_PREVIEW_COMPLETE",
        "recovered_files": sorted(hashes),
        "private_recovery": str(out),
        "checksums": hashes,
        "production_modified": False,
    }


def main():
    parser = argparse.ArgumentParser(
        description="Non-publishing Admin release preparation"
    )

    commands = parser.add_subparsers(
        dest="command",
        required=True,
    )

    for command in ("inventory", "prepare"):
        sub = commands.add_parser(command)
        sub.add_argument("dist", type=Path)
        sub.add_argument("live", type=Path)

        if command == "prepare":
            sub.add_argument("output", type=Path)

    restore = commands.add_parser("restore-preview")
    restore.add_argument("job", type=Path)
    restore.add_argument("output", type=Path)

    args = parser.parse_args()

    try:
        if args.command == "inventory":
            result = inspect(args.dist, args.live)
        elif args.command == "prepare":
            result = prepare(
                args.dist,
                args.live,
                args.output,
            )

        else:
            result = restore_preview(
                args.job,
                args.output,
            )

        print(json.dumps(result, indent=2, sort_keys=True))

    except (ValueError, OSError) as exc:
        print(json.dumps({
            "status": "BLOCKED",
            "reason": str(exc),
        }, indent=2))

        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
