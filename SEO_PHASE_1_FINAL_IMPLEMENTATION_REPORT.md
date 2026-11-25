# South West technical SEO — Phase 1 closure

25 November 2026 · Customer storefront · **Operationally completed with documented exceptions**

## Executive summary

The Customer storefront is operational. The operator's final verification found **141/141 deployed product snapshots served correctly**, **143/143 public product URLs returning HTTP 200**, and **10/10 manual acceptance checks passing**. The extra two products were published after the build and loaded through Vue. A successful document response for either new product establishes reachability; its complete initial metadata and structured data remain unverified.

Production figures and the deployment timeline below are supplied historical evidence. This closure review inspected the local repository, checked the Customer rewrite checksum, analysed local catalog artifacts and reran the focused product SEO tests. It made no production requests. The earlier readiness verdict describes the candidate before correction and activation. Its warnings about release ownership, stale snapshots and TLS/rewrite testing remain relevant to future releases.

## Original problems and delivered changes

| Original problem | Customer implementation | Evidence boundary |
|---|---|---|
| Physical product directories redirected sitemap URLs to trailing-slash URLs whose canonical pointed back | Flat product HTML; slashless HTTPS apex URLs across sitemap, links, Open Graph, canonical and offer URLs. Internal rewrite serves the corresponding file. | Operator verified delivery of all 141 snapshots after the permission correction. Local rule matches the corrected condition. |
| Duplicate scheme, www, case and filename aliases; offloaded HTTPS could downgrade filename redirects | Recognized aliases redirect to explicit HTTPS apex destinations; query parameters survive; sensitive path segments are not globally lowercased. | Production normalization and query preservation verified. The full run recorded an intermittent redirect failure; all 24 targeted static HTML alias checks later passed. |
| Shared SPA fallback served successful HTML for absent resources | Explicit storefront route mappings, static not-found document and HTTP 404 for missing files, unknown pages and malformed product paths. Valid-shaped unbuilt products retain the app shell. | Missing assets, pages and malformed products verified in production. A well-formed nonexistent UUID remains a separate lifecycle case. |
| Initial homepage canonical on unrelated landing pages; alias could become a product canonical | Route-specific listing heads, prerendered information pages, neutral unresolved shell, canonical de-duplication and lookup by stable public ID before using the catalog slug. | Current local source corroborates design. The live acceptance record is aggregate; individual DOM transitions were not independently rechecked for closure. |
| Overlay deployment mixed applications and risked overwriting sitemap/configuration | Automatic cPanel overlay disabled. Customer release preparation is separate from activation; reviewed hosting config is merged privately, and the cron-owned sitemap stays outside the Customer payload. | Customer-only activation and preservation of the existing sitemap cron were reported. Admin and backend were not deployed. |

The storefront still needs public catalog JSON and uploaded images. Public API access passed the operator's verification. Phase 1 provides no basis for blanket crawl restrictions or a speculative fix to the historical 5XX rate.

## Production deployment and recovery record

1. **Build.** The production Customer build generated 141 product snapshots, 12 static sitemap routes, 153 build sitemap URLs, 155 HTML files including supporting documents, 53 JavaScript bundles and 42 CSS bundles. Build-time SEO validation passed 2,576 checks with zero reported warnings or errors.
2. **First activation.** Temporary maintenance rewrite rules were used. LiteSpeed continued returning unexpected HTTP 503s after filesystem rollback. Restoring the original configuration and refreshing its modification timestamp restored normal storefront responses. Recovery checks and manual storefront checks then passed. This incident does not identify the cause of the earlier Search Console 5XXs.
3. **Second activation.** The Customer application and reviewed SEO configuration were installed without temporary maintenance rewrite rules. Initial checks found product URLs serving the generic application shell. A 200-only check would have missed the defect.
4. **Confirmed permission defect.** Under umask 077, creating the staged public product directory with requested mode 0755 yielded mode 0700. The directory was corrected to 0755, and product HTML files retained 0644. The production condition was also changed to `RewriteCond %{REQUEST_FILENAME}.html -f`. All 141 snapshots then served correctly. The earlier condition was never retested with corrected permissions, so its independent contribution is unknown.
5. **Final verification.** The full post-correction run recorded **1,073 passes, one intermittent redirect failure and two warnings**. The later targeted run passed **24/24**, including the previously failing shop.html redirect. The underlying intermittent LiteSpeed behavior remains unexplained. The record gives no detailed classification of the two warnings.
6. **Catalog growth.** At final verification the live sitemap had 155 URLs, including 143 products. Anker Soundcore R50i NC True Wireless Bluetooth Earbuds and Anker Soundcore R60i NC True Wireless Bluetooth Earbuds were added after the build. Each returned 200 and passed manual storefront loading checks. They use the client-rendered shell. The figures 153 and 155 refer to different publication times.

