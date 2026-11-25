# South West Phase 1 deployment readiness

25 November 2026 · Reviewed working tree based on `d884353` · **NOT READY**

## 1. Executive summary

Hold production deployment. The clean fixture build serves all 13 sitemap entries with direct 200 responses and matching canonicals. Shopping, variant selection, guest checkout navigation and mocked sign-in worked. However, the candidate can downgrade an HTTPS request to HTTP in a redirect behind TLS offload. The cPanel deployment procedure can overwrite hosting directives and the cron-owned sitemap, copy an unrelated admin release, and leave old product snapshots in service. The operator has not yet demonstrated the candidate rules on the actual LiteSpeed configuration.

Reviewed the three project-root audit/implementation reports, tracked diff, new Phase 1 files, generated fixture documents and customer/backend tests. The earlier 4% historical 5XX attribution remains unresolved; this review found no basis for changing API availability or crawl permissions. All commands in the migration and operator sections below are proposed. Only local fixture commands were executed.

## 2. Phase 1 code review findings

| Priority | Finding and evidence | Required decision |
|---|---|---|
| High | **HTTPS downgrade in filename redirects.** In Apache with the trusted offload marker enabled, GET /shop.html?ref=sample returned 301 with Location **http://southwest.lk/shop?ref=sample**. /index.html likewise redirected to HTTP root. The marker bypasses the scheme-normalization rule, but the path-only external substitutions let the origin server construct the absolute Location using its HTTP connection. HTTP www /shop.html first redirected to HTTPS www-free /shop.html, retaining another filename redirect. `Frontend/Customer/public/.htaccess:12–33`. | Use explicitly HTTPS apex destinations for storefront filename redirects or ensure the edge owns the complete mapping. Verify all Locations across both proxy listeners. Query values must never be forwarded over an HTTP downgrade. Untrusted forwarding headers must not suppress normalization. |
| High | **Deployment ownership and interruption.** `.cpanel.yml:4–12` checks only for existing */index.html, then builds both apps and overlays both dist trees. It neither inventories unrelated contents of product/ nor removes obsolete flat snapshots on later deploys. Copying root .htaccess and sitemap.xml can replace host-managed directives or a newer cron publication. HTML can reference chunks not yet copied. A failed release can expose mixed versions. | Use a scoped release procedure with exclusive deploy ownership, backup, staging rehearsal, asset-first ordering and rollback. Replace or operationally exclude the overlay path for subsequent releases too. |
| Medium | **Direct refresh and Vue do not accept the same path spellings.** Apache returned 404 for /SHOP. Vue Router uses its default insensitive route matching, and the prior catch-all served the app on extensionless deep links. The explicit server allowlist is case-sensitive and duplicates the route inventory. `public/.htaccess:35–48`, `src/router/index.js:37–195,206–209` under Frontend/Customer. | Check existing inbound URL examples and define a policy for mixed-case legacy routes. Keep the server allowlist and Vue route tests in sync, including new account/checkout routes. Canonical lowercase links in the fixture passed. |
| Medium | **Product existence remains ambiguous at document time.** Generated files win before runtime lookup. Unknown well-formed UUIDs get a 200 shell. A retired snapshot can initially advertise an indexable product and an old offer. Browser slug correction is history replacement; it cannot issue an HTTP 301. An empty eligible-catalog response can also follow unreadable images or unavailable prices. `public/.htaccess:38–43`, `src/pages/ProductDetails.vue:1495–1555,1651–1689`, `Backend/src/controllers/storeProductController.js:616–628,680–696`. | Explicitly accept the interim scope or require the resolver in §12 first. Keep the live lookup for newly published inventory. |
| Medium | **Proxy/vhost semantics unproven.** If HTTPS arrives at the origin as HTTP without the expected trusted marker, canonical HTTPS requests can redirect to themselves. The api/uploads/admin path exemption is not a vhost boundary. Internal rewrites and nested application .htaccess inheritance need testing. | Operator must demonstrate the actual public chain including the CDN, if present. Verify independent API/admin host mappings, no double redirects, and a real not-found body/status. |
| Low | **Canonical hygiene depends on templates and catalog data.** Generated fixture pages contained one canonical; the neutral shell has none. Client code updates/removes the first canonical rather than de-duplicating arbitrary injected tags. Invalid slug/UUID pairs fall back to the homepage for cards/search, produce no order-history link or fail to open a cart item. Social preview uses stored fields but does not validate them through the customer helper. `src/utils/productSeo.js:11–17`, `src/composables/usePageMeta.js:15–42`, `Backend/src/controllers/socialPreviewController.js:117–125`. | Validate the staged inventory and inspect live raw/rendered tags. Correct malformed catalog identity at source. Zero stock is independent of identity. |

