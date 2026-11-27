# South West sales correction and cleanup

Reviewed on 27 November 2026. The working tree was clean at the start. All changes are local and available for review.

## Sales calculation

The all-time dashboard summed the stored payment total. Daily and monthly reports summed the same column, and the summary accumulated it again in JavaScript. Guest and signed-in checkout both include delivery in that amount. The Admin dashboard and trend chart display the values returned by these services.

The dashboard, summary, daily and monthly reports now use the same SQL expression, `subtotal - discount_amount`. Both columns are stored decimals. Report rollups add integer cents and return LKR amounts in the existing numeric format. Delivery, including additional delivery charges, never enters the expression. Tax is a separate report column. Checkout currently assigns zero tax. A test with nonzero tax confirms that it also stays outside product revenue.

An order with Rs. 10,000 of products, a Rs. 500 discount and Rs. 350 delivery contributes **Rs. 9,500**. Its customer payment total is **Rs. 9,850**. The summary exposes both values as `totalSales` and `totalAmount`. Summary Excel rows now supply the value consumed by the existing Total Sales column. Recent orders still display the order amount.

The all-time card retains its original order scope. Date-filtered reports retain their online-only condition and the inclusive start and exclusive next-day boundary. Cancelled and returned orders are excluded. Existing recognition uses order status. An otherwise eligible order with a refunded, partially refunded or unpaid payment status still contributes its post-discount product value. Product analytics continue to use order lines, and payment reports use payment records.

The implementation is in `Backend/src/services/reportService.js` and `Backend/src/controllers/dashboardController.js`. Regression coverage is in `Backend/src/tests/reportSales.mysql.test.js`. The correction reads order data. Historical amounts, checkout pricing, invoice totals, gateway handling and currency formatting retain their existing behavior.

## Verification

| Suite or check | Baseline | Final |
|---|---|---|
| Backend, including disposable MySQL integration fixtures | 478 passed | 479 passed |
| Admin Node tests | 22 passed | 22 passed |
| Admin Python release tests | 27 fixture setup errors | 27 passed |
| Customer Node, Chrome and Apache, fresh fixture builds | 110 passed, 1 failed across the suite and separate Apache run | 110 passed, 1 failed |
| Customer Python release tests | 21 passed | 21 passed |
| Optional price-management Chrome path inside the Backend MySQL integration test | Timed out locating the Manage variant prices link with the original Admin build | Same timeout with the final Admin build |
| Admin and Customer builds | Both built in temporary directories | Both built in temporary directories |

The final suite runs recorded zero skips and cancellations. The separately enabled price-management Chrome path is reported independently of the standard Backend total. The initial Customer run against the existing local dist had 103 passes, six failures, one cancellation and one skip. That dist lacked app-shell.html. The comparable clean-build baseline had 109 passes, one failure and one skip until the separate loopback Apache run passed the skipped case.

The focused Phase 1 run passed all 28 sales, checkout, invoice and payment tests before cleanup. The revenue fixture covers paid delivery, free delivery, discounts, cent rounding, cancellation, returns, payment-status refunds, unpaid and partially paid orders, month and day boundaries, and empty periods. The final regression also reopens the three Excel exports and checks individual and total sales cells alongside shipping. Existing checkout and cart tests exercised variants, distinct SKU lines, quantities and method-specific prices. Delivery, invoices and payment tests ran in the full Backend suite.

Local SEO verification used a deterministic one-product catalog. The build generated seven information pages, one product page, homepage Organization schema and a 13-URL sitemap. The sitemap pagination and failure-preservation tests passed. Apache tested canonical URLs, redirects, public routes, SPA refreshes and 404 responses. Product metadata passed before and after hydration. Every emitted literal dynamic import resolved, comprising 81 Admin references and 45 Customer references. The Customer manifest resolved all its files and chunk references.

JavaScript syntax checks, Python parsing, JSON parsing, all 156 remaining Vue single-file component parses and the Git whitespace check passed. The package manifests define no lint script. Live gateways, the live catalog, the hosting scheduler and Google indexing were outside the local verification.

