# Phase A implementation report — Admin # Phase B: Generic Customer Product Variant Selection

## Approval

Phase A has been reviewed and approved to proceed to Phase B.

Read the following reports before implementation:

- `PRODUCT_VARIANTS_SPECIFICATIONS_SIDEBAR_INVESTIGATION_REPORT.md`
- `SPECIFICATION_OPTIONS_PHASE_A_IMPLEMENTATION_REPORT.md`

Preserve all Phase A changes and existing unrelated working tree modifications.

Implement Phase B only.

## Objective

Fix the Customer product variant selection mechanism so that every eligible, in-stock variant can be selected, including variants distinguished by non-colour specifications.

Preserve the existing Customer product page design, pricing architecture, inventory validation and SEO implementation.

## 1. Confirmed affected products

### R8 H01 3.5mm/USB Wired Gaming Headset

Item code: SW-000166

Item ID: 166

Variants:

- ID 182: H01 3.5
- ID 206: H01 USB

The product owner confirms both variants have a selling price of LKR 4,000.

However, variant 206 currently has no selling-price record, payment-price records or stock record.

This is a commercial configuration issue.

Requirements:

- Do not automatically create production or imported catalog price records.
- Do not copy stock quantities.
- Do not infer payment-method prices.
- Do not introduce runtime price inheritance.
- Preserve the existing positive selling-price eligibility requirement.
- Use isolated fixtures containing two properly configured headset variants to test connector selection.

### R8 HD11 3-Pin AC Power Cable

Item code: SW-000179

Variants:

- ID 204
- ID 205

Both variants are eligible and in stock.

Their distinguishing Compatibility values are LAPTOP and DESKTOP.

The existing frontend ignores Compatibility during attribute grouping and hides the generated fallback configuration cards.

Fix this confirmed defect.

## 2. Source inspection

Inspect the existing implementation before editing:

- `Frontend/Customer/src/pages/ProductDetails.vue`
- `Frontend/Customer/src/components/VariantSelector.vue`
- `Frontend/Customer/src/utils/productOffer.js`
- `Backend/src/controllers/storeProductController.js`
- `Backend/src/utils/customerProductEligibility.js`
- Customer cart and checkout controllers
- Relevant specification models and Phase A normalization service

Do not duplicate existing utilities unnecessarily.

## 3. Generic variant selection architecture

Extract reusable variant selection logic into a focused utility, preferably:

`Frontend/Customer/src/utils/variantSelection.js`

The implementation must:

- Support active, eligible variants returned by the Customer API.
- Normalize encoded variant attributes.
- Preserve original attribute display labels and values.
- Identify attributes that genuinely distinguish variants.
- Exclude identical specifications from selection controls.
- Prefer meaningful configured Select attributes where appropriate.
- Support text, numeric, Boolean and other specification types when they distinguish variants.
- Support arbitrary future specification names.
- Preserve existing colour-based selection.
- Support variants without colours.
- Support products containing both coloured and uncoloured variants.
- Support combined colour configurations.
- Handle missing attribute values.
- Handle duplicate attribute combinations.
- Use variant names or SKUs as fallback identifiers when necessary.
- Ensure every eligible in-stock variant ID is reachable.
- Avoid redundant or unnecessary selection controls.
- Avoid presenting combinations that do not exist.

Do not hardcode product IDs or specific attribute names as the primary selection mechanism.

Reuse normalized specification metadata from Phase A where appropriate.

Only extend the public API with narrowly scoped specification metadata if required. Preserve the existing response contract and avoid exposing internal or administrative fields.

## 4. Selection behaviour

When a customer selects a variant, correctly update:

- Selected variant ID
- Variant name
- SKU
- Selling price
- Cash price
- Card payment price
- Koko price
- Mintpay price
- Available inventory
- Stock status
- Quantity restrictions
- Displayed specifications
- Add-to-cart availability
- Buy Now availability

Reset quantity appropriately when switching variants.

Do not infer variant-specific images when no variant-image association exists. Preserve the shared product gallery.

A priced but out-of-stock variant should remain visible as unavailable.

An unavailable configuration must not silently select another unrelated SKU.

A single eligible variant should not display unnecessary selection controls.

