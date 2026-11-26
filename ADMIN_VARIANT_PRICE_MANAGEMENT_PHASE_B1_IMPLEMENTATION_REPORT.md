# Phase B.1 · Admin variant price management

**Ready for combined regression review.** Edit All now displays one group for each existing SKU, including variants with zero price rows. An administrator can create missing selling and cost prices, edit existing schedules, and configure checkout prices in a single save. The public selling-price eligibility rule remains in force.

## Imported local catalog, 26 November 2026

A fresh read-only MySQL transaction against the local import and a separate GET to the loopback Customer variants endpoint returned the following results. These observations supersede the starting example in the request.

| Item / SKU | Variant | Active / default | Selling record and amount | Cost | COD / Card / Koko / Mintpay (LKR) | On hand / reserved / available |
|---|---|---|---|---|---|---|
| SW-000166 / SWV-000166-H0135 | 182 · H01 3.5 | Yes / Yes | 319 · 4,000 | Missing | 4,000 / 4,100 / 4,715 / 4,715 | 5 / 0 / 5 at location 3 |
| SW-000166 / SWV-000166-H01USB | 206 · H01 USB | Yes / No | 318 · 4,250 | Missing | 4,250 / 4,350 / 5,000 / 5,000 | 5 / 0 / 5 at location 3 |

Both selling records are active LKR schedules with open start and end dates. The current local Customer API returned HTTP 200 and both SKUs, each with five available units. The USB selling amount exceeds the owner's LKR 4,000 target by LKR 250. SW-000167 and its variant 183 were both inactive. Catalog access during this work consisted of reads. The amounts and stock in this table are observations, independent of the fixture amounts below.

## Root cause and previous workflow

The Item Prices listing groups a page of **price records** by item. A product with zero prices has no group and therefore no Edit All link. The old Edit All route mounted the bulk branch of `CreatePrice.vue`. It fetched the global price collection and the item's variants, filtered prices locally, and constructed its form by mapping over the price rows. Variant information supplied labels for those rows. A variant with no price could never produce a form row. Each selling and cost row also received a “Variant N” caption derived from its array position. A separate component named `EditItemPrices.vue` existed outside the router and had a similar record-driven implementation.

The old save issued sequential PUTs for each price and separate payment-price requests. An error on a later request could leave earlier changes committed. Checkout inputs were repeated per selling schedule even though the payment table stores one price per item, variant and method. The single-record workflow and the existing Add Price bulk operation remain available. The latter can target the latest active row of a type, so Edit All uses a schedule's exact ID for edits.

Relevant existing implementation points are `Frontend/Admin/src/pages/products/ProductPrice.vue:46` and `:338`, the Axios client in `Frontend/Admin/src/api/axios.js`, `Backend/src/controllers/itemVariantController.js:164`, the `ItemPrice`, `ItemPaymentPrice` and `ItemVariant` models, and `Backend/src/utils/customerProductEligibility.js:7`.

## Admin operations

1. Open **Products → Item Prices → Edit All** on a priced product. For a completely unpriced product, open **Add Price**, select the product, then choose **Manage variant prices**.
2. Find the SKU by its name and code. The default is marked. Each existing schedule has its own amount, currency, UTC validity bounds and active status. Checkout methods have their own amounts, currencies and statuses. Existing item-level rows appear together under **Item-level prices**.
3. Use **Add Prices** when both selling and cost are missing, or **Add Missing Price** when only one is missing. Fill the amounts to create. An empty new amount leaves that price absent. A group with both types has only its existing schedules to edit.
4. For an unpriced selling configuration, **Copy prices from** offers current, active, positive selling prices on other active variants of the same item. Choosing one fills an editable selling amount and currency, plus available active checkout prices in that currency. Existing destination method records retain their values. Cost, quantities, reservations and validity dates are outside the copy operation.
5. Choose **Save All Prices** once. Successful saves reload the committed state in place. A validation error identifies the affected variant when applicable. A stale revision requires refreshing and reviewing the draft again.

### Screenshots from the authenticated local fixture