**Status and security review.** The local server returned genuine 404s for missing JS/images, unknown routes and malformed products. Legitimate deep links and a newly published UUID shape remained reachable. Query strings survived the canonical product redirect including an encoded slash in a query value. The slug helper accepts alphanumeric hyphenated names and UUIDs, and generated output uses validated paths. The main host redirects use a fixed destination. API contracts, authorization and CORS were outside the diff. Keep directory listing disabled, backups outside the document root, and the internal HTTPS marker under trusted server control. Test stale browser-cached 301s in a fresh profile too. A 404 exemption check on a single simulated API path does not prove production host isolation.

## 3. Regression results

Compared candidate source, scripts and serving rules with the isolated Phase 1 fixture build. Re-ran the original suite with headless Chrome, mocked dependencies and two Apache loopback listeners. **27 of 31 passed, 2 failed and 2 timed out.** The previously built clean baseline showed the same four unsuccessful cases. Additional runs below used separate temporary fixtures. Repository tests and assertions were untouched.

| Original unsuccessful check | Diagnosis and independent check |
|---|---|
| Account returns | **Outdated expectation.** The test waits for “Returns & cancellations”; the component renders “Warranty & Order Support” (`tests/account-browser.test.mjs:75–88`, `src/pages/account/ReturnsCancellations.vue:7–10`). An intercepted successful login created the fixture session, then the protected returns page rendered that heading on direct entry and refresh. The original multi-width workflow still stops at its old assertion. |
| Information layout | **Outdated DOM assumption.** The first route, /contact, passed its raw H1 check; snapshot then dereferenced a missing .information-page wrapper. Contact uses main.contact-page. The test also assumes the shared width container for every route (`tests/informationPages.test.mjs:35–38,84–103`, `src/pages/footer/ContactUs.vue:84`). A dedicated browser check passed for contact and refresh. The Apache fixture checked raw canonicals for all seven information URLs. Per-page visual parity remains a separate test obligation. |
| Homepage promotion | **Fixture configuration.** The blanket empty data array for /store/homepage-sections replaces the default active sections, suppressing the banner/benefits the test waits for (`src/pages/Home.vue:149–165,763–769,927,970–980`). Supplying active sections in a temporary fixture made the unchanged layout, keyboard, size and overflow assertions pass at 375, 650, 651 and 1440 px. |
| Responsive product images | **Fixture configuration plus a pre-existing UI defect against the test criterion.** Empty sections remove the just_for_you rail containing #products. With the rail enabled, the mobile primary-image selection check passed and the original ≥24×24 control assertion failed. A separate clean-baseline run with the same fixture measured **12×16 CSS px** at viewport width 390. CSS sets compact gallery indicators (`src/components/products/ProductCard.vue:747–795`). The original test does not reach its second-slide and desktop assertions in that run. Retain the target-size requirement when repairing coverage. |

**Focused fixture checks actually run**

| Flow | Result |
|---|---|
| Home, listing, filters and sort | Configured banner/benefits layout passed. /shop?category=4 displayed a product card; changing sort sent categoryIds=4 and sort=price_desc together. |
| Search, detail, variants and images | Typed search, chose suggestion, landed on the stored slug/UUID, refreshed successfully and selected the second of two purchasable variant fixtures. Its pressed state updated. Responsive primary-image check and gallery limitation are recorded above. |
| Cart, checkout, authentication and account | Populated guest cart navigated via its checkout button to the guest delivery-address page. Anonymous account access reached sign-in. A separate synthetic sign-in/session check passed for protected account refresh. No real checkout, order or customer data used. |
| Sitemap, head and status | Generator tests passed for pagination, unique public URLs, escaped fallback data and retrieval failure. Actual Apache checks passed for all 13 sitemap destinations, direct 200, canonical count, query preservation, missing files and neutral new-product shell. New/old-slug browser tests covered lookup, missing data and temporary 503. |
| Backend social previews | All seven mocked controller tests passed, including stored identity for an old slug, never-stocked eligibility, absence, missing image and DB failure. |

These results do not certify LiteSpeed or a production payment/fulfilment workflow. No browser-engine defect was needed to explain the four failures.

## 4. Production blockers and release gates