**Manual acceptance:** 10/10 supplied storefront checks passed. No actual payment processing was tested. The record does not enumerate ten individual transactions or establish a successful live purchase.

## Source synchronization and deployment safeguards

| Item | Closure evidence |
|---|---|
| Merged live .htaccess | Operator-supplied SHA256 `24a7f7a47f0a0b03373703f95555b715cd39418a5fabb4814f42ef3d0d70fa03`. Includes preserved cPanel PHP handler. |
| Local Customer public/.htaccess | Independently hashed here: `51c16bf7099c0f540c927a0c5f5f66d6f83f8506df3cd80a6313a5287f1a2a35`. Matches the supplied local checksum. Line 62 tests REQUEST_FILENAME with .html appended. Local storefront rules omit the hosting-specific handler. |
| Reviewed configurations | `Frontend/Customer/tools/hosting_config.py` accepts the reviewed legacy prefix or pinned current prefix, a precisely bounded PHP handler, and the pinned candidate digest. Unknown prefixes, extra directives, altered candidates or unexpected handler structures are rejected. |
| Private preparation | `Frontend/Customer/tools/customer_release.py:248` checks an account-owned 0700 parent and verifies 0700 on the new private directory. Preparation uses a lock, inventories build/live trees, records checksums and backs up scoped files. A READY marker denotes a prepared package only. |
| Public permissions | `Frontend/Customer/tools/public_permissions.py` explicitly chmods the newly created public product directory to 0755. Its verifier checks that the directory is nonempty, mode 0755, with regular HTML files of mode 0644, and rejects directory/file symlinks. The future activation caller must set 0644 on copied files; the verifier only checks it. |
| Activation boundary | The permission helper and tests exist. No reusable production activation integrates them. `tools/DEPLOYMENT_PERMISSIONS.md` records this dependency. The root `.cpanel.yml` exits unsuccessfully before publishing anything. The release-specific historical activation procedure must not be reused as a general deployer. |

## Regression evidence

| Verification | Most recent supplied result | Scope |
|---|---|---|
| Python deployment safeguards | 21/21, comprising 11 hosting-config and 10 permission tests | Isolated tests, not production activation. |
| Product SEO and sitemap | 12/12 product SEO and 3/3 generator tests | Product SEO independently rerun in this closure: 12 passed, zero failures/skips. |
| Configuration integrity and build synchronization | 4/4 integrity checks; 189/189 application/test source files matched the isolated build workspace | Supplied comparison, not a byte-for-byte comparison of today's entire repository with the live host. |
| Full Customer suite | **31 total, 29 passed, 1 failed, 1 skipped, zero cancelled** | Dedicated HTTP serving test skipped because its isolated Apache server was absent. Production HTTP verification was conducted separately. Earlier fixture runs in the readiness report apply to earlier source states. |
| Known failure | `Frontend/Customer/tests/productImages-browser.test.mjs:62` requires a 24×24 CSS-pixel target. Original gallery targets measured approximately 12×16. | The owner restored the compact controls. Current CSS and the unchanged assertion corroborate the exception. Neither UI nor test was changed during closure. |
| Git whitespace | `git diff --check` passed in this review | Tracked working-tree changes. The two new reports were also inspected separately. |

## Final Git review and recommended future commit scope

The working tree was reviewed against HEAD. These lists name individual files; use an explicit path selection in a future reviewed commit. Nothing was staged. File prefixes shown in headings apply to every listed relative path.

**Root files to include**

- `.cpanel.yml`
- `SEO_CRAWL_AUDIT_REPORT.md`, `SEO_5XX_ROOT_CAUSE_REPORT.md`, `SEO_PHASE_1_IMPLEMENTATION_REPORT.md`, `SEO_PHASE_1_DEPLOYMENT_READINESS_REPORT.md`, and this `SEO_PHASE_1_FINAL_IMPLEMENTATION_REPORT.md`. Preserve the earlier reports as dated records.