## Audit and cleanup

The inventory covered all 1,026 originally tracked paths, including 543 Backend and 409 Frontend paths. The review combined source searches, binding and reference checks, route and model registration review, Vue template checks, dependency and asset inventories, and focused inspection of removal candidates. Binary assets and historical files received inventory-level review. Ignored local credentials, backups, database files, media and existing build outputs were excluded from cleanup.

The implementation and tests touch **42 paths**, comprising 26 edited files, 15 deleted files and one new regression test. The code and test diff adds 147 lines and removes 305. This report is a separate new file.

- Removed 19 unused import bindings across checkout, order, catalog, import, notification, OAuth, wishlist and Admin payment modules. Registered routes, middleware and exported controller entry points are intact.
- Removed nine unused constants or state bindings and six private helpers. These included an uncalled order-price lookup, an unused order-item snapshot, three obsolete sitemap description helpers and the header support-email loader. The header had fetched contact information on mount solely to fill an unused computed link. The footer, contact page and WhatsApp component still read the information they display.
- Removed eight development console logs and one duplicate review-error detail dump. The removed header fetch also took its own error handler with it. Zero debugger statements required removal.
- Preserved request and startup logging, migration and worker output, audit events, security and payment diagnostics, submission failure reporting and SEO build progress. Dependency and lockfile changes total zero.
- The Admin release test used sibling paths named Admin and admin. On this case-insensitive Mac, its copy operation failed before the first assertion. Giving the build a separate parent restored all 27 tests.
- The baseline bulk-import and rejected order-item tests called the real audit writer through the configured loopback development database. The log records two rejected bulk-import inserts and nine attempted order-item audit inserts. The latter may have persisted locally. Their disposition was not checked or altered. Both tests now supply test doubles. The order-item test explicitly checks the emitted audit actions. Subsequent full runs disabled the default database connection and used an isolated socket for database integration.

### Deleted files

All 15 were zero-byte placeholders with no implementation, import, route registration or discovered runtime loader. Both applications rebuilt after removal.

| Directory | Files |
|---|---|
| Frontend/Admin/src/api | inventoryApi.js |
| Frontend/Admin/src/components/common | AppBadge.vue, AppButton.vue, AppInput.vue, AppModal.vue, AppSelect.vue, AppTable.vue |
| Frontend/Admin/src/pages/inventory | LocationList.vue, StockList.vue, StockMovementList.vue |
| Frontend/Customer/src/components/cartItem | CartItem.vue |
| Frontend/Customer/src/composables | useAuth.js, useCart.js |
| Frontend/Customer/src/services | cartService.js, productService.js |

### Items retained for review

Nonempty components without a literal filename reference include EditItemPrices.vue, UnitList.vue, CreatePayment.vue and AnalyticsConsent.vue. Dependency candidates include Backend passport and passport-google-oauth20, frontend-root react-router-dom and Admin cors, multer and @tiptap/pm. Integration, peer or external consumption needs independent confirmation before removal. Vue directives, seasonal theme components, theme assets and responsive CSS can be selected at runtime. All eleven standalone stylesheets had a filename reference.

## Remaining failures and manual checks

The Customer gallery test measured the second-image control below its required 24-by-24-pixel target on both fresh builds. The optional Admin pricing browser scenario could not locate its requested Manage variant prices link on either Admin build. Steps after that click remain unverified by this scenario. Each failure reproduced independently of the sales correction.

Before release, use a staging account to:

1. Compare one discounted paid-delivery order and one free-delivery order across the dashboard, date-filtered summary, chart and Excel exports. Compare the separate shipping and payment amounts with the customer invoice.
2. Check a month-end order and a cancelled or returned order against the same range, including an empty day.
3. Open the Admin price-management workflow with a single-variant and a multi-variant item. Verify the intended navigation, activation and payment-specific prices.
4. Check the second-image control at mobile and desktop widths, submit a product review and verify contact details in the footer.
5. Confirm a staging sitemap refresh with a representative catalog, then open a generated product URL and an account route directly.

No commit, push, deployment, historical order update, production migration or hosting change was performed.