1. Close the downgrade finding with an approved change or equivalent verified edge mapping. Test filename aliases, including legacy product index.html, over the real TLS chain.
2. Record the effective hosting configuration and pass the staging matrix below. Demonstrate the fallback route serves the intended document on the installed LiteSpeed edition/version.
3. Approve an owner-scoped migration, prove there are no mixed-ownership entries in product/, verify a private backup by restoring it to scratch, and demonstrate rollback under the same permissions. Arrange a short **storefront-only** maintenance window or a provider-managed atomic switch. The stock cPanel overlay is unsuitable for this migration.
4. Record the release owner's decision on UUID soft 404s, stale snapshot risk and mixed-case legacy traffic. Assign ownership of the four regression gaps, including the mobile gallery target. These known baseline failures should not be counted as new Phase 1 regressions or silently marked as passes.

## 5. Hosting evidence required

| Question | Operator evidence and acceptance |
|---|---|
| Which domains share a root? | cPanel → Domains → Domains/Manage. Record actual roots, aliases, Redirects To and Force HTTPS Redirect for apex/www, API and admin. Also inspect Application Manager or Setup Node.js App for URL mappings without exporting environment values. Confirm /admin child rules and whether API/uploads run outside the storefront. |
| Where does TLS end? | cPanel → SSL/TLS Status for both apex and www. Obtain the network path and trusted-proxy rule from the CDN/provider. Record what HTTPS and SW_FRONTEND_HTTPS equal on HTTP, HTTPS and internal error-document handling. A certificate or Server header alone cannot establish those values. |
| What engine and rewrites run? | Provider/WHM LiteSpeed Web Server plugin → edition/version and active server; where available, read-only `/usr/local/lsws/bin/lshttpd -v`. Obtain effective vhost mappings, override permissions, DirectoryIndex, DirectorySlash, MultiViews, indexing, ErrorDocument, LSCache/CDN status/redirect TTL and provider-level redirects. Ask for redacted excerpts limited to those directives. Apache config syntax output alone is insufficient. |
| Does the same ruleset work? | Exercise a clean equivalent LiteSpeed staging root with the real candidate .htaccess, root and nested assets/admin rules, genuine HTTP and TLS-offloaded HTTPS. Include slashless files, legacy directories in a disposable staging copy, direct .html, 404 page, unknown route, new UUID and stale slug. Inspect raw Location at **each** hop and actual response type/body. The rules match literal production hostnames; a generic staging hostname alone skips their normalization branches. Use operator-controlled staging DNS or curl --resolve with the production hostnames and matching certificates. |

LSWS documents a difference in how it terminates rewrite processing with [L] versus Apache's per-directory rounds. This matters to child apps, filename aliases and internal error documents. Verify [END], [NE], host matching, REQUEST_FILENAME, DOCUMENT_ROOT and the trusted TLS marker on the installed stack. Main-domain document root changes can require provider intervention; the runbook below avoids relying on changing it. [LiteSpeed migration FAQ](https://docs.litespeedtech.com/lsws/cp/cpanel/switch-apache/) · [cPanel domain management](https://docs.cpanel.net/cpanel/domains/domains/manage-the-domain/110/) · [cPanel Git deployment](https://docs.cpanel.net/knowledge-base/web-services/guide-to-git-deployment/)

## 6. Safe migration and read-only inventory

**Operator runbook, after review.** Commands assume Bash and GNU tools on cPanel. Replace release paths with verified local paths. Run blocks in one dedicated shell. First identify the live root and a **clean, approved production build** outside it. Never deploy the test fixture. Inspect local output privately; redact any sensitive host/path details before sharing.

```bash
set -euo pipefail
umask 077
root=/home/southwes/public_html
repo=/home/southwes/southwest-repo
dist=/home/southwes/releases/APPROVED/customer-dist
test -d "$root/product" && test -d "$dist/product"
realpath "$root" "$root/product" "$dist"
df -h "$root" "$dist" /home/southwes
df -i "$root"
find "$root" -maxdepth 1 -printf '%y %f\n' | sort
find "$root/product" -mindepth 1 -printf '%y %P\n' | sort
find "$dist/product" -mindepth 1 -printf '%y %P\n' | sort
find "$root/product" "$dist" -type l -printf '%p -> %l\n'
find "$dist" -mindepth 1 -maxdepth 1 -printf '%y %f\n' | sort
stat "$root/.htaccess" "$root/sitemap.xml" "$root/admin" "$root/assets"
sha256sum "$root/.htaccess" "$root/sitemap.xml"
crontab -l | grep -F '/home/southwes/refresh-sitemap.sh' | grep -c 'refresh-sitemap'
stat /home/southwes/refresh-sitemap.sh /home/southwes/refresh-sitemap-only.mjs
git -C "$repo" rev-parse HEAD
rsync -anic -- "$dist/product/" "$root/product/"
```