**Customer implementation to include — Frontend/Customer/**

- `public/.htaccess`, new `public/404.html`, `vite.config.js`
- `scripts/generate-sitemap.mjs`, `scripts/htmlMeta.mjs`, `scripts/render-information.mjs`
- `src/router/index.js`, new `src/router/listingMeta.js`, `src/utils/productSeo.js`, `src/composables/usePageMeta.js`
- `src/components/InformationPageLayout.vue`, `src/components/products/ProductCard.vue`, `src/layouts/AppHeader.vue`
- `src/pages/Cart.vue`, `src/pages/NotFound.vue`, `src/pages/ProductDetails.vue`, `src/pages/account/MyOrders.vue`, `src/pages/account/Wishlist.vue`, `src/pages/footer/Faq.vue`, `src/pages/footer/StoreListing.vue`

ProductCard's current diff centralizes URL construction. The compact gallery CSS is present. The information-page and FAQ changes concern rendering of the existing content during loading.

**Customer regression tests to include — Frontend/Customer/tests/**

- `account-browser.test.mjs`, `homeLayout-browser.test.mjs`, `informationPages.test.mjs`, `productImages-browser.test.mjs`, `productSeo.test.mjs`, `sitemapGeneration.test.mjs`
- New `productNavigation-browser.test.mjs` and `servingSeo.test.mjs`

**Customer deployment safety files to include — Frontend/Customer/tools/**

- New `customer_release.py`, `hosting_config.py`, `public_permissions.py`, `DEPLOYMENT_PERMISSIONS.md`, `tests/test_hosting_config.py`, `tests/test_public_permissions.py`

**Exclude or review independently**

| Classification | Paths and disposition |
|---|---|
| Backend edits present locally, not deployed | `Backend/src/controllers/socialPreviewController.js` and `Backend/src/tests/socialPreviewController.test.js`. Separate backend review/release. The storefront release does not prove the API preview change is live. |
| Unfinished, unrelated Admin tooling | `Frontend/Admin/tools/admin_release.py` and `Frontend/Admin/tools/tests/test_admin_release.py`. Exclude both. |
| Generated artifacts | `Frontend/Customer/tools/__pycache__/hosting_config.cpython-312.pyc`, `Frontend/Customer/tools/__pycache__/public_permissions.cpython-312.pyc`, `Frontend/Customer/tools/tests/__pycache__/test_hosting_config.cpython-312.pyc`, `Frontend/Customer/tools/tests/__pycache__/test_public_permissions.cpython-312.pyc`. Exclude, leave in place. Historical ignored dist output was read as audit evidence only. |
| Phase 2 documentation | `SEO_PHASE_2_ON_PAGE_AUDIT_REPORT.md` belongs in a separate audit/docs change. |
| Other unrelated changes | No further modified or untracked paths appeared in the current Git inventory. |

## Outstanding exceptions, rollback and next steps

- **Availability:** the original historical 5XX cause, including attribution to API versus storefront hosts, remains unconfirmed. Retain dated GSC examples and correlate with host logs if it recurs.
- **Catalog lifecycle:** new products can lack initial metadata/schema; valid-shaped unknown UUIDs can initially return 200. Deleted snapshots can remain stale; renamed slugs are corrected in the browser without an authoritative initial 301. Do not equate out-of-stock with deletion.
- **Operations:** retain private backups, the reviewed merged configuration, the old assets and an independently tested rollback path. Verify exact snapshot contents and permissions after any switch or rollback, in addition to status codes. Preserve the cron-owned sitemap, cPanel handler, API/uploads and admin. Avoid unverified temporary maintenance rewrites; integrate and exercise the permission helper before any future reusable activation.
- **Acceptance:** product gallery target size remains open. Intermittent redirects and the two live warnings are not closed by a clean targeted retest. Backend previews, Admin deployment tools and actual payment processing are outside Customer acceptance.
- **Outcomes:** indexing improvements, organic traffic and ranking changes have not been measured. Capture a dated GSC baseline by page, query, country and device before attributing any benefit.

Close the deployed Customer Phase 1 release with these exceptions. Review the explicit commit scope, retain the operator's verification records, and use the separate Phase 2 audit to select a small content pilot. Only the two Markdown reports were authored by this closure task.
