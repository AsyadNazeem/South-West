"""Validate a customer build and prepare private release/recovery trees. No live writes."""
import argparse
import fcntl
import hashlib
from html.parser import HTMLParser
import json
import os
import platform
import tempfile
from pathlib import Path
import re
import shutil
import stat
import subprocess
import sys
import xml.etree.ElementTree as ET

from hosting_config import merge_hosting_config

CUSTOMER = Path(__file__).resolve().parents[1]
ORIGIN = "https://southwest.lk"
LANDINGS = "shop offers categories brands contact faq shipping returns about privacy-policy terms".split()
PAGES = {"index.html", "404.html", "app-shell.html", *(name + ".html" for name in LANDINGS)}
IDENTITY = r"[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*-[\da-fA-F]{8}(?:-[\da-fA-F]{4}){3}-[\da-fA-F]{12}"
BUNDLE = re.compile(r"assets/[\w.-]+-[\w-]{8}\.(?:js|css|woff2?|svg|png|webp|jpg)")


def require(condition, message):
    if not condition:
        raise ValueError(message)


def digest(path):
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def scan(root):
    """Never follow a symlink or accept a special file in a managed tree."""
    require(root.is_dir() and not root.is_symlink(), f"Expected directory: {root}")
    files = set()
    for entry in root.rglob("*"):
        mode = entry.lstat().st_mode
        require(stat.S_ISREG(mode) or stat.S_ISDIR(mode), f"Unexpected file type: {entry}")
        if stat.S_ISREG(mode):
            files.add(entry.relative_to(root).as_posix())
    return files


class Head(HTMLParser):
    def __init__(self):
        super().__init__()
        self.canonicals = []
        self.resources = set()
        self.entries = set()
        self.og_urls = []
        self.snapshot = None
        self.in_snapshot = False

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "meta" and a.get("property") == "og:url":
            self.og_urls.append(a.get("content"))
        if tag == "script":
            self.in_snapshot = a.get("id") == "southwest-product-data"
        if tag == "link" and "canonical" in a.get("rel", "").lower().split():
            self.canonicals.append(a.get("href"))
        if tag in {"link", "script", "img"}:
            value = a.get("href") or a.get("src") or ""
            if value.startswith("/") and not value.startswith("//"):
                self.resources.add(value[1:].split("?")[0])
        if tag == "script" and a.get("type") == "module":
            self.entries.add(a.get("src"))


    def handle_endtag(self, tag):
        if tag == "script":
            self.in_snapshot = False

    def handle_data(self, data):
        if self.in_snapshot:
            self.snapshot = json.loads(data)["product"]


def build_inventory(dist):
    files = scan(dist)
    tracked = subprocess.check_output(
        ["git", "ls-files", "-z", "--", "public"], cwd=CUSTOMER
    ).decode().split("\0")
    public = {name[len("public/"):] for name in tracked if name}
    # 404.html belongs to the generated page payload even before its first commit.
    public -= PAGES
    manifest = json.loads((dist / ".vite/manifest.json").read_text())
    bundles = set()
    for row in manifest.values():
        require(all(key in manifest for key in row.get("imports", []) + row.get("dynamicImports", [])),
                "Unresolved Vite import")
        bundles.update([row["file"], *row.get("css", []), *row.get("assets", [])])
    require(all(BUNDLE.fullmatch(path) for path in bundles), "Unexpected Vite output path")
    entry = manifest["index.html"]["file"]

    xml = ET.parse(dist / "sitemap.xml")
    locations = [node.text for node in xml.findall("{*}url/{*}loc")]
    require(len(set(locations)) == len(locations), "Duplicate sitemap location")
    static = {ORIGIN + "/", *(ORIGIN + "/" + name for name in LANDINGS)}
    require(static <= set(locations), "Missing static sitemap location")
    products = set()
    for url in set(locations) - static:
        require(re.fullmatch(re.escape(ORIGIN) + "/product/" + IDENTITY, url), "Invalid product location")
        products.add(url[len(ORIGIN) + 1:] + ".html")
    expected = PAGES | products | public | bundles | {".vite/manifest.json", ".vite/ssr-manifest.json"}
    require(files == expected, f"Unexpected or missing build files: {sorted(files ^ expected)}")
    require(all((dist / f).stat().st_size for f in expected), "Empty build file")
    require((dist / ".htaccess").read_bytes() == (CUSTOMER / "public/.htaccess").read_bytes(),
            "Stale candidate rewrite configuration")
    for name in PAGES | products:
        head = Head()
        head.feed((dist / name).read_text())
        url = ORIGIN + "/" + ("" if name == "index.html" else name[:-5])
        canonical = [] if name in {"app-shell.html", "404.html"} else [url]
        require(head.og_urls == canonical, f"Incorrect OG URL: {name}")
        if name in products:
            item = head.snapshot or {}
            require(name == f"product/{item.get('slug', '').strip()}-{item.get('public_id', '').strip()}.html",
                    f"Product snapshot identity mismatch: {name}")
        require(head.canonicals == canonical, f"Incorrect canonical: {name}")
        require(head.resources <= files, f"Missing HTML resource: {name}")
        if name != "404.html":
            require(head.entries == {"/" + entry}, f"Wrong module entry: {name}")
    return bundles, products, public