## 5. Cart and checkout integrity

Verify that the selected variant ID is retained throughout:

- Signed-in Add to Cart
- Guest Add to Cart
- Signed-in Buy Now
- Guest Buy Now
- Cart quantity updates
- Checkout review
- Payment-method price calculation

Different variants of the same product must remain distinct cart lines.

Preserve existing Backend stock, price and item/variant relationship validation.

Use test fixtures with different prices and inventory quantities to detect accidental default-variant pricing or stock inheritance.

Do not execute real payments.

## 6. SEO preservation

The recently deployed SEO implementation must remain intact.

Preserve:

- Existing canonical product URLs
- Product titles
- Meta descriptions
- Open Graph metadata
- Twitter metadata
- Product structured data
- Offer structured data
- Breadcrumb structured data
- Static product snapshots
- Sitemap generation
- Shared default variant selection

Do not change the initial default variant precedence.

Preserve consistency between the initial default offer in static HTML and the initial browser-rendered product.

Interactive variant selection must not create duplicate canonical URLs.

Keep static fallback purchasing disabled.

Compare relevant SEO output before and after the implementation using identical product fixtures.

## 7. Catalog-wide regression validation

Review every multi-variant product identified in the investigation report.

In particular, verify:

- LDNIO cables differentiated by length
- RAM products differentiated by type and speed
- HDMI cables with multiple lengths
- Printer cables
- CAT6 network cables
- Existing colour-based products
- R8 H01 headset fixtures
- R8 HD11 power cable

The fourteen previously functioning visible multi-variant product pickers must retain access to every eligible in-stock SKU.

Verify that both HD11 variants become reachable.

Use the current imported catalog as read-only evidence.

## 8. Required tests

Add focused unit, component, API and browser tests as appropriate.

Cover:

- Single eligible variant
- Two connector types
- Compatibility-only differences
- Model-only differences
- Capacity differences
- Cable length differences
- Pack Quantity differences
- Multiple distinguishing attributes
- Arbitrary specification names
- Identical attribute values
- Missing attributes
- Duplicate combinations
- Colour-only variants
- Mixed coloured and uncoloured variants
- Out-of-stock variants
- Missing selling-price records
- Inactive variants
- Quantity reset and maximum quantity
- Correct payment-method prices
- Correct selected variant IDs in cart and checkout
- Route changes between products
- Existing default variant selection
- Static and runtime SEO consistency

Run the existing relevant Customer and Backend regression suites.

Build the Customer frontend into an isolated temporary directory.

Use isolated fixtures for all mutating tests.

## 9. Constraints

- Implement Phase B only.
- Do not implement the Admin sidebar change yet.
- Do not implement shared variant pricing yet.
- Do not modify imported production catalog records.
- Do not introduce database migrations unless proven necessary and separately approved.
- Do not introduce unnecessary dependencies.
- Do not revert Phase A changes.
- Do not weaken existing tests.
- Do not modify unrelated modules.
- Do not access production.
- Do not send emails or customer notifications.
- Do not execute real payments.
- Do not commit, push or deploy.

## 10. Required implementation report

Create:

`PRODUCT_VARIANT_SELECTION_PHASE_B_IMPLEMENTATION_REPORT.md`

Include:

1. Executive summary.
2. Confirmed root cause resolution.
3. Implemented variant selection architecture.
4. Modified files and relevant line references.
5. Before and after selection behaviour.
6. Headset fixture validation.
7. HD11 actual catalog validation.
8. Complete multi-variant catalog regression results.
9. Pricing and inventory consistency results.
10. Cart and checkout validation results.
11. SEO regression comparison.
12. Unit, integration and browser test results.
13. Customer production build results.
14. Database migration requirements.
15. Known limitations and unresolved risks.
16. Git working tree summary.
17. Readiness for Phase C.

Clearly distinguish actual catalog observations from synthetic fixture results.

Stop after Phase B implementation and validation for review.specification options

26 November 2026 · Local implementation for review

## 1. Implemented changes

Opening a Select specification now populates its textarea in saved order. Editing an unrelated field sends only the changed metadata. A deliberate option edit sends the proposed list and the ordered list originally loaded by the editor. Cancel discards local edits. A legacy Select with zero predefined options can be reopened and have its metadata saved with an empty textarea.

