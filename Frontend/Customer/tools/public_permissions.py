"""Permission safeguards for public product snapshots."""

import stat
from pathlib import Path


def verify_public_product_tree(directory):
    directory = Path(directory)

    if directory.is_symlink() or not directory.is_dir():
        raise ValueError("Invalid public product directory")

    if stat.S_IMODE(directory.stat().st_mode) != 0o755:
        raise ValueError("Public product directory must have mode 755")

    snapshots = list(directory.iterdir())

    if not snapshots:
        raise ValueError("Product snapshot directory is empty")

    for snapshot in snapshots:
        if (
            snapshot.is_symlink()
            or not snapshot.is_file()
            or snapshot.suffix != ".html"
        ):
            raise ValueError(f"Unexpected snapshot: {snapshot}")

        if stat.S_IMODE(snapshot.stat().st_mode) != 0o644:
            raise ValueError(f"Incorrect snapshot permissions: {snapshot}")


def create_public_product_directory(directory):
    directory = Path(directory)

    directory.mkdir(mode=0o755)
    directory.chmod(0o755)

    if stat.S_IMODE(directory.stat().st_mode) != 0o755:
        raise ValueError("Failed to set public directory permissions")

    return directory