def live_products(root):
    tree = root / "product"
    if not tree.exists() and not tree.is_symlink():
        return set(), set()
    files = scan(tree)
    legacy = set()
    for path in tree.iterdir():
        if path.is_dir():
            require(re.fullmatch(IDENTITY, path.name) and
                    (path / "index.html").is_file() and {f.name for f in path.iterdir()} == {"index.html"}, f"Unknown product directory: {path}")
            legacy.add(path.name)
    for name in files:
        require(re.fullmatch(IDENTITY + r"(?:\.html|/index\.html)", name), f"Unknown product file: {name}")
    return {"product/" + f for f in files}, legacy


def copy_files(source, target, names):
    for name in sorted(names):
        output = target / name
        output.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source / name, output)
        require(digest(output) == digest(source / name), f"Copy verification failed: {name}")


def inspect(dist, root):
    bundles, products, public = build_inventory(dist)
    previous, legacy = live_products(root)
    # Shared static resources are prerequisites. Their ownership is outside this
    # release; refuse to silently replace an old or missing version.
    require((root / "assets").is_dir() and not (root / "assets").is_symlink(), "Invalid assets directory")
    old_assets = {"assets/" + name for name in scan(root / "assets")}
    unknown_assets = {name for name in old_assets - public if not BUNDLE.fullmatch(name)}
    require(not unknown_assets, f"Unclassified live assets need ownership review: {sorted(unknown_assets)}")
    require(products or not previous, "Empty product build would replace existing catalog")
    for name in public | bundles | PAGES:
        target = root / name
        for part in [target, *target.parents]:
            if part == root:
                break
            require(not part.is_symlink(), f"Symlink in managed path: {part}")
        require(not target.exists() or target.is_file(), f"Unexpected destination: {target}")
    for name in public - {".htaccess", "robots.txt", "sitemap.xml"}:
        require((root / name).is_file() and digest(root / name) == digest(dist / name),
                f"Shared static resource needs separate review: {name}")
    for name in bundles:
        if (root / name).exists():
            require(digest(root / name) == digest(dist / name), f"Immutable asset collision: {name}")
    require((root / ".htaccess").is_file(), "Live rewrite configuration missing")
    inventory = {
        "legacy_directories": sorted(legacy),
        "previous_snapshots": sorted(previous),
        "new_snapshots": sorted(products),
        "retire_with_previous_tree": sorted(previous - products),
        "retain_existing_assets": sorted(old_assets - bundles),
        "root_symlinks_outside_payload": sorted(p.name for p in root.iterdir() if p.is_symlink()),
        "assets_first": sorted(bundles),
        "pages_last": sorted(PAGES),
        "preserve": sorted(public - {".htaccess"}),
        "untouched_root_entries": sorted(p.name for p in root.iterdir()
            if p.name not in PAGES | {"product", ".htaccess", "assets"}),
        "live_config_sha256": digest(root / ".htaccess"),
        "candidate_config_sha256": digest(dist / ".htaccess"),
    }
    return inventory, bundles | products | PAGES, previous | PAGES | {".htaccess"}


def validate_private_location(out, system, home, temp_root):
    """Restrict release output to approved private locations."""

    require(out.is_absolute(), "Output path must be absolute")

    forbidden = {"public_html", "public_www", "www", "htdocs"}

    require(
        not any(part.lower() in forbidden for part in out.parts),
        "Release output cannot be inside a public web directory",
    )

    if system == "Linux":
        require(
            home == Path("/home/southwes"),
            "Unexpected production account home",
        )

        approved = home / "southwest-releases"

        require(
            approved in out.parents,
            "Production output must be inside southwest-releases",
        )

        require(
            approved.is_dir() and not approved.is_symlink(),
            "Approved release directory is missing or unsafe",
        )

        require(
            approved.stat().st_uid == os.getuid()
            and stat.S_IMODE(approved.stat().st_mode) == 0o700,
            "Approved release directory must be account-owned and 0700",
        )

    elif system == "Darwin":
        require(
            temp_root in out.parents,
            "Local rehearsal output must be inside the system temporary directory",
        )

    else:
        raise ValueError("Unsupported release preparation environment")