The rsync preview above lists prospective additions/updates. Inventory both trees separately to find legacy or stale entries; this preview deliberately has no delete option. Confirm every live product entry belongs to generated catalog HTML, including hidden files, symlinks or extra directories. **Stop on any unclassified file**, incomplete catalog build, unsafe symlink, filesystem boundary, or insufficient space. Check that cron's exact atomic target is the live sitemap and its temporary file is on the same filesystem. Confirm the next scheduled run and completion through cPanel → Cron Jobs and a locally inspected, redacted refresh-log summary.

Scope the rollout to customer HTML and the assets referenced by the approved build. Keep existing hashed assets for open sessions. Preserve hosting-owned files, TLS validation paths, robots, API configuration, uploads, admin and live sitemap. Review root .htaccess *privately* against the live hosting directives and prepare an operator-approved **merged** file. Never copy the dist root wholesale. Coordinate concurrent releases; cron continues at its existing frequency and keeps sole ownership of its output.

## 7. Private backup and staging

Use cPanel Backup/Backup Wizard or the provider's snapshot facility and verify the restore point and ownership/ACL coverage. For the scoped shell procedure also take an account-private working backup. A full document-root archive can contain private files; keep it outside all web roots with restricted access. Include independent backups of any approved hosting configuration change. This procedure does not touch DB or API storage.

```bash
job=$(mktemp -d /home/southwes/phase1-review.XXXXXXXX)
chmod 700 "$job"
test "$(stat -c %d "$job")" = "$(stat -c %d "$root/product")"
tar -cpf "$job/docroot.tar" -C "$root" .
sha256sum "$job/docroot.tar" > "$job/docroot.sha256"
sha256sum -c "$job/docroot.sha256"
mkdir "$job/restore-check"
tar -xpf "$job/docroot.tar" -C "$job/restore-check" ./.htaccess ./product
cmp "$root/.htaccess" "$job/restore-check/.htaccess"
diff -qr "$root/product" "$job/restore-check/product"
cp -a -- "$dist/product" "$job/product.next"
diff -qr "$dist/product" "$job/product.next"
```

If live files change during backup, investigate and repeat using a consistent provider snapshot or maintenance window. An old sitemap in the backup is archival; leave the independently refreshed live copy in place during both rollout and rollback. Confirm the hosting account can read the released files and traverse product/ after its move; do not make the private backup public.

## 8. Exact scoped deployment sequence

**Future approved operator actions only.** Rehearse this sequence on staging, including stopping between moves. Stage an approved merged root config as `$job/root.htaccess.next`. It must preserve hosting-owned directives and include the tested redirect correction. Verify its ownership and final public-file permissions match the live config. Build under the approved revision using the existing release build process outside the live root. Do not press **Deploy HEAD Commit** for this cutover; that runs the overlay and admin tasks. Coordinate a separate approved release of the backend preview-only change through its current process.

Prepare an explicit payload in the private directory. The list below covers the generated HTML and built assets. If the build changed another customer-owned static file, add its exact reviewed relative path. Stop on any collision with an unrelated or hosting-owned path. Exclude internal manifests and unreviewed hidden files. The asset cache .htaccess is a separate reviewed exception if any change is needed.

```bash
(
  cd "$dist"
  for f in index shop categories brands offers about contact faq shipping returns privacy-policy terms app-shell 404; do
    test -f "$f.html"
    printf '%s\n' "$f.html"
  done
  find assets -type f ! -path '*/.*' -print
) | sort -u > "$job/customer.files"
# Review the full proposed write set before continuing.
cat "$job/customer.files"
rsync -anic --files-from="$job/customer.files" "$dist/" "$root/"
rsync -anic "$job/root.htaccess.next" "$root/.htaccess"
# Record exactly which files have pre-release versions.
: > "$job/existed"
: > "$job/added"
while IFS= read -r f; do
  test ! -L "$root/$f"
  if test -e "$root/$f"; then
    test -f "$root/$f"
    printf '%s\n' "$f" >> "$job/existed"
  else
    printf '%s\n' "$f" >> "$job/added"
  fi
done < "$job/customer.files"
mkdir "$job/previous"
rsync -a --files-from="$job/existed" "$root/" "$job/previous/"
cp -p "$root/.htaccess" "$job/previous-root.htaccess"
```