The images show actual Admin production builds at the Edit All route. The fixture starts with two variants, two ordinary prices on the default SKU and four method prices. Its synthetic Admin user signed in through the local fixture login endpoint.

| Before | After | After saving and refreshing |
|---|---|---|
| [Two records on the same SKU labelled as two variants](docs/phase-b1/before.png) | [Both SKU groups, including the unpriced USB variant](docs/phase-b1/after.png) | [Persisted USB selling and checkout prices with cost still missing](docs/phase-b1/saved.png) |

## Read, write and integrity rules

- **Read.** `GET /api/item-prices/item/:id/management` reads a consistent item snapshot containing the item identity, every owned variant, ordinary schedules, checkout prices and a revision. Inactive variants remain visible and read-only. Both a zero-price SKU and a completely unpriced product are valid responses.
- **Save.** `PUT` on the same resource accepts the revision and explicit row changes. A null row ID creates a missing type. A persisted ID must belong to the routed product, the specified variant or item-level scope, and the stated type. The editor sends changed rows only. Omitted records, including checkout methods, remain intact. The server skips equivalent existing values.
- **Authorization.** Reads use authenticated `products.view`. Edit All writes require `products.update`. Creating an ordinary schedule additionally requires `products.create`, matching the single-create route. Method creation and edits use the existing `products.update` permission.
- **Transaction and concurrency.** A managed transaction locks the item, its variants and both pricing collections in deterministic order, compares the revision, processes ordinary prices before method rows, checks the resulting schedules, writes audit records with user, old/new values and request metadata, and returns the committed snapshot. Any failure rolls back the batch, including audits. The legacy method writer also locks the parent item. The UI disables submission while saving. An old revision or competing save receives HTTP 409.
- **Validation.** Ordinary amounts follow the existing nonnegative, two-decimal rule. Checkout amounts must be positive, use a supported method, and fit the price column. Currency uses the existing three-letter convention. Nullable validity bounds use UTC with second precision. Price type and variant identity remain fixed on saved records. The page adds selling and cost types. It can display and edit other existing types.
- **Schedules and history.** Every persisted row has its own identity. Expired schedules are read-only. Existing future and inactive schedules remain distinct. Active intervals for the same SKU, type and currency cannot overlap in the changed final schedule. Boundaries are inclusive, consistent with storefront validity comparisons. Existing item-level prices remain editable. New ordinary prices require a variant.
- **Storage.** The imported `item_prices` table has nonunique lookup indexes. The method table has a unique index on `(item_id, variant_id, payment_method)`. MySQL permits multiple NULLs in a unique key, which matters for item-level method rows. Scoped locks, explicit IDs, duplicate checks and the revision protect this workflow. **No database migration, dependency or inventory operation is required.**

## Isolated fixture and regression results

All mutating integration tests ran in randomly named databases on a separate socket-only MySQL instance. The tests used real Sequelize models, Express routes, login, session middleware, database-backed role permissions and audit writes. The Customer browser loaded the compiled Phase B product page and consumed product and variant responses from the same fixture database. It exercised both selector choices without sending payments.

| R8 fixture | Before Admin save | After Admin save and refresh |
|---|---|---|
| H01 3.5 | Selling 4,000, cost 100, methods 4,000 / 4,100 / 4,715 / 4,715, five available | Selling and methods preserved, cost deliberately edited to 101, five available |
| H01 USB | No ordinary or checkout prices, five available, absent from public variant response | Selling 4,000, cost still absent, methods 4,000 / **4,125** / 4,715 / 4,715, five available |

Amounts are LKR, methods in COD / Card / Koko / Mintpay order. The test explicitly copied the default variant's prices, verified the database revision had not changed, then edited USB Card to 4,125 before saving. That difference proved independent persistence. The public response changed from one SKU to two, and the Customer browser reached each SKU. A later API step added the missing USB cost and checked that both variants then had both types.

