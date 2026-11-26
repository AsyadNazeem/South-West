# South West product variants, specification editing and Admin sidebar

Investigation for review · 26 November 2026 · local `south_west` import · HEAD `575179d057123df660d8bd9bd0de4847e071b23b`

## 1. Executive summary

| Issue | Finding | Severity and impact |
|---|---|---|
| Customer variant selection | The R8 headset has two active SKUs. Only the 3.5MM SKU has a selling price. The public API deliberately omits USB before Vue receives it. A separate picker defect hides both valid configuration controls on the HD11 power cable. | High for the HD11, where an in-stock configuration is unreachable. The headset needs merchandising input before USB can be sold. |
| Admin Select options | Five definitions have saved lists. The local database driver returns them as strings, the controllers pass them through, and the editor accepts only arrays. The sixth Select, Interface, actually stores JSON null. | High for catalog integrity. An empty Select form blocks ordinary saving, but retyping a partial list can replace the entire definition. |
| Admin sidebar | The navigation element explicitly requests a thin scrollbar when its content overflows. | Low, localized visual change. Keep wheel, touch and keyboard access to the full menu. |

Prioritize the Admin read/write contract and the HD11 picker defect. Treat the headset's commercial setup as a separate prerequisite. Neither changing the default variant nor removing the storefront price requirement addresses both cases.

## 2. Customer variants

### Headset evidence

Active item **166**, code **SW-000166**, public UUID **1f9e219d-defe-47d3-a102-02c1ff4c4665**, slug `r8-h01-3-5mm-usb-wired-gaming-headset`. Read-only SQL against `items`, `item_variants`, `item_variant_colors`, `item_prices`, `item_payment_prices` and `inventory_stock` found the following. Prices are LKR.

| Field | H01 3.5 | H01 USB |
|---|---|---|
| Variant ID / SKU | 182 / SWV-000166-H0135 | 206 / SWV-000166-H01USB |
| Active / default | Yes / yes | Yes / no |
| Connector Type / Interface | 3.5MM / USB/3.5MM | USB / USB |
| Model / Compatibility | H01 3.5 / ANY | H01 USB / Any |
| Wireless / Condition | false / New | false / New |
| Associated colours | 0 | 0 |
| Active selling / cash / card / Koko / Mintpay | 4,000 / 4,000 / 4,100 / 4,715 / 4,715 | No selling or payment-price rows |
| Stock | Location 3, on hand 5, reserved 0, online available 5 | No stock row, zero available |

**Observed HTTP.** On loopback port 5001, `GET /api/store/products?publicId=1f9e219d-defe-47d3-a102-02c1ff4c4665` returned 200 with item 166. `GET /api/store/products/166/variants` returned 200 with one element in `data`: ID 182, active/default true, `attributes` a JSON-encoded string containing the six 3.5MM values above, `colors: []`, `color: null`, selling and original price 4000, all four payment prices as above, `available_quantity: 5`, `in_stock: true`. There was no element for 206.

**Why USB disappears.** The public detail page uses a filtered product list and then a variant endpoint. The latter requires an active visible product, valid product images and an eligible variant. It intersects active variant IDs with active, positive, currently effective LKR selling-price rows. It then reads payment prices, sums available stock at active online locations, and optionally loads colours. A priced variant with zero stock can reach the UI as unavailable. An absent colour or payment-method row does not disqualify the SKU. The USB variant fails the selling-price check. Vue correctly finds no distinguishing choice in its one-element response. See S1–S3 below.

**Purchase and display.** The page parses string attributes once, filters inactive variants, and resolves the selected record by ID. Configuration cards are built from varying attributes and colour swatches from associations or legacy colour attributes. Existing logic ignores Model, Condition and Compatibility, among other keys. When only names differ after this exclusion, it builds named groups with empty specs, then hides the cards because no group has specs. It also suppresses swatches when there is at most one colour. On HD11 these two gates leave both fieldsets hidden. A computed presentation copy strips captions from cards, but the visibility gate reads the original groups. Selection currently resolves group/colour to the first in-stock match, resets quantity to one, and derives SKU, specifications, selling price, payment rows and available quantity from the selected record. This first-match rule cannot disambiguate duplicate combinations. The product gallery is item-level: `item_images` has `item_id` and no variant column, and the variant response has no gallery. Use the shared gallery for these records. See S3–S5.

