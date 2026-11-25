# Customer deployment permission safeguards

## Production incident: 2026-11-25

The release-specific activation script used umask 077.
Creating the staged product directory with mkdir(mode=0755)
resulted in actual permissions of 0700.

LiteSpeed served the generic application shell instead of
the prerendered product snapshots.

Changing the public product directory to 0755 resolved
snapshot delivery. All 141 deployed snapshots subsequently
passed exact HTTP response verification.

## Required permissions

| Component | Mode |
|---|---|
| Private release directory | 0700 |
| Private activation directory | 0700 |
| Public product directory | 0755 |
| Public product HTML files | 0644 |

Do not globally relax the private release umask.
Do not recursively chmod the production document root.

## Required future activation integration

Import create_public_product_directory and
verify_public_product_tree from public_permissions.py.

Use create_public_product_directory(staged) instead of
staged.mkdir(mode=0o755).

Copy each reviewed snapshot into the staged directory,
explicitly set mode 0644 and verify its checksum.

Run verify_public_product_tree(staged) before switching
the staged directory into production.

Run verify_public_product_tree(live / "product") immediately
after the directory switch.

Verify public product responses against the expected
snapshot contents after activation.

## Release safety

The activation script used on 2026-11-25 is historical,
release-specific and must not be reused for another release.

The permission helper is not a complete activation tool.
Future activation scripts must integrate and test it before
production use.

Retain independent rollback preparation and verification.

Do not use temporary maintenance rewrite rules without
separate hosting compatibility testing.

The automatic cPanel overlay deployment remains disabled.

No Admin or backend deployment is required for this
permission correction.