## 2. Modified files

| File | Responsibility |
|---|---|
| `Backend/src/services/specificationOptions.js` | Normalize stored options, validate replacements and changed assignments, check existing usage. |
| `Backend/src/models/ItemSpecification.js` | Expose normalized options from the Sequelize instance used by list, detail, create/update responses and item-type includes. |
| `Backend/src/controllers/itemSpecificationController.js` | Validate create/update requests, check the original list under lock, protect references, and compare normalized audit snapshots by content. |
| `Backend/src/models/ItemSpecificationValue.js`, `Backend/src/models/ItemVariant.js` | Run assignment checks on instance saves inside the existing writer transactions. The variant hook also covers the existing bulk-create and import paths. |
| `Backend/src/controllers/itemSpecificationValueController.js`, `Backend/src/controllers/itemVariantController.js` | Return an actionable conflict response when an assignment no longer matches a configured list. |
| `Frontend/Admin/src/pages/products/CreateSpecification.vue` | Initialize the edit buffer, preserve the original list, send changed fields, and handle legacy empty definitions and unreadable data. |
| `Frontend/Admin/src/pages/products/CreateItemVariants.vue` | Recognize legacy encoded null and show a previously assigned literal when it falls outside today's dropdown. |
| `Backend/src/tests/specificationOptions.test.js`, `Backend/src/tests/specificationOptions.mysql.test.js` | Unit coverage and opt-in HTTP/ORM tests on disposable MySQL databases. |
| `SPECIFICATION_OPTIONS_PHASE_A_IMPLEMENTATION_REPORT.md` | Implementation record and future pricing workflow proposal. |

## 3. Root cause resolution

The imported `item_specifications.options` column is LONGTEXT. Its JSON list reached the old editor as a string, so the array-only hydration branch displayed nothing. The Sequelize getter now accepts native arrays and JSON-encoded arrays, retaining their literals and order. Both native null and the encoded literal `null` become an empty array. It also supports legacy newline-separated lists. Unreadable list formats produce a null sentinel; the definition editor displays an error and blocks submission. Loading a record performs no write or backfill.

## 4. API contract and examples

Selected fields from `GET /api/item-specifications/25` illustrate the change. The former payload comes from the investigation's local detail-controller read. The updated model was checked against the same local record, and the HTTP response contract was exercised with isolated records.

```json
{"data":{"id":25,"name":"Pack Quantity","options":"[\"1 PSC\", \"2 PSC\"]"}}
```

```json
{"data":{"id":25,"name":"Pack Quantity","options":["1 PSC","2 PSC"]}}
```

Interface previously returned `"options":"null"`; it now returns `"options":[]`. List rows, detail records and successful create/update responses use the same representation.

A metadata-only PUT can send `{"description":"Updated description"}`. To add a value, the editor sends an explicit replacement, for example:

```json
{"expected_options":["1 PSC","2 PSC"],"options":["1 PSC","2 PSC","3 PSC"]}
```

A missing or stale baseline on a Select replacement returns HTTP 409 with instructions to reopen. A replacement that would remove a referenced literal also returns 409. A new Select with an empty list returns 400. An explicit empty replacement on an existing Select returns 409. Converting an unused Select to another type requires the original list and an explicit empty replacement.

## 5. Data integrity protections

- The definition update takes a row lock, compares the baseline, checks usage, writes the definition and records the audit in one transaction. Assignment writers take a shared lock when checking the current definition. A definition update uses READ COMMITTED so its usage check sees assignments committed while it waited.
- Product assignments are checked by specification ID and value. Variant assignments are checked by attribute name and value across active and inactive rows. Name and removal checks conservatively account for case and surrounding spaces. A rename is guarded against both old and proposed variant keys. A type conversion with assignments is rejected.
- Additions, ordering changes and unused-value renames/removals are supported. A used literal must remain in the list with its existing spelling. Legacy values may remain assigned even when absent from the predefined list. Only changed assignments undergo membership validation, and empty legacy definitions continue to permit the existing free-text workflow.
- The definition editor never updates product or variant assignment rows. A metadata-only edit preserves the stored list representation as well as its contents.

