# Phase B implementation report — Customer variant selection and guest checkout pricing

26 November 2026 · Local working tree · Ready for review

## 1. Executive summary

All **43 eligible, in-stock SKUs across 16 visible multi-variant catalog items** were reachable in the built Customer page using captured local catalog responses. On the HD11 cable, LAPTOP selects ID 204 and DESKTOP selects ID 205. The imported H01 headset still exposes only ID 182. Both connector buttons worked in an isolated fixture with two commercially configured headset SKUs.

The separately approved guest checkout correction applies the selected SKU's configured payment-method price to the guest quote, campaign discount, order line and unpaid payment amount. The review page now uses the server's quoted lines. Validation used fixture transactions and intercepted requests.

## 2. Root cause resolution

The former picker excluded Compatibility and Model, grouped by variant name when no allowed attribute varied, then hid those fallback cards because their spec list was empty. Two eligible HD11 variants and a single common black swatch consequently produced no control. The new page shows configuration choices whenever more than one real group exists, including identity-based fallback groups.

The H01 USB omission has a different cause. Variant 206 has no current selling-price, payment-price or stock record. The owner confirmed a selling price of LKR 4,000 for each connector. The missing records remain a merchandising task in Admin. The positive-price eligibility rule is intact.

Guest review previously calculated line prices from the normal selling price for all methods. The checkout summary could also display the cart's cached line totals after a new quote arrived. Both the method-specific backend calculation and the displayed quote lines have been corrected.

## 3. Implemented architecture

- The public variants endpoint retains its existing `data` array. Its additive `preferred_attributes` field contains ordered names of active, type-linked Select specifications with saved options. The endpoint reads Phase A's normalized model getter and performs the metadata lookup only for a multi-SKU response with an item type. Buyers receive no option-definition IDs, audit fields or unused option values.
- The Customer utility decodes object or string attributes and compares keys and values with normalized case and whitespace. Original labels and values supply the captions. It partitions the returned SKUs first by preferred fields and then by further attributes that split a remaining group. Text, numbers and Booleans participate. Constants and fields redundant with earlier choices produce no extra control. Missing values have an explicit display label.
- Colour-only groups keep their swatches, including combined colours. An uncoloured SKU can appear alongside coloured SKUs. Each group contains only real combinations. When multiple SKUs have the same configuration and overlapping swatches, variant names and then SKUs distinguish the individual cards. Stock governs button availability; a disabled swatch cannot select another SKU.
- The selected ID determines the group, specifications, SKU, selling price, payment rows, online availability and purchase payload. A configuration switch resets quantity to one. A selling price distinct from the cash price has its own labelled amount. The shared item gallery stays in place when switching variants. A single eligible SKU has no picker.
- Checkout looks up an active LKR method-price row for the exact item and variant. Guest prepaid quotes/orders reject a missing or invalid method price. Guest cash retains its existing selling-price fallback when a cash record is absent. Signed-in checkout retains its existing item-level and cash fallback policy. No path introduced by this change looks up a sibling or default SKU's price.

## 4. Modified files and source references

| File | Entry points |
|---|---|
| `Frontend/Customer/src/utils/variantSelection.js` (new) | Lines 4, 11, 74, 152 and 162 normalize attributes, extract colours, build real configuration groups, map swatches and resolve an available option. |
| `Frontend/Customer/src/pages/ProductDetails.vue` | Lines 558–602 bind the picker and selected SKU; 654–772 derive prices, quantity and stock; 988–998 initialize/reset; 1094–1118 load metadata and set the initial offer; 1207 and 1292 handle cart and Buy Now; 1646 onward renders the picker and payment amounts. |
| `Frontend/Customer/src/components/VariantSelector.vue` | Lines 19–55 and 76–103 retain the existing fieldsets, pressed/disabled states and swatch events, with an explicit accessible name for the no-colour option. |
| `Backend/src/controllers/storeProductController.js` | Lines 977 and 1215–1238 select the item type and emit public preference names after the existing eligibility and price/stock work. |
| `Backend/src/services/checkoutPaymentPrice.js` (new) | Line 5 implements the shared transaction-aware, item/variant/method/currency lookup. |
| `Backend/src/controllers/guestCheckoutController.js` | Lines 257, 395–408, 434, 1000 and 1551 apply the requested method during quote and order validation, before calculating discounts and line totals. Ordinary cart reads/edits continue to use selling prices. |
| `Backend/src/controllers/customerCheckoutController.js` | Lines 435–439 use the shared lookup with existing signed-in fallbacks. Line 829 includes the resolved variant name in quote lines. |
| `Frontend/Customer/src/pages/Checkout.vue` | Lines 217, 492 and 1545–1560 display quoted lines for cart/Buy Now and send the currently selected method with each quote. |
| Tests | New `Frontend/Customer/tests/variantSelection.test.mjs`, `Frontend/Customer/tests/variantSelection-browser.test.mjs` and `Backend/src/tests/variantCartReview.test.js`. Extended `Backend/src/tests/storeProductStockVisibility.test.js` with a multi-SKU response-contract test. |