def private_output(path, excluded):
    require(
        path.name not in {"", ".", ".."},
        "Invalid output directory name",
    )

    raw_parent = path.parent.absolute()

    require(
        ".." not in raw_parent.parts,
        "Parent traversal is not permitted",
    )

    parent = raw_parent.resolve(strict=True)

    # macOS may expose /var through its system-managed /private alias.
    # Other unexpected parent aliases require review.
    require(
        raw_parent == parent
        or (
            platform.system() == "Darwin"
            and str(raw_parent).startswith("/var/")
            and parent == Path("/private") / raw_parent.relative_to("/")
        ),
        "Unexpected symlink or alias in output parent",
    )

    require(
        parent.is_dir()
        and parent.stat().st_uid == os.getuid()
        and stat.S_IMODE(parent.stat().st_mode) == 0o700,
        "Output parent must be account-owned and 0700",
    )

    out = parent / path.name

    validate_private_location(
        out,
        platform.system(),
        Path.home().resolve(),
        Path(tempfile.gettempdir()).resolve(),
    )

    for tree in excluded:
        tree = tree.resolve()

        require(
            out != tree
            and tree not in out.parents
            and out not in tree.parents,
            "Output must be separate from the inputs",
        )

    out.mkdir(mode=0o700)

    require(
        stat.S_IMODE(out.stat().st_mode) == 0o700,
        "Created output directory has unexpected permissions",
    )

    return out


def restore(job, destination):
    expected = json.loads((job / "backup-sha256.json").read_text())
    backup = job / "backup"
    require((job / "READY").is_file() and scan(backup) == set(expected), "Incomplete backup")
    for name, checksum in expected.items():
        require(digest(backup / name) == checksum, f"Backup mismatch: {name}")
    live = Path((job / "live-root").read_text())
    out = private_output(destination, [job, live])
    copy_files(backup, out, expected)
    print("Verified previous managed files restored to private recovery directory:", out)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    for action in ("inventory", "prepare"):
        cmd = sub.add_parser(action)
        cmd.add_argument("dist", type=Path)
        cmd.add_argument("live", type=Path)
        if action == "prepare":
            cmd.add_argument("private_job", type=Path)
    cmd = sub.add_parser("restore-preview")
    cmd.add_argument("private_job", type=Path)
    cmd.add_argument("private_destination", type=Path)
    args = parser.parse_args()
    if args.command == "restore-preview":
        return restore(args.private_job.resolve(strict=True), args.private_destination)
    require(not args.live.is_symlink() and not args.dist.is_symlink(), "Resolve root symlinks with hosting operator")
    dist, live = args.dist.resolve(strict=True), args.live.resolve(strict=True)
    require(dist != live and dist not in live.parents and live not in dist.parents, "Overlapping roots")
    with_dir = os.open(live, os.O_RDONLY | os.O_DIRECTORY)
    try:
        fcntl.flock(with_dir, fcntl.LOCK_EX | fcntl.LOCK_NB)
        inventory, payload, backup = inspect(dist, live)

        live_config = (live / ".htaccess").read_bytes()
        candidate_config = (dist / ".htaccess").read_bytes()

        merged_config = merge_hosting_config(
            live_config,
            candidate_config,
        )

        config_checksums = {
            "live": hashlib.sha256(live_config).hexdigest(),
            "candidate": hashlib.sha256(candidate_config).hexdigest(),
            "merged": hashlib.sha256(merged_config).hexdigest(),
        }

        require(
            config_checksums["live"] == inventory["live_config_sha256"],
            "Live configuration changed during inspection",
        )

        require(
            config_checksums["candidate"] == inventory["candidate_config_sha256"],
            "Candidate configuration changed during inspection",
        )

        inventory["merged_config_sha256"] = config_checksums["merged"]

        if args.command == "inventory":
            print(json.dumps(inventory, indent=2))
            return
        out = private_output(args.private_job, [dist, live])
        backup = {name for name in backup if (live / name).exists()}
        copy_files(dist, out / "payload", payload)
        copy_files(live, out / "backup", backup)
        for file, value in [
            ("inventory.json", inventory),
            ("backup-sha256.json", {f: digest(out / "backup" / f) for f in sorted(backup)}),
            ("payload-sha256.json", {f: digest(out / "payload" / f) for f in sorted(payload)}),
        ]:
            (out / file).write_text(json.dumps(value, indent=2))
        (out / "live-root").write_text(str(live))
        require(
            digest(out / "backup/.htaccess") == config_checksums["live"],
            "Backed-up hosting configuration mismatch",
        )

        (out / "candidate.htaccess").write_bytes(candidate_config)
        (out / "merged.htaccess").write_bytes(merged_config)

        require(
            digest(out / "candidate.htaccess") == config_checksums["candidate"],
            "Candidate configuration copy mismatch",
        )

        require(
            digest(out / "merged.htaccess") == config_checksums["merged"],
            "Merged configuration copy mismatch",
        )

        (out / "hosting-config-sha256.json").write_text(
            json.dumps(config_checksums, indent=2)
        )

        require(
            digest(live / ".htaccess") == config_checksums["live"],
            "Live configuration changed during preparation",
        )

        require(
            digest(dist / ".htaccess") == config_checksums["candidate"],
            "Candidate configuration changed during preparation",
        )
        (out / "READY").write_text("Prepared for operator review only. No production activation.\n")
        print("Prepared private package:", out)
    finally:
        os.close(with_dir)


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, KeyError, ET.ParseError, subprocess.CalledProcessError) as error:
        sys.exit(f"Release stopped: {error}")