Review newly added paths and dry-run output, verify all destination ancestors (including assets/) are trusted directories without symlink indirection, and validate build references against the inventory. Existing immutable filenames must have identical contents if reused. Do not apply a generated file list to a mixed-ownership assets tree without checking each collision. Preserve old assets, including unchanged public images and theme resources. If permissions, ACLs or security labels depend on the hosting provider, have the provider stage and approve them before switching.

Enable the **provider-tested storefront maintenance mechanism** returning a temporary 503, retaining operator/staging access and leaving API/admin, cron and their roots untouched. Its activation/deactivation commands depend on the verified vhost; obtain both from the hosting operator first. Reserve the release window for this operation alone. If that isolation or an equivalent atomic release switch is unavailable, defer deployment.

```bash
test -f "$job/root.htaccess.next" && test ! -e "$job/product.previous"
test ! -L "$root/product" && test ! -L "$root/assets"
awk '/^assets\//' "$job/customer.files" > "$job/assets.files"
awk '!/^assets\//' "$job/customer.files" > "$job/pages.files"
rsync -a --delay-updates --files-from="$job/assets.files" "$dist/" "$root/"
rsync -a --delay-updates --files-from="$job/pages.files" "$dist/" "$root/"
# Old product tree stays intact in private storage. Both moves must be same-device.
mv -T -- "$root/product" "$job/product.previous"
mv -T -- "$job/product.next" "$root/product"
mv -T -- "$job/root.htaccess.next" "$root/.htaccess"
diff -qr "$dist/product" "$root/product"
rsync -anic --files-from="$job/customer.files" "$dist/" "$root/"
```

The two product moves are individually atomic on one filesystem; there is a gap between them. Keep maintenance active through validation. No command removes the legacy tree. For future releases use a fresh versioned snapshot set or a reviewed per-file manifest reconciliation; repeated cp -a overlays can retain deleted/renamed product HTML indefinitely. Do not retire the private backup or older hashed assets as part of this release.

## 9. Verification before opening traffic and after cutover

Use provider-approved bypass or staging access first, then run the same read-only checks across the public edge. Substitute a real current product, hashed asset, public image, API route and expected admin entry. Pin apex and www to a staging receiver with `curl --resolve host:port:STAGING_IP` for **each applicable host and port**, using valid TLS. Never submit real payment or authentication data to the test vhost.

```bash
p='/product/REPLACE-WITH-VERIFIED-CURRENT-SLUG-AND-UUID'
for u in "http://www.southwest.lk$p/?ref=a%2Fb" "https://southwest.lk$p" \
  'https://southwest.lk/shop.html?ref=sample' 'https://southwest.lk/index.html' \
  'https://southwest.lk/shop' 'https://southwest.lk/account/orders' \
  'https://southwest.lk/assets/phase1-missing.webp' 'https://southwest.lk/not-a-page'; do
  curl -sS --max-time 12 -o /dev/null -w '%{http_code} %{redirect_url} %{content_type}\n' "$u"
done
curl -sS --max-redirs 3 -L -o /dev/null -w '%{num_redirects} %{http_code} %{url_effective}\n' \
  "http://www.southwest.lk$p/?ref=a%2Fb"
curl -fsS https://southwest.lk/shop | grep -E 'rel="canonical"|property="og:url"'
curl -fsS -o /dev/null -w '%{http_code} %{content_type}\n' https://southwest.lk/sitemap.xml
curl -fsS -o /dev/null -w '%{http_code} %{content_type}\n' \
  'https://api.southwest.lk/api/store/products?paginate=1&limit=1'
```

Expected: single HTTPS apex redirect for combined www/HTTP/slash product; slashless current product and shop return direct 200; every filename alias ends at HTTPS without a downgrade; absent assets and unknown routes return 404 and the intended body. Verify a real JS file has JavaScript MIME/cache headers, and a real upload returns its image type. Confirm account refresh, cart, checkout and admin still reach their own applications. Inspect raw **and** rendered canonicals on a generated and newly published product, then use a test alias with a query. Recheck sitemap XML, cron success and fresh catalog inclusion after its next quarter-hour cycle. Monitor per-host 5XX and redirect rates, product/asset 404 examples and checkout failures against baseline. On any loop, downgrade, widespread 404, private app misrouting or missing assets, keep or re-enable maintenance and roll back.