## 5. Before and after

| Scenario | Before | After |
|---|---|---|
| Compatibility-only HD11 | Neither configuration card displayed | DESKTOP and LAPTOP buttons, each resolving to its own SKU |
| H01 with imported records | Default 3.5MM offer only | Same purchasable offer and single-SKU presentation |
| Two fully configured connectors | Group labels depended on attribute exclusions and order | Configured Connector Type takes precedence over correlated Model/Interface |
| Same attributes, name and colour on different SKUs | First match could conceal another SKU | Distinct cards disambiguated by SKU |
| Mixed colour and no colour | An empty colour had no explicit swatch | Both options have reachable, labelled controls where a swatch is needed |
| Guest changes payment method | Review could show the selling price or stale cart lines | Review displays the selected method's quoted lines and totals |

## 6. H01 headset fixture validation

The two-connector **synthetic browser fixture** used IDs 182 and 206, both priced at LKR 4,000, with five and one available units respectively. Each had independent cash, card, Koko and Mintpay entries. Selecting USB changed the name/SKU, showed one available unit, reset quantity from two to one, disabled increment, and sent variant 206. Its test amounts were selling 4,000, cash 3,990, card 4,200, Koko 4,815 and Mintpay 4,765. These are deliberate fixture values, not proposed catalog payment prices.

A second scenario used a distinct selling price of 4,400, an unavailable black default and an in-stock uncoloured alternative. Chrome verified the unavailable control and purchase buttons were disabled on the default; selecting the uncoloured SKU enabled purchase and displayed 4,400. Returning to a single eligible SKU suppressed the picker.

## 7. Actual HD11 result

Local `GET /api/store/products/179/variants` returned IDs 204 and 205 in stock. Replaying the captured response in the updated build produced two buttons under Compatibility. Browser clicks reached both displayed SKUs. The common black colour required no second decision.

## 8. Complete imported catalog regression

Read-only queries identified all 17 parents with multiple active variants. For each, the updated local controller and the running local HTTP endpoint agreed on status and variant data. Chrome then loaded the updated controller responses in an isolated build, traversed the enabled configuration buttons and swatches, and compared the displayed SKUs with the returned in-stock set. All returned SKUs in this sample were in stock. Unavailable cases were exercised separately with fixtures.

| Item | Product | Active in DB / reachable in browser | Result |
|---|---|---:|---|
| SW-000043 | Kingston DT Exoida Pendrive | 2 / — | Inactive parent, HTTP 404 |
| SW-000057 | LDNIO Type-C USB Cable 1M / 2M | 2 / 2 | Both lengths |
| SW-000058 | LDNIO Micro USB Cable 1M / 2M | 2 / 2 | Both lengths |
| SW-000059 | LDNIO Lightning USB Cable 1M / 2M | 2 / 2 | Both lengths |
| SW-000064 | 4GB DDR4 LAPTOP RAM (2666 / 3200) | 2 / 2 | Both speeds |
| SW-000065 | 4GB DDR4 DESKTOP RAM (2666 / 3200) | 2 / 2 | Both speeds |
| SW-000066 | 8GB DDR3/DDR4/DDR5 LAPTOP RAM | 4 / 4 | All type/speed combinations |
| SW-000067 | 8GB DDR3/DDR4/DDR5 DESKTOP RAM | 4 / 4 | All type/speed combinations |
| SW-000068 | 16GB DDR4/DDR5 LAPTOP RAM | 3 / 3 | All type/speed combinations |
| SW-000069 | 16GB DDR4/DDR5 DESKTOP RAM | 3 / 3 | All type/speed combinations |
| SW-000138 | LDNIO Type-C to Type-C USB Cable 1M / 2M | 2 / 2 | Both lengths, including uncoloured SKU |
| SW-000139 | LDNIO Type-C to Lightning USB Cable 1M / 2M | 2 / 2 | Length separates the two wattage/model combinations |
| SW-000166 | R8 H01 3.5mm/USB Wired Gaming Headset | 2 / 1 | Only 182 eligible; single-SKU presentation |
| SW-000176 | R8 4K Ultra HD High Speed HDMI to HDMI Cable | 6 / 6 | 1.5, 3, 5, 10, 15 and 20 m |
| SW-000177 | R8 USB 2.0 A to B High Speed Printer Cable | 2 / 2 | 1.5 and 3 m |
| SW-000178 | R8 CAT6 RJ45 High Speed Ethernet LAN Network Cable | 4 / 4 | 2, 3, 5 and 10 m |
| SW-000179 | R8 HD11 3-Pin AC Power Cable for Desktop PC and Monitor | 2 / 2 | LAPTOP and DESKTOP |

