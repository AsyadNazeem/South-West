# South West Phase 1 implementation report

25 November 2026 · Local working tree based on `d884353` · Review before deployment

## 1. Executive summary

The storefront now builds slashless product destinations and route-specific listing documents. Local Apache tests served every fixture sitemap URL directly with HTTP 200, exactly one matching canonical and a matching Open Graph URL. Missing assets, unknown paths and malformed product paths returned HTTP 404. Chrome resolved an outdated slug to the catalog slug, preserved campaign parameters and a fragment, and refreshed the new URL successfully.

**Two product lifecycle decisions remain server-side gaps.** The storefront currently serves static files. A well-formed UUID absent from the build could be newly published, renamed or deleted. It receives a neutral application shell so new inventory stays reachable. Distinguishing those states on the initial HTTP request requires a request-time catalog lookup. A similar limitation applies to stale snapshots that still exist on disk. No production change has been made.

## 2. Original issues and status

| Audit issue | Status | Result |
|---|---|---|
| C1 · Product redirect/canonical mismatch | Implemented | Flat product HTML replaces public slug directories. A clean document root is a deployment prerequisite. |
| C2 · HTTP and www duplicates | Implemented | Production-host rules normalize scheme, host and application trailing slash. A trusted TLS signal is required behind a terminating proxy. Actual LiteSpeed behavior awaits staging verification. |
| C3 · Successful responses for missing content | Partially implemented | Missing static files, unknown paths and malformed product URLs return actual 404s. An unrecognized well-formed UUID still requires runtime resolution. |
| C5 · Incorrect product slug canonical | Partially implemented | Product links, metadata, schema, preview HTML and browser replacement use the catalog identity. Returning a permanent HTTP redirect for any arbitrary outdated slug is blocked on the same request-time resolver. |
| Sitemap URL consistency | Implemented | Repository generation uses the storefront product-path helper. The external cron convention supplied by the operator is compatible. |
| Initial homepage canonical on other pages | Implemented | The four public listing pages receive their own initial heads. Information and generated product documents retain their own canonicals. The unresolved/private shell omits its canonical. |

## 3. Implementation decisions and rationale