Add-to-cart and Buy Now send item ID, selected variant ID and quantity for signed-in and guest sessions. The cart controller validates the item/variant relationship, uses online stock and keys cart lines by variant. Checkout resolves the supplied ID and rechecks stock/prices. Both pricing paths have fallback branches, so regression fixtures must distinguish item prices from both SKUs' prices. See S5–S6.

### Whole-catalog impact

Census grouped all active variant rows by item, including inactive parents, and retained counts greater than one. For each item we requested its local variant endpoint. For the 16 visible products we replayed the current Vue computed choices, visibility predicate and stock predicate against the response after the page's attribute decoding. This verifies render inputs, independently of a browser screenshot. Fourteen visible products yield configuration buttons; two yield none.

| Item code | Product | Active / returned | Distinguishing stored attributes and observed picker |
|---|---|---:|---|
| SW-000043 | Kingston DT Exoida Pendrive | 2 / 404 | Capacity and colour (64GB blue, 128GB yellow). Inactive parent. |
| SW-000057 | LDNIO Type-C USB Cable 1M / 2M | 2 / 2 | Length and Model. Two length buttons. |
| SW-000058 | LDNIO Micro USB Cable 1M / 2M | 2 / 2 | Length and Model. Two length buttons. |
| SW-000059 | LDNIO Lightning USB Cable 1M / 2M | 2 / 2 | Length and Model. Two length buttons. |
| SW-000064 | 4GB DDR4 LAPTOP RAM (2666 &#124; 3200) | 2 / 2 | RAM Speed. Both buttons, no colours. |
| SW-000065 | 4GB DDR4 DESKTOP RAM (2666 &#124; 3200) | 2 / 2 | RAM Speed. Both buttons, no colours. |
| SW-000066 | 8GB DDR3/DDR4/DDR5 LAPTOP RAM | 4 / 4 | RAM Type and RAM Speed. Four configurations. |
| SW-000067 | 8GB DDR3/DDR4/DDR5 DESKTOP RAM | 4 / 4 | RAM Type and RAM Speed. Four configurations. |
| SW-000068 | 16GB DDR4/DDR5 LAPTOP RAM | 3 / 3 | RAM Type and RAM Speed. Three configurations. |
| SW-000069 | 16GB DDR4/DDR5 DESKTOP RAM | 3 / 3 | RAM Type and RAM Speed. Three configurations. |
| SW-000138 | LDNIO Type-C to Type-C USB Cable 1M / 2M | 2 / 2 | Length and Model, white vs no colour. Both lengths selectable. |
| SW-000139 | LDNIO Type-C to Lightning USB Cable 1M / 2M | 2 / 2 | Length, Wattage and Model. Two length/wattage buttons. |
| **SW-000166** | **R8 H01 3.5mm/USB Wired Gaming Headset** | **2 / 1** | **Connector Type, Interface and Model. USB has no selling price.** |
| SW-000176 | R8 4K Ultra HD High Speed HDMI to HDMI Cable | 6 / 6 | Cable Length and Model. Six length buttons. |
| SW-000177 | R8 USB 2.0 A to B High Speed Printer Cable | 2 / 2 | Cable Length. Two buttons. |
| SW-000178 | R8 CAT6 RJ45 High Speed Ethernet LAN Network Cable | 4 / 4 | Cable Length. Four buttons. |
| **SW-000179** | **R8 HD11 3-Pin AC Power Cable for Desktop PC and Monitor** | **2 / 2** | **Compatibility LAPTOP vs DESKTOP. IDs 204 and 205 are in stock, both black. Named fallback cards exist but are hidden.** |

### SEO comparison

Verified `d88435366f6615a3d2cf116474537523f015a633` is HEAD's immediate parent. The variant endpoint, eligibility helper and child selector have identical source at the two revisions. The ProductDetails diff retains the grouping, ignored keys and template gates. Parent lines 1405–1417 used active default → first in stock → first active; HEAD calls the shared helper with the same precedence. The default is chosen before generating Product structured data, also on the static path. The snapshot generator imports the same helper. Both failure mechanisms therefore predate SEO in code. Historical inventory and historical browser observations are unavailable. See S3–S5 and S7.

### Recommended design

1. Keep eligibility authoritative on the server. For the headset, the catalog owner must supply a valid USB selling price, applicable payment prices and real online stock through existing workflows before both connectors can be purchased. Never copy prices or inventory from 182. If showing unpriced configurations for discovery is a business requirement, that requires a separate public display contract and a disabled purchase state.
2. Extract choice construction into a pure Customer utility. Start with returned active SKUs, normalize attribute keys and values for comparison while retaining original display labels, units and IDs. Remove constants. Existing type links provide applicability, required status and order, but no customer-selector flag. Select type alone misses numeric speeds, text Compatibility, Model and other valid distinctions. Predefined lists describe permitted input values, not the combinations available for sale.
3. Prefer varying, populated configured Select fields whose saved options match actual values, followed by other varying configured fields in stable order. Within each colour context, add another field only when it separates still-indistinguishable SKUs. For the headset Connector Type has configured options while Interface has none, so Connector Type can distinguish both without a redundant Model or Interface control. Where more than one minimal dimension set is possible, this ordering is a proposed display convention. Carry narrowly scoped public definition metadata (name, type, order and option match or ordered values) with the detail response if needed; keep the existing variant array contract compatible.
4. Render only real combinations, either as the existing configuration buttons or as dependent options. Preserve combined-colour swatches, selected colour when valid, stock labels, and keyboard/pressed states. Represent missing values explicitly when they distinguish SKUs. Use a variant name and then SKU as a secondary choice when combinations collide. Allow a real no-colour SKU alongside coloured ones. Every returned in-stock ID must be reachable. Resolve a unique ID before enabling purchase; derive the selected group and colour from it to avoid stale swatches. Disable priced but unavailable choices, keep them visible, and reset quantity after a switch. Keep legacy attributes readable even if their definition has since changed.
5. Keep initial default selection, canonical route, metadata, JSON-LD and snapshot generation on their existing path. Interactive choice changes update transaction/display state on that product URL. Use variant media only when an actual association is available, otherwise use the item gallery. Do not infer images from names or colours.

## 3. Admin predefined specification values

### Storage and observed retrieval

`item_specifications.options` is physically **LONGTEXT NOT NULL** in local MySQL 9.4.0. The Sequelize model and original migration declare JSON. `JSON_TYPE(options)` reports ARRAY on five Select rows and JSON NULL on Interface. The latter stores the four-character JSON literal `null`. The database calls the reported “Package Qty” specification **Pack Quantity**.

| Definition (ID) | Saved options, in order | Variant rows containing this attribute key |
|---|---|---:|
| Capacity (7) | 4GB, 8GB, 16GB, 32GB, 64GB, 128GB, 256GB, 512GB, 1TB, 2TB | 29 |
| Interface (11) | JSON null | 42 |
| Connector Type (12) | 3.5MM, USB | 75 |
| Cable Length (13) | 0.5m, 1m, 1.5m, 2m, 3m, 4m, 5m, 10m, 15m, 20m | 24 |
| Condition (22) | New, Used, Open Box | 148 |
| Pack Quantity (25) | 1 PSC, 2 PSC | 0 |

`item_type_specifications` joins types to definitions by ID and carries required/order fields. `item_specification_values` stores an item's actual scalar value with item ID and specification ID. There are zero rows referencing any of these six Select definitions in that assignment table. Variant assignments are independent JSON attributes keyed by definition **name**, with literal values. The counts above measure key presence across all variants, including legacy records; they do not imply each literal belongs to today's option list. For example, the headset contains Interface values with no predefined Interface list. No option ID exists to cascade a rename. See S8–S10.

**HTTP versus controller evidence.** Local anonymous GETs on `/api/item-specifications` and `/api/item-specifications/25` require authentication (detail returned 401). A separate local read-only invocation of the actual list and detail handlers with the real Sequelize models returned status 200 for each. The list returned all six Select definitions with string-valued options. The detail handler returned `{"id":25,"name":"Pack Quantity","options":"[\"1 PSC\", \"2 PSC\"]"}` (selected fields). The same `options` field is selected and sent inside `data`; there is no rename or dropped association. This confirms the serializer/form mismatch without performing an authenticated HTTP write. See S8–S9.

**Form and update behavior.** Edit is a route from the list to a dedicated page. On mount it fetches the ID, replaces the form and joins options with newlines only if already an array. Every populated Select in this import therefore initializes blank. The list watcher only reloads filters; no edit watcher or modal reset explains it. A Select textarea edits one value per line. Submit trims and deduplicates in insertion order, blocks an empty Select, then always sends options on PUT or POST. Cancel navigates back without a write. A partially re-entered list overwrites saved choices. Changing away from Select sends an empty list. Direct PUT distinguishes omission (preserved) from an explicit array including [] (replaced). The API validates string lengths and count, accepts empty lists, and locks the definition but does not check usage before updating. POST trims/deduplicates, initializes an empty list for other types, and returns the reloaded model. Its audit mapper also converts string options to []. See S8–S10.

**Recommended fix.** Normalize once at the model/read boundary so list, detail, create/update replies, item-type consumers and audit snapshots see ordered string arrays on native JSON and imported text schemas. Distinguish legacy null from malformed data. Show an actionable read error and prevent an option replacement if format is unrecognized; never silently turn corruption into a saveable empty list. The variant editor already understands arrays and stringified lists, but its newline fallback can turn the literal null into a dropdown option. Handle documented legacy newline lists explicitly. Preserve existing literals and order on read. Maintain an original copy in the editor and omit options on unrelated edits. Permit metadata-only edits on legacy empty Selects. Require a valid nonempty list on new Selects and deliberate list replacements. Define an explicit transition policy for changing a Select with saved options or assignments to a different type.

For removal or rename, compare the normalized old and new lists server-side, with an optimistic version check on intentional edits. In the same transaction, reject removal of a referenced literal with a conflict and a clear field message. Check item values by specification ID and variant attributes by current/legacy matching name, including inactive records, handling case/space ambiguity conservatively. Block unsafe definition renames/type conversions that strand name-keyed attributes. Preserve pre-existing free-text values, even when absent from the options. For concurrent updates, have assignment writers (including bulk import) coordinate on the same definition locks in stable order and validate newly assigned options after obtaining them. Limit validation to changed assignments so old data remains editable. Allow adding, reordering, renaming or removing unused values under this policy. No automatic rewriting, deletion or reconstruction of assignments from the dropdown.

## 4. Admin sidebar

`AdminLayout.vue` owns collapsed/mobile state and the mobile overlay/body scroll lock. `Sidebar.vue` renders the brand, navigation groups, child links and separate Logout footer. Its navigation is an inline loop over permission-filtered menu definitions. One `openMenu` key controls the accordion. The scroll owner is `nav.sidebar-nav`, a shrinkable flex child with `min-height: 0`, existing padding, vertical auto overflow, horizontal clipping and explicit `scrollbar-width: thin`. Expanding Products increases the nav's scroll height past its client height. Project styling is component-scoped CSS. See S11.

In the existing scoped block replace the thin declaration and add the older WebKit/Blink fallback. Keep the current flex sizing, overflow declarations, focusable links, footer and breakpoints.

```css
.sidebar-nav {
  scrollbar-width: none;
}

.sidebar-nav::-webkit-scrollbar {
  display: none;
}
```

Modern Chrome, Chromium Edge, Firefox and Safari support the standard property. Older WebKit/Blink can use the pseudo-element; Firefox uses the standard declaration. A legacy Microsoft-specific property is unnecessary for Chromium Edge. The standard value keeps native scrolling available. Verify actual keyboard focus traversal and page/arrow scrolling in a short viewport; if direct keyboard scrolling needs a focus target, add a labelled, visibly focusable nav in this component. Browser support was checked against documentation, not four installed browser sessions. [MDN scrollbar-width and accessibility guidance](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/scrollbar-width)

## 5. Source references

Paths and line anchors refer to the investigated checkout unless marked parent.

| Ref | Files and entry points |
|---|---|
| S1 | `Backend/src/app.js:234`; `Backend/src/routes/storeProductRoutes.js:21–25`; `Backend/src/controllers/storeProductController.js:54,259,489,599,685` (list/detail lookup, item specifications, price, stock, images). |
| S2 | `Backend/src/utils/customerProductEligibility.js:7–42` (positive effective price and image gates); `Backend/src/controllers/storeProductController.js:960–1022,1024–1084,1116–1218` (getStoreProductVariants, payment prices, online stock, optional colour join and payload). |
| S3 | `Frontend/Customer/src/pages/ProductDetails.vue:307–320,530–640,688–918,921–1018,1533–1606,2159–2170` (fetch, normalization, computed choices, colour and name handling, render gate); `Frontend/Customer/src/components/VariantSelector.vue:21–56,68–101` (availability, fieldsets and events). Picker logic lives in the page and child component. |
| S4 | `Frontend/Customer/src/pages/ProductDetails.vue:1068–1203,1244–1280,1424–1448,1481–1485,1945,2253,2294,2345` (selected SKU, payment prices, selling/stock, gallery, quantity and static purchase guard); `Backend/src/models/ItemImage.js:22–60` (item media). |
| S5 | `Frontend/Customer/src/pages/ProductDetails.vue:1716–1777,1809–1896` (quantity validation, authenticated and guest cart/Buy Now). |
| S6 | `Backend/src/controllers/customerCartController.js:78–153,481–605`; `Backend/src/controllers/customerCheckoutController.js:241–346,371–477,759–853,894–925`; `Backend/src/controllers/guestCheckoutController.js:124–219,284–301,351–415` (variant identity, pricing, stock and session items). |
| S7 | `Frontend/Customer/src/utils/productOffer.js:1–20`; `Frontend/Customer/src/pages/ProductDetails.vue:1557–1564,1616–1628,1673–1682`; `Frontend/Customer/scripts/generate-sitemap.mjs:6,313`; `Frontend/Customer/tests/productOffer.test.mjs:24–91`. Parent `ProductDetails.vue:1405`, chooseDefaultVariant. |
| S8 | `Backend/src/models/ItemSpecification.js:8–17,61–65`; `Backend/src/migrations/20261029120000-add-options-to-item-specifications.js:4–9`; `Backend/src/models/ItemTypeSpecification.js:29–49`; `Backend/src/models/ItemSpecificationValue.js` (item/specification/value fields); `Backend/src/routes/itemSpecificationRoutes.js:17–46` and `Backend/src/app.js:166` (protected routes). |
| S9 | `Backend/src/controllers/itemSpecificationController.js:44–52,119–131,146–177,188–212,236–246,305–332,374–403,447–482` (audit mapping, retrieval, validation and writes). `Frontend/Admin/src/pages/products/ProductSpecification.vue:67,315`; `Frontend/Admin/src/pages/products/CreateSpecification.vue:33–69,78–129,157–174,321–335,448` (edit route, hydration, submit, cancel). |
| S10 | `Frontend/Admin/src/pages/products/CreateItemVariants.vue:104–162,974` (option parsing, name-keyed assignments and dropdown); `Backend/src/controllers/itemTypeSpecificationController.js:495` (options on type lookup); `Backend/src/controllers/itemSpecificationValueController.js:55–63,393,522,689` (literal text validation and writes); `Backend/src/controllers/itemVariantController.js:107–113,385,680,824` and `Backend/src/services/bulkProductImportService.js:204` (variant assignment writers). |
| S11 | `Frontend/Admin/src/components/layout/AdminLayout.vue:7–24,38–54`; `Frontend/Admin/src/components/layout/Sidebar.vue:54–68,146–179,261–327,361,530–540,719,827,929,971` (menu construction, state, nav/footer markup, scoped and responsive rules). |

## 6. Proposed implementation plan

| Phase | Work and completion gate |
|---|---|
| A · Specification editing | Normalize retrieval, protect metadata-only PUTs, implement referenced-value/type/name policies, and exercise all writers in isolated fixtures. Confirm authenticated list/detail and save/reopen on both storage representations. |
| B · Generic selection | Preserve commercial eligibility. Expose minimal definition metadata where required, extract grouping/resolution logic, make HD11 and ambiguous/missing combinations selectable, and bind all purchase/display state to the resolved SKU. Request real commercial inputs separately for USB. |
| C · Sidebar | Apply the scoped CSS to the existing nav. Exercise short desktop and mobile layouts, keyboard navigation and the Logout footer. |
| D · Combined validation | Run isolated controller, API, component and browser tests, then compare pre/post SEO snapshots and representative catalog render inputs. Review data integrity and per-ID purchase assertions before release approval. |

A should precede B's use of option metadata. B's reachability fix and C can be developed independently. Commercial data entry is outside these code changes. B can be validated using two fully configured headset fixtures while live merchandising is pending.

## 7. Expected file changes after approval

| Files | Expected change and impact |
|---|---|
| `Backend/src/models/ItemSpecification.js`, `Backend/src/controllers/itemSpecificationController.js` | Canonical option reads and response/audit representation, validation, guarded updates and conflict handling. |
| `Backend/src/services/specificationOptionService.js` (proposed new), `Backend/src/controllers/itemSpecificationValueController.js`, `Backend/src/controllers/itemVariantController.js`, `Backend/src/services/bulkProductImportService.js` | Share usage checks, lock order and changed-assignment validation across ordinary, bulk and import writes. |
| `Frontend/Admin/src/pages/products/CreateSpecification.vue`, `Frontend/Admin/src/pages/products/CreateItemVariants.vue` | Hydrate ordered options, track intentional edits, show conflicts, handle null and legacy values consistently. |
| `Backend/src/controllers/storeProductController.js` | Include public type-specification hints for deterministic customer labels and ordering while preserving eligibility and existing response fields. |
| `Frontend/Customer/src/utils/variantSelection.js` (proposed new), `Frontend/Customer/src/pages/ProductDetails.vue`, `Frontend/Customer/src/components/VariantSelector.vue` | Build real SKU choices, expose unique fallback choices, wire selection/availability and accessible labels; replace length-specific cart confirmation text with the selected configuration. |
| `Frontend/Admin/src/components/layout/Sidebar.vue` | Scope scrollbar styling and any verified focus correction to the nav element. |
| `Backend/src/tests/itemSpecificationOptions.test.js`, `Backend/src/tests/storeProductVariants.test.js`, `Frontend/Customer/tests/variantSelection.test.mjs` (proposed new); `Backend/src/tests/customerCheckoutController.variant.test.js` | Add contract, integrity, SKU reachability and transaction identity fixtures. Reuse the existing default-offer tests and perform the browser cases in section 8. |

No database migration is required for this plan. Both native JSON and imported text can be read safely. An explicit per-type merchandising flag would require a separate schema/design decision only if the inferred label/order proves insufficient. No new dependency is needed.

## 8. Regression testing strategy

Run mutating tests against disposable fixtures, with payment processing, outbound notifications and email disabled or mocked.

- **Admin unit and API.** Exercise native arrays, JSON-encoded arrays, null, legacy lists and malformed content. Create a Select; GET list/detail; edit an unrelated field with options omitted; add, reorder, rename and remove unused options; cancel dirty edits; reopen after each save and compare exact order. Cover non-Select fields, empty/new Select, legacy empty Interface, type conversion and stale simultaneous edits. Explicit [] and omission must take distinct paths. Validate response types and audit values. Attempt to remove a value referenced only by an item, only by an inactive variant, and concurrently by an import. Assert conflict, full rollback and identical before/after assignments.
- **Customer utility/component.** Cover single SKU, differing Connector Type alone, RAM type/speed, Size, Capacity, Pack Quantity, Model-only, Compatibility-only and arbitrary future names. Include identical values, case/space normalization, missing keys, duplicate names/combinations, combined colours, one colour plus an uncoloured SKU, and zero stock. Traverse every enabled option and assert unique IDs, correct active state, inventory and accessible names. Unavailable choices must never switch to an unrelated SKU.
- **Store and checkout integration.** Exercise inactive, expired, future, zero and missing selling prices, eligible zero stock, reserved inventory and colourless variants. With distinct prices/stocks on two eligible headset variants, switch each way and assert selling, cash, card, Koko and Mintpay values, specifications, gallery fallback, quantity reset/cap and purchase availability. Capture signed-in cart, guest new/existing cart, signed-in Buy Now and guest Buy Now payloads. Assert item/variant/quantity, two distinct cart lines, retained ID and method-specific total on checkout review, server rejection for mismatched IDs or depleted stock. Stop before payment authorization.
- **SEO regression.** Compare the same product URL, title, canonical, description, Product/Offer JSON-LD, currency, initial offer price/availability and generated snapshot before/after. Cover default out of stock, missing default, route changes and static fallback with purchasing disabled. Switching configurations must preserve the product canonical and initial default-offer contract.
- **Sidebar browsers.** In Chrome, Safari, Firefox and Edge, enable always-visible OS scrollbars where supported. Test collapsed rail, all groups closed, Products open, successive groups, short desktop viewport and mobile drawer. The accordion supports one open group; test simultaneous expanded sections using a tall-content fixture, without changing the production interaction. Scroll to last and first links with wheel/trackpad/touch as applicable, tab and Shift-Tab in both directions, exercise focused keyboard scrolling, check visible focus and Logout/Cancel. Compare sidebar width, header/footer position, link alignment and scrollWidth/clientWidth across expansion. Check active-route styling, restricted roles, and an overflowing non-sidebar region.

## 9. Risk assessment

| Risk | Control |
|---|---|
| Selling or charging for an unpriced variant | Keep public price eligibility and server validation; supply authorized catalog data separately. |
| Incorrect stock or cart/checkout SKU | Resolve exactly one eligible variant, reset quantity, retain per-SKU stock/price checks and test both guest and signed-in flows. |
| Hidden SKU or broken swatch | Retain colour associations and combined colours, handle missing/duplicate combinations, test complete reachability. |
| Erased options or stranded historical assignments | Normalize reads, distinguish omission from removal, check all references transactionally, reject conflicting edits and preserve legacy literals. |
| Misleading static offer or duplicate product URL | Keep shared default helper, static purchase guard and canonical route, compare generated snapshots and live initial metadata. |
| Inaccessible Admin navigation | Limit CSS to nav, preserve flex layout and native scrolling, verify visible focus and Logout across viewport/input modes. |
| Production data or schema drift | Validate text/native JSON representations against isolated copies. The plan requires no production cleanup, migration or automatic record rewrite. |

## 10. Acceptance criteria

1. **Customer.** With both headset SKUs positively priced and stocked in a fixture, two named connector choices resolve to IDs 182 and 206 respectively with no required colour. Every enabled selection displays and sends exactly its own prices, specs, inventory and allowed quantity. With the imported commercial data, only 182 is purchasable. With HD11 data, both IDs 204 and 205 are reachable. All fourteen previously functioning product pickers retain access to every in-stock SKU. Canonical and initial live/static offer comparisons pass.
2. **Admin.** Opening Pack Quantity shows exactly two lines in stored order. All five populated Selects round-trip, Interface displays zero options, and cancelling or saving metadata alone preserves stored choices and assignment values. Intentional unused-option edits persist in order after reopen. Referenced removals, unsafe conversions and stale replacements return a clear conflict without partial writes. Non-Select editing still works.
3. **Sidebar.** No visible nav scrollbar in the four target browsers on overflow. First and last permitted links and Logout remain reachable, focused links are visible, the sidebar width and footer position stay stable, and expanding Products causes no horizontal overflow or link shift. Other scroll containers retain their usual styling.

## 11. Investigation limits and working tree

The evidence is from the imported database, loopback HTTP GETs, direct read-only local controller calls, current selector computations and Git history. No authenticated Admin HTTP response was captured. Create/update, cancel/reopen, browser gestures and payment flows were assessed from source and proposed as validation cases. Four-browser rendering, production runtime behavior and historical catalog state remain unverified. No historical price or correct future stock for USB can be inferred from this import.

At intake Git already showed modifications to `Backend/src/controllers/socialPreviewController.js` and `Backend/src/tests/socialPreviewController.test.js`, and untracked `Frontend/Admin/tools/`, `Frontend/Customer/tools/__pycache__/` and `Frontend/Customer/tools/tests/__pycache__/`. The investigation added only this report. All implementation phases await review and approval.