## 9. Pricing and inventory consistency

Cart/controller fixtures used deliberately different normal selling prices (4,000 and 4,300) and stock limits (five and two) to detect fallback to the default. Both cart lines retained their own selling price. Updating SKU 206 to two succeeded, while requesting three returned 409. Quote fixtures checked cash, card, Koko and Mintpay against each SKU. Guest campaign discounts were computed from the chosen method price. The fixture guest Mintpay order recorded 4,780 × 1 and 5,080 × 2 before its 10% campaign discount; the quote, order and unpaid payment amount agreed at **LKR 13,446**. Missing prepaid pricing returned 409 on both quote and order with zero order lines created.

## 10. Cart and checkout verification

Chrome captured signed-in Add to Cart, new/existing guest cart Add to Cart, signed-in Buy Now and guest Buy Now. Each sent `{item_id:166, variant_id:206, quantity:1}` after USB selection. Controller tests independently exercised the actual signed-in and guest handlers with in-memory persistence, including distinct lines for two variants of one product, updating one line, stock rejection, and four payment-method quotes. Chrome also changed payment methods on guest checkout and verified each quoted USB line amount. Simulated order creation used stubbed payment persistence, invoice, email and notification services. No gateway, email or notification was contacted.

## 11. SEO comparison

Built the pre-change and final Customer applications using identical controlled product/variant inputs. Compared the generated sitemap, embedded static product data, title, canonical, description, Open Graph and Twitter fields and JSON-LD graphs. The corresponding static outputs and initial browser outputs matched across revisions. The initial Product Offer matched between static HTML and hydrated page at LKR 4,000. Selecting USB preserved the head, canonical and JSON-LD. A forced API failure restored the default snapshot with Add to Cart and Buy Now disabled. The existing product-metadata/navigation tests also exercised SPA navigation, refresh and fallback. The shared default-offer helper, generator and canonical URL rules were preserved.

## 12. Test results

| Validation | Outcome |
|---|---|
| Backend eligibility, store listing/pagination/stock, cart, guest/signed-in checkout and payment regression suites | **56 passed**. Includes response metadata and both new cart/review controller fixtures. |
| Customer complete suite against isolated build | **109 passed, 1 failed, 1 skipped**. The failing product-card gallery hit-target assertion (`width >= 24 && height >= 24`) reproduced in independent Chrome runs on both the pre-change and updated builds. The skipped test requires the optional Apache HTTP/TLS fixture. |
| Focused Customer selection tests | Unit coverage for typed and encoded attributes, missing/duplicate combinations, identity fallback, colour-only, mixed/combined colours, unavailable options and inactive rows. Both focused Chrome tests passed, including a final rerun with expanded stock/single-SKU assertions. |
| Actual catalog and SEO replay | 43/43 eligible SKUs reachable, including all 40 on the fourteen previously functioning pickers. Baseline/updated SEO comparison passed. |

## 13. Customer production build

The full `npm run build` pipeline passed in an isolated temporary copy: production assets, SSR information renderer, seven static information pages, product snapshot, sitemap and homepage structured data. The build used an intercepted fixture catalog and generated one product snapshot and 13 sitemap URLs. Build outputs stayed outside the working tree.

## 14. Database migrations

None required. Selection uses existing attributes, colour associations and Phase A's option normalization. Checkout uses existing per-variant payment-price rows. No imported catalog writes or new dependencies were required.

## 15. Limitations and unresolved risks

- USB 206 will become reachable on the real H01 page once it meets storefront eligibility; a purchase also needs actual online stock. Payment-method amounts remain commercial inputs.
- Catalog replay covered the imported snapshot. Colour-only, combined-colour, duplicate-identity and out-of-stock edge cases required synthetic records. Browser validation used Chrome; the HTTP/TLS serving fixture was unavailable.
- The gallery hit-target failure on the listing card remains open. Its assertion was retained. It also fails on the unchanged baseline and is outside this product-detail and checkout change.
- The public contract adds preference names. An older server still permits generic selection but may choose a different distinguishing label. Legacy static snapshots may lack those hints. Static purchasing remains disabled.
- Guest prepaid checkout now surfaces missing method-price data as a conflict. Guest COD retains its established fallback. The Customer checkout UI continues to allow prepaid price previews with its existing restrictions on order submission. Actual payments and production were outside validation.

## 16. Git working tree

The Phase B changes are the files in section 4 plus this report. At intake the Phase A model/controller/Admin edits, Phase A service/tests and both earlier reports were already present. The social-preview source/test edits, untracked Admin tools and Customer Python caches were also present. They were preserved. No commit, push or deployment occurred.

## 17. Readiness for Phase C

Phase B is ready for implementation review with the baseline gallery issue recorded separately. Phase C remains an independent Admin sidebar change awaiting approval. The optional shared variant-pricing workflow remains a proposal.