## 10. Rollback

Run under the same exclusive window. Review the following **dry runs first**. Confirm that changed files still belong to this release. If another writer changed an affected file, reconcile it before proceeding.

```bash
rsync -anic --files-from="$job/existed" "$job/previous/" "$root/"
rsync -anic "$job/previous-root.htaccess" "$root/.htaccess"
cat "$job/added"
ls -ld "$root/product" "$job"/product.* 2>/dev/null || true
```

Restore only the scope actually switched. Keep new immutable chunk files available to already-open clients; their removal is a later retention decision. Quarantine newly introduced public HTML so previous broad fallback rules cannot inadvertently serve candidate files.

```bash
if test -d "$job/product.previous"; then
  if test -e "$root/product"; then
    test ! -e "$job/product.withdrawn"
    mv -T -- "$root/product" "$job/product.withdrawn"
  fi
  mv -T -- "$job/product.previous" "$root/product"
fi
rsync -a --delay-updates --files-from="$job/existed" "$job/previous/" "$root/"
mkdir -p "$job/withdrawn"
while IFS= read -r f; do
  case "$f" in
    *.html) if test -f "$root/$f"; then
      mkdir -p "$job/withdrawn/$(dirname "$f")"
      mv -T -- "$root/$f" "$job/withdrawn/$f"
    fi ;;
  esac
done < "$job/added"
cp -p "$job/previous-root.htaccess" "$job/restore.htaccess"
mv -T -- "$job/restore.htaccess" "$root/.htaccess"
```

Restore any separately changed edge redirect config through its provider, and the preview backend revision separately if it was released. Verify prior product layout, assets, shop, account, API and admin, then lift maintenance. Cached browser 301s may outlive the rollback. Preserve the live cron-owned sitemap and its next scheduled run.

## 11–12. Remaining SEO limits and resolver design

The new listing documents have their own heads; catalog body rendering still depends on Vue and the public API. Query-bearing pages can initially inherit an indexable static head before Vue applies the query policy. Indexability, stale snapshots and canonical selection should be sampled after rollout. The API robots 404 and historical 5XX attribution are independent of the proposed product handler.

**Recommended design, future approval only.** Route only storefront product document GET/HEAD requests to a lightweight, trusted resolver **before** selecting static files. Confirm the operator can map just that path to the service; moving the entire domain into a Node app could displace existing static and account routing. Keep API/preview, assets and uploads isolated. If selective routing is unavailable, retain the documented partial behavior and obtain provider support.

| Authoritative outcome | HTTP and rendering decision |
|---|---|
| Active, publicly eligible UUID and current slug | 200. Serve a snapshot matching its identity and content revision. For a newly published item or stale snapshot, return fresh metadata and a renderable public shell/document. Active out-of-stock remains 200 with accurate availability. |
| Same active UUID, outdated slug | One permanent redirect to the absolute HTTPS apex canonical. Preserve legitimate query parameters. Never use a caller-supplied host as the destination. |
| Confirmed missing/deleted or inactive | Genuine 404 with the public not-found experience. Reserve 410 for an explicit durable retirement policy. Ignore any old snapshot on disk. |
| DB timeout, unavailable media, partial catalog response or unknown state | Temporary 503, optionally bounded Retry-After. Do not turn a dependency failure into cached 404, removal or permanent redirect. Avoid emitting stale purchasability/price. |

Use an indexed lookup by public UUID with explicit public lifecycle state. The existing full listing pipeline performs catalog-wide eligibility work and can yield an empty array for several reasons. Do not route every document through that heavy listing fetch plus the same browser fetches. Share public data or revalidate after render where practical. Cache positive identity briefly by UUID and revision, invalidate on create/rename/retire, short-cache only authoritative negatives, and bound stale windows for price and stock. Keep failure responses out of shared success/negative caches. Measure p95/p99 latency, queries per request, hit rate, mismatched snapshots and redirect/404/503 counts. Test update races, origin outages and HEAD/GET parity before enabling traffic.

## 13. Final verdict

**NOT READY for production deployment.** Reassess after correcting the downgrade, obtaining LiteSpeed/proxy evidence, rehearsing the scoped migration and rollback, and recording acceptance or closure of the remaining lifecycle and regression gaps. The review produced this report only; candidate source, production systems and the cron job were untouched.