Use one public form: HTTPS, apex, slashless except at root. A real directory invites a web-server slash redirect before per-directory rules can deliver its index. Writing `product/<slug>-<uuid>.html` avoids dependence on disabling DirectorySlash. Public paths internally select the file. Asset directory behavior stays intact. [Apache mod_rewrite documentation](https://httpd.apache.org/docs/2.4/mod/mod_rewrite.html#rewriteoptions)

Keep status handling in the layer that can substantiate it. File existence is enough to serve a snapshot. File absence cannot establish deletion. A new Vue route or a build-time table alone cannot set the HTTP status for a live inventory change.

## 4–5. Files and code changes

Paths below are relative to the project root; grouped paths under `Frontend/Customer/` refer to the customer project.

| File or group | Change |
|---|---|
| `.cpanel.yml` | Preflight stops the existing copy-based deploy when legacy product index directories remain. It does not delete them. |
| `Frontend/Customer/public/.htaccess`, new `public/404.html` | Host normalization, explicit route-to-file mappings, neutral-shell fallback for UUID-shaped product URLs, real 404 body, and scoped cart/checkout/account/auth deep links. |
| `Frontend/Customer/scripts/generate-sitemap.mjs` | Shares validated product identity with the client, emits flat files, and gives product and breadcrumb JSON-LD the IDs used by runtime updates. |
| `Frontend/Customer/scripts/render-information.mjs`, new `src/router/listingMeta.js` | Uses shared listing metadata to produce shop, categories, offers and brands documents. Builds a separate shell with no homepage canonical or Open Graph URL. Retains the existing seven prerendered information pages. |
| `Frontend/Customer/src/utils/productSeo.js`, `src/router/index.js`, `src/composables/usePageMeta.js`, `src/pages/NotFound.vue` | Central product-path validation and UUID suffix extraction, slash normalization on client navigation, route-specific canonical ownership and catch-all navigation experience. |
| `Frontend/Customer/src/pages/ProductDetails.vue` | Looks up the UUID, consults returned slug/public ID, replaces an alias while retaining query and fragment, and uses the resolved path for canonical, Open Graph, offer and breadcrumb. Clears product metadata on definitive absence and retains the snapshot fallback on transient error. |
| `Frontend/Customer/src/components/products/ProductCard.vue`, `src/layouts/AppHeader.vue`, `src/pages/Cart.vue`, `src/pages/account/MyOrders.vue`, `src/pages/account/Wishlist.vue`, `src/pages/footer/StoreListing.vue` | Product cards, search suggestions, cart, order history, wishlist and listing structured data use the same product-path function. |
| `Backend/src/controllers/socialPreviewController.js`, `Backend/src/tests/socialPreviewController.test.js` | The existing HTML preview nominates the stored slug and UUID even when requested under an alias. Its JSON-independent interface, eligibility checks and response status behavior remain compatible. |
| `Frontend/Customer/tests/productSeo.test.mjs`, `tests/sitemapGeneration.test.mjs`, new `tests/servingSeo.test.mjs`, new `tests/productNavigation-browser.test.mjs` | Cover current slug and ID, absence versus transient errors, flat build output, real HTTP mapping, canonical counts, preserved queries, deep links, new inventory and browser refresh. |

## 6. Before and after URL behavior

| Request | Previously observed or implemented | Local Phase 1 behavior |
|---|---|---|
| HTTP www /shop/?ref=a | Alternate origins served /shop directly | One permanent redirect to https://southwest.lk/shop?ref=a under the storefront rules. Combined slash/host behavior exercised with a product fixture. |
| HTTPS apex /shop | 200 with homepage canonical | 200 with /shop canonical in raw HTML. Same pattern for categories, brands and offers. |
| Generated /product/current-UUID | Redirect to physical directory ending in /, which named slashless URL as canonical | Direct 200. The trailing-slash variant redirects to the slashless URL. |
| /product/old-UUID?ref=a | Could render and canonicalize the requested alias | Shell or historical snapshot, then browser replacement to /product/current-UUID?ref=a after successful lookup. Initial response may still be 200. |
| Newly published /product/new-UUID | Generic homepage shell until a build | Neutral 200 shell, then live identity/metadata. Independent of snapshot presence. |
| /product/missing without UUID; /missing-route; /assets/missing.js | Catch-all 200 HTML | HTTP 404 with a static, noindex page and link to the shop. |
| Inactive/deleted product with UUID | Initial 200, API lookup subsequently reports absence | Initial HTTP limitation persists. Definitive absence clears the product graph/canonical and displays unavailable/noindex. |
| Existing, eligible, out-of-stock product | Product may have zero available quantity | Stock does not participate in path construction or redirect decisions. Existing pricing, variant selection and availability policies continue. |
| /account/orders or /checkout/address/{token} refreshed | Vue app shell | Supported deep links reach Vue through the neutral shell. |
| Temporary lookup failure | Existing API returns its error, browser may have embedded fallback | API status passes through its existing endpoint. Browser can use matching snapshot or show a retryable failure without marking a valid UUID absent. Storefront HTML cannot reflect that subsequent API status. |

## 7–8. Canonical and status ownership

The twelve public static paths are home, four catalog landing pages and seven information pages. All twelve and generated products have one canonical in initial production-build HTML. The existing query indexing policy remains in place. Query parameters survive redirects and are omitted from canonical URLs. On client product navigation, unresolved routes defer identity to the catalog. A successful lookup updates the head. The static not-found page requires no JavaScript.

Public API/authentication/upload handling was not rerouted into Vue. The API host needs its own existing vhost/document root. The customer rules exempt the API, uploads and admin namespaces. No CORS, robots, price, stock, cart, order or database logic was changed. Browser refresh and status semantics on the deployed server depend on loading these rules.

## 9. Sitemap and external cron compatibility

The repository generator still pages at up to 100 products, checks pagination and emits the same slashless catalog format. Existing inactive/invalid-record filtering remains. The external production script is a separate publisher. Based on the supplied description, **no external script patch is required**. Its twelve static paths, slug/UUID validation and absolute HTTPS apex URL shape match. The external script's atomic publication and quarter-hour schedule are independent of the repository's page generation. It can advertise a newly published product before a snapshot exists.

The external wrapper, Node script, schedule and hosting files were not inspected or changed. After rollout, compare a sitemap generated by the external job with the deployed convention and validate a newly listed product after at least one cron cycle.

## 10–11. Automated verification, build and lint

Built a temporary copy of the customer and shared source using the existing installed dependencies, the actual `npm run build` sequence and a mocked public catalog. Production credentials, production data and the checked-in sitemap were not used for fixture publication. One eligible out-of-stock fixture produced one product snapshot and 13 unique URLs. Client Vite build, information prerender and sitemap generation succeeded. The customer and backend packages define no lint script. Git whitespace validation and cPanel YAML parsing passed.

| Run | Result |
|---|---|
| Customer suite, Chrome enabled, final fixture build | 31 total: 27 passed, 2 failed, 2 timed out/cancelled, 0 skipped. All three added scenarios (identity, HTTP, product navigation) passed. |
| Same browser-enabled suite on unmodified d884353, separate fixture build | 28 total: 24 passed, the same 2 failed and the same 2 timed out/cancelled, 0 skipped. |
| Backend social preview controller tests, isolated mocked DB/models | 7 passed, including a stale slug, unavailable item, never-stocked item and database failure. |
| Apache 2.4.67 on loopback | Two listeners represented plain HTTP and trusted TLS-offload metadata. Actual customer .htaccess returned direct 200s, one-hop product redirects with the encoded query intact and real 404s. This was not a LiteSpeed or TLS handshake test. |

**Outstanding suite failures.** The account browser test waits for a returns heading it cannot find. The information-page test expects a wrapper that is absent in its snapshot. The home promotion-layout and responsive product-image tests each hit their 30-second deadline. All four reproduced at baseline under the same fixture setup. These checks provide no passing evidence for their individual workflows. The successful HTTP test independently checked raw canonicals on all seven information routes. No end-to-end purchase, production DB operation or full admin workflow was exercised.

For repeat runs, build an isolated customer copy with the shared directory available at its normal relative path and a fixture catalog. Supply `CHROME_BIN` and `PLAYWRIGHT_MODULE` for browser tests. The HTTP test accepts `SEO_TEST_HTTP` and `SEO_TEST_TLS`, both HTTP loopback origins serving the fixture dist. Configure the second local vhost with server-side `SW_FRONTEND_HTTPS=1` to simulate trusted TLS offload. Enable rewrite, disable MultiViews, allow the customer .htaccess and use the fixture document root on both listeners. Run `npm test` in the customer copy.

## 12. Remaining product lifecycle work

For true request-time 301/404/5XX decisions, the smallest reliable extension is a **storefront-only handler for /product/{segment}**. The operator must establish a supported mapping on the storefront vhost to trusted application code before this can replace static serving. The API's social preview is a different HTML document and is unsuitable as the customer shopping page.

Resolve the stable public ID against authoritative catalog state before serving *either* a snapshot or a fresh shell. Redirect a confirmed alias to the current canonical, preserving the query. Return a storefront 404 for confirmed deletion/inactivity. Serve active, eligible out-of-stock items normally. Return a temporary server error for lookup failures without caching absence. Distinguish an unreadable media store from deletion: the current public listing can filter out rows lacking a readable image or a valid price. A successful empty listing alone is insufficient to issue a permanent deletion decision at the edge. This extension was not implemented or enabled. Historical 5XX attribution remains open and independent of Phase 1.

## 13–15. Hosting requirements, manual cPanel steps and deployment

For a later, approved rollout:

1. Confirm the storefront vhost covers apex and www, both hostnames have valid TLS, and the API/admin applications retain their separate routing. Check whether cPanel or an upstream already redirects HTTP/www or strips/appends slashes. Consolidate effective rules so requests do not bounce between layers.
2. Verify LiteSpeed supports the shipped per-directory rules and flags, custom ErrorDocument and internal file rewrites on a staging vhost. With TLS terminating upstream, have the trusted proxy/vhost convey HTTPS status to LiteSpeed (`HTTPS=on` or server-controlled `SW_FRONTEND_HTTPS=1`). Strip client-supplied forwarding values at ingress. Test one HTTP listener and one real HTTPS path. A missing trust signal can cause a redirect to itself.
3. Build a complete customer release and verify its sitemap, app-shell.html, 404.html, twelve public pages, flat product files and assets. Retain the prior complete document root and rewrite config outside the public tree for rollback. Do not put a fixture build in production.
4. Stage a **clean** storefront release. Legacy `public_html/product/<slug>-<uuid>/index.html` directories must be absent from the new root. Preserve admin, uploads, certificates/validation paths, hosting-owned files and other applications. Prefer a supported document-root/release switch with matching rules and files. If the host uses the existing overlay copy, arrange the legacy-directory migration with the operator and verify no stale snapshot files are left. The new cPanel preflight prevents the known legacy layout from being overlaid. It does not perform migration, cleanup or an atomic release. Coordinate publication with the existing sitemap writer at the unchanged location.
5. Use the existing backend release procedure for the small social-preview change if approved. The frontend cPanel tasks do not deploy backend source. No schema migration, cron edit or DNS change is required by this implementation.
6. Run the staging and post-release checks below before declaring the rollout complete. Confirm cart, checkout, account refresh, product search, variants and images using approved staging fixtures.

## 16. Post-deployment verification commands

Use a real path from the published sitemap. These are example read-only checks for the operator after approval. Record initial status, Location and raw head before following redirects.

```bash
product='/product/REPLACE-WITH-CURRENT-SLUG-AND-UUID'
curl -sS -D - -o /dev/null "http://www.southwest.lk${product}/?ref=phase1"
curl -sS -L --max-redirs 3 -o /dev/null -w '%{http_code} %{num_redirects} %{url_effective}\n' "http://www.southwest.lk${product}/?ref=phase1"
curl -sS -D - -o /dev/null "https://southwest.lk${product}"
curl -sS https://southwest.lk/shop | grep -E 'rel="canonical"|property="og:url"'
curl -sS -o /dev/null -w '%{http_code}\n' https://southwest.lk/assets/phase1-missing.webp
curl -sS -o /dev/null -w '%{http_code}\n' https://southwest.lk/product/phase1-missing
curl -sS https://southwest.lk/sitemap.xml | head -c 2000
curl -sS -o /dev/null -w '%{http_code} %{content_type}\n' 'https://api.southwest.lk/api/store/products?paginate=1&limit=1'
```

Expect one redirect for the HTTP/www/slash combination and direct 200 for the canonical product. Expect 404 for both deliberately missing paths. Inspect a known upload directly. With a browser, refresh an unbuilt valid product and an outdated slug, inspect the final address and canonical, and verify the actual offers/stock. Use staging fixtures for inactive items and transient failure. Compare a representative product and listing in Search Console URL Inspection after deployment.

## 17. Rollback

Restore the prior customer document root, including its .htaccess, matching asset hashes and original product directory layout, as one release. Revert any new upstream host/protocol normalization in coordination with that switch. Restore the previous backend revision separately if rolling back preview metadata. Verify home, shop, one product, a hashed asset, cart/checkout deep links and one public API GET. Preserve newly published sitemap data and the existing cron destination. Previously cached permanent redirects can continue to affect clients after rollback.

## 18. Review boundaries

The starting working tree contained the two existing untracked audit reports. They were preserved. The local build and baseline comparison were isolated from the repository's existing dist and catalog sitemap. No deployment, commit, push, hosting edit, database operation or production restart was performed. Approval and a staging LiteSpeed check remain prerequisites for rollout.
