# SEO Phase 2G Internal Links and Breadcrumbs

## 1. Status

Implementation completed locally.
Focused automated validation passed.
Consolidated browser validation and production
deployment remain pending Phase 2H.

## 2. Internal linking audit

The audit inspected product cards, product breadcrumbs,
static product generation, listing pagination, header,
footer, category and brand navigation, and shared
product URL helpers.

Confirmed findings:

- Runtime Shop breadcrumb was plain text.
- Static Shop breadcrumb was already a link.
- Product error navigation pointed to the homepage.
- Header utility Shop link pointed to the homepage.
- Product cards already used the shared product URL helper.
- Footer destinations were correctly configured.
- Category and brand directory links were retained.
- Static and runtime breadcrumb schemas used the same
  three-level hierarchy.
- Listing pagination depended on Load More interaction.

## 3. Implemented improvements

ProductDetails.vue:

- Replaced the breadcrumb container with semantic nav.
- Added an accessible breadcrumb label.
- Converted Shop text into a RouterLink to /shop.
- Added aria-current=page to the current product.
- Hid decorative separators from assistive technology.
- Corrected Back to shop navigation.

generate-sitemap.mjs:

- Aligned initial HTML breadcrumb semantics with Vue.
- Preserved crawlable Home and Shop links.
- Identified the current product accessibly.
- Hid decorative separators from assistive technology.

AppHeader.vue:

- Corrected the utility Shop destination to /shop.

## 4. Product card navigation

Product cards use productPathFor(props.product).

Both image and product content RouterLinks share
the calculated destination.

The existing accessible image link label is retained.

Invalid product identities continue to fall back to
the homepage. This defensive behavior was not changed.

Rendered anchor destinations require final browser
verification.

No product card design or image navigation controls
were modified.

## 5. Breadcrumb structured data

Existing hierarchy retained:

1. Home
2. Shop
3. Product

Static and runtime schema implementations were
inspected and found to use the same hierarchy.

Exact product name and canonical URL parity remain
scheduled for consolidated validation.

No new structured data claims were introduced.

## 6. Pagination decision

Existing cursor-based pagination is retained.

The initial listing requests 20 products.
Additional products require Load More interaction.

This limits discovery through listing links alone.
The XML sitemap provides a separate discovery mechanism
but does not fully replace crawlable internal links.

Stable crawlable pagination is deferred because it
requires broader architectural changes.

## 7. Focused validation

Source verification:

- Eight navigation assertions passed.
- Zero failures.
- JavaScript syntax checks passed.
- Git whitespace checks passed.

Automated regression results:

| Test group | Passed |
|---|---:|
| Internal navigation | 8 |
| Listing preview | 9 |
| Merchant return policy | 5 |
| Homepage structured data | 6 |
| Product SEO | 31 |
| Sitemap generation | 3 |
| Total | 62 |

Failed: 0
Skipped: 0
Cancelled: 0
Execution duration: approximately 1.45 seconds.

## 8. Remaining limitations

- Internal navigation tests are source-level assertions.
- Actual browser navigation remains pending.
- Breadcrumb visual appearance requires inspection.
- Exact static and runtime schema parity remains pending.
- Crawlable pagination is deferred.
- Invalid product card identity fallback is retained.
- Related product inspection returned no direct matches
  and did not independently establish its full behavior.
- Raw versus rendered filtered URL indexing discrepancy
  remains scheduled for Phase 2H.

## 9. Modified and created files

- `Frontend/Customer/src/pages/ProductDetails.vue`
- `Frontend/Customer/scripts/generate-sitemap.mjs`
- `Frontend/Customer/src/layouts/AppHeader.vue`
- `Frontend/Customer/tests/internalNavigation.test.mjs`

## 10. Verified source checksums

- `src/pages/ProductDetails.vue`: `b22c2d04a13ec23cd59d53b9411a5babf955865a81e533037bdaa619f4eeb52e`
- `scripts/generate-sitemap.mjs`: `7ec9cab861b4f8e064571d10b9877ec65e3f16e451ee4325f466bf1451007944`
- `src/layouts/AppHeader.vue`: `b3483c72cd494e27cd6ea9601ce5a97b2041bcd9e96c5c1f2324f86dd00ee9fe`
- `tests/internalNavigation.test.mjs`: `01f3c5dd105aafb5ba9308693989b02a22fd22c760aa5cfd2c9d14fa3003d3ec`

## 11. Scope restrictions

No CSS changes.
No product slug or canonical URL changes.
No product card design changes.
No pagination changes.
No category or brand filtering changes.
No additional API endpoints.
No backend changes.
No Admin changes.
No database changes.
No full catalog build during Phase 2G.
No production deployment.
No Git staging or commit performed.

## 12. Next phase

Phase 2H: Consolidated validation and deployment.

All locally implemented Phase 2 improvements must
be included in the final Customer release candidate.

Remaining material findings must be evaluated before
production activation.

Previously identified deployment permission and
LiteSpeed compatibility risks must be addressed.

Production deployment requires explicit approval.