| Coverage | Result |
|---|---|
| Single complete and single unpriced variant, one of two configured, both configured, three variants including inactive, missing selling/cost/methods, existing item-level rows | Passed in MySQL fixture. The browser also entered Edit All from Add Price on a wholly unpriced product. |
| Names, SKUs, saved amounts, copy preview, mixed create/update, persistence after refresh | Passed through authenticated Admin browser. A changed default cost, new USB selling and four independent USB methods committed together. |
| Missing session, insufficient update/create permissions, foreign variant, invalid type, currency, precision and checkout method, late invalid checkout amount | Passed. The late failure preserved the original cost and the entire pricing revision. |
| Duplicate type, replayed request, concurrent requests, overlapping schedules, expired record, inactive variant, preserved future date/time, inactive price and item-level edit | Passed. Simultaneous saves against one revision returned one 200 and one 409. |
| Backend pricing integration, Phase A JSON and text fixtures, eligibility, stock visibility, social preview, guest and signed-in checkout and specification unit regressions | **38 passed, 0 failed, 0 skipped** in the combined run. Checkout totals use the selected SKU's payment-method prices. |
| Admin release-tool regression suite | **27 passed** on a temporary case-sensitive volume. The default macOS filesystem aliases the suite's separate `Admin` and `admin` fixture directories. |
| Admin production build | **Passed** with Vite in 2.18 s, using a temporary output directory and a relative fixture API base for browser validation. |
| Customer complete suite on the isolated Phase B build with matching source and tests | **109 passed, 1 failed, 1 skipped**. Selector, guest checkout, metadata and structured-data regressions passed. The previously documented listing-gallery 24 px hit-target assertion still fails. The optional Apache HTTP/TLS fixture was skipped. The workspace Customer dist lacked the generated app shell, so the full browser run used the isolated build. |

## Changed files and review references

| File | Review point |
|---|---|
| `Backend/src/routes/itemPriceRoutes.js:19` | Authenticated item-scoped endpoints |
| `Backend/src/controllers/variantPriceManagement.js:16`, `:61`, `:128` | Snapshot, owned row validation, atomic batch and final interval checks |
| `Backend/src/services/priceAmount.js:3` and `Backend/src/controllers/itemPriceController.js:38` | Reused the original decimal amount validator |
| `Backend/src/controllers/itemPaymentPriceController.js:82` | Shared parent lock for payment inserts |
| `Frontend/Admin/src/router/index.js:312` | Edit All mounts the dedicated variant editor |
| `Frontend/Admin/src/pages/products/CreatePrice.vue:583`, `:680` | Removed the obsolete bulk branch and added the selected-product entry |
| `Frontend/Admin/src/pages/products/EditItemPrices.vue:29`, `:72`, `:98`, `:128` | SKU grouping, deliberate copy, changes-only submit and variant cards |
| `Backend/src/tests/variantPriceManagement.mysql.test.js:13`, `:103`, `:186`, `:224` | Disposable authenticated fixture, Admin/Customer browsers, public response and concurrent writer tests |
| `docs/phase-b1/{before,after,saved}.png` and this report | Review evidence |

The integration test is opt-in. From Backend, set `VARIANT_PRICE_FIXTURE_SOCKET` to a disposable MySQL socket and run `node --test src/tests/variantPriceManagement.mysql.test.js`. The browser branch takes `CHROME_BIN`, `PRICE_ADMIN_AFTER` and optionally `PRICE_ADMIN_BEFORE`, `PRICE_CUSTOMER_BUILD` and `PRICE_SCREENSHOTS`. Admin builds should point to `/api`; the Customer build should include its generated app shell. The test creates and drops its own schema.

## Limitations and review status

Edit All adds an ordinary type only when no row of that type exists. A SKU with only expired selling schedules still needs a new schedule through the existing Add Price workflow. Existing payment records retain the system's per-SKU, per-method storage model and have no validity dates of their own. A change elsewhere on the same product invalidates the editor revision, even if a different SKU changed. The overlap checks govern this editor's saves. Other pre-existing pricing entry points retain their existing schedule policies.

The working tree includes earlier specification, selector, checkout, SEO, report and release-tool work. The file table identifies the B.1 changes. All catalog writes were confined to the disposable fixture. No commit, push or deployment was performed. Phase B.1 is ready for review alongside the prior phases, with the existing gallery regression and optional HTTP/TLS coverage recorded above.