## 6. Validation results

| Check | Result |
|---|---|
| Unit | 3/3 passed. Covered native and encoded lists, order, null, legacy text, malformed input, metadata-only changes, empty replacements and stale baselines. |
| Isolated HTTP and MySQL | 2/2 storage suites passed on MySQL 9.4. Each used a fresh fixture database on a separate socket-only server. Exercised POST/GET list/GET detail/PUT, addition, reordering, unused rename/removal, reopen, stale edits, referenced product/inactive variant, type/name conflicts, preservation of a legacy assigned literal, and competing definition/assignment writes in both orders. |
| Chrome editor | 7/7 browser checks passed in headless Chrome using the compiled Vue editor, Vue Router and an in-memory Axios fixture. Checked exact Pack Quantity lines, cancel without a write, metadata-only payload, replacement baseline, persisted order on reopen, empty Interface, and metadata save on empty Interface. This check caught a native textarea validation constraint that blocked Interface saves; the corrected build passed. |
| Related backend regressions | 26/26 existing tests passed across the bulk-product-import and variant-pagination suites. With the three Phase A unit tests, the run reported 29/29. |
| Admin production build | Vite build passed with output directed to a temporary directory. |
| Imported catalog | Read-only SELECT through the updated Sequelize model verified all six local Select definitions. |

The MySQL suite opts in with `SPEC_OPTIONS_FIXTURE_SOCKET` and creates its own randomly named databases. Use a disposable local MySQL socket with fixture administration privileges. It does not load application catalog credentials. Both fixture databases were dropped by test teardown and the temporary server was stopped.

## 7. Existing catalog compatibility

| Local specification | Observed result through the updated model |
|---|---|
| Pack Quantity (25) | Exactly `["1 PSC","2 PSC"]`. |
| Interface (11) | Exactly `[]`. |
| Connector Type (12) | `["3.5MM","USB"]`. |
| Capacity (7) | Ten ordered values, from 4GB to 2TB. |
| Cable Length (13) | Ten ordered values, from 0.5m to 20m. |
| Condition (22) | `["New","Used","Open Box"]`. |

All mutating checks used synthetic records. The existing investigation report, uncommitted social-preview work and untracked tools/caches were preserved.

## 8. Database migration requirements

No migration, data conversion, new index or dependency is required. Canonicalization happens on reads. Intentional replacements continue to use the existing JSON model field and existing column.

## 9. Known limitations

- Browser validation covered Chrome with a fixture transport. HTTP tests exercised the actual controllers and models in an isolated Express harness. A signed-in end-to-end Admin session against a deployed service and the complete backend test suite were outside this validation run.
- Any other client that intentionally replaces a Select list must send `expected_options`. During deployment, pair the updated editor with the updated backend. A conflict requires reopening and reconciling the latest list.
- Destructive definition edits scan stored variant attributes because legacy assignments use JSON name keys without indexed option IDs. Metadata-only edits and pure additions skip this scan. A historical key with a completely different name has no recorded relationship to the current definition. Malformed variant attributes can block a destructive edit pending record review.
- The protections cover the application's transactional model writes. Direct SQL and future write paths that bypass model hooks need equivalent coordination. Replacing a list with an identical list after intervening changes is accepted when the current ordered values still match the baseline.

## 10. Readiness for Phase B and future pricing workflow

Phase A supplies normalized, ordered definition metadata and is ready for review. Customer selector development and Admin sidebar styling remain separate approval decisions.

For SW-000166 the owner confirmed a selling price of **LKR 4,000 for each headset variant**. USB still needs its own selling-price row, payment-method prices and actual online stock through Admin. This is a commercial configuration task. Public selling-price eligibility and per-variant pricing remain in force.

**Future enhancement for consideration.** An administrator could select several variants, enter the specific price fields to apply, review each target SKU's current and proposed amounts, then confirm a transactional update. Persist and audit a separate price row for each target variant and price type/payment method. Keep subsequent edits independent. Inventory quantities and reservations would continue to be managed per variant through the existing stock workflows. The proposal creates no runtime inheritance and infers no payment prices.
