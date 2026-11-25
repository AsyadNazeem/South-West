# Phase 2B · Unified Customer product metadata

**Implemented and verified locally, 25 November 2026.** In a replay of 143 current public records, the original generators disagreed on 143 descriptions. The isolated release candidate produced zero build/browser metadata mismatches across those same 143 products. All 11 pilot products also passed direct-load, post-load, refresh and related-product navigation checks. This is a candidate for owner review. The production storefront still runs its previously deployed release.

## Scope and implementation

The build previously favored selected product facts, a shopping template or a cut-off body excerpt. The browser stripped HTML and truncated the body at 300 characters. Even when both used the same product record, hydration could replace a concise head with an incomplete list of specifications. Build and browser also maintained separate image selection. The captured products all had absolute primary image URLs; the code-level difference matters for missing or secondary images.

Both entry points now call the pure productMetadata function in the existing Customer productSeo utility. It uses the catalog name, adds the catalog brand where absent, removes repeated leading brand tokens, normalizes whitespace and retains the full model name. It derives the slashless path from the existing UUID/slug function. Build and Vue use the resulting title, description, OG product type, primary image and canonical identity to populate their existing HTML/DOM writers, including Twitter title, description and image. The browser continues to determine robots from the current route query.

The snippet selector decodes HTML entities, separates blocks, favors labeled buying facts, and considers short compatible-device or technical statements. It preserves complete values and qualifiers. A named opening sentence can stand alone. A name-and-store fallback remains available for incomplete records. No price, stock, warranty, review or shipping fields are inserted into snippets. Tests exercise excluded commercial and uncertain language; editorial review is still needed when catalog copy itself is inaccurate. The primary-image order follows the static generator: product image, image_url, primary gallery entry or first gallery entry, then the storefront share image. Relative URLs resolve against the storefront origin; absolute HTTP(S) URLs retain their host. The schema and gallery retain their own existing image handling.

## Fresh catalog results

The listing completed at **14:28:19 UTC on 25 November 2026**. The accompanying Phase 2A baseline gives the request counts, search evidence, model and variant coverage, and data limitations. Old values below were calculated using the pre-edit local functions and this same captured catalog, including the two earbuds added after the original release. They are not transcriptions from live HTML.

| Metric, 143 products | Before | Shared candidate |
|---|---:|---:|
| Build vs. browser description differences | 143 | 0 |
| Duplicate titles / descriptions (excess identical strings) | 0 / 0 in both paths | 0 / 0 |
| Build name-only commercial fallback | 32 including brand-enriched names (29 literal item-name matches) | 0 |
| Titles longer than 60 characters | 55 | 62 |
| Descriptions longer than 160 characters | 0 build / 141 browser | 0 |
| Shortest / median / longest description | 51 / 121 / 154 build; 149 / 300 / 300 browser | 48 / 141 / 160 |
| Product canonical / primary OG image changes vs. old build | — | 0 / 0 |

99 new descriptions are between 120 and 160 characters inclusive. The shorter descriptions use the available evidence. Thirty-five titles changed: 34 gained the missing brand and one normalized narrow nonbreaking whitespace. Brand enrichment increased the count above 60 characters by seven. Keep the model intact and review long names individually. The three generic labels from the older audit and this one must be interpreted using their definitions: the historical 25 literally matched a 123-product sample; the current 29 literally match, and the current 32 include enriched names.

## Pilot comparisons

The following entries preserve each computed string, including endings cut short by the **old** browser or build logic. Each current pilot canonical matched its previous absolute apex URL. For every entry, the initial HTML, hydrated/SPA head and direct refresh supplied the same primary OG image as the captured record. Each entry includes the actual canonical and OG image for reference. Attribute notes describe evidence in the public catalog rather than independent hardware or commercial verification.

### LDNIO Lightning USB Cable 1M / 2M

- **Public UUID** — `ee0d3371-187f-41a5-a640-c5444bcbe6c2`
- **Old title** — `LDNIO Lightning USB Cable 1M / 2M | South West Sri Lanka`
- **New title** — `LDNIO Lightning USB Cable 1M / 2M | South West Sri Lanka`
- **Old build description** — `Brand: LDNIO Cable Type: USB to Lightning Available Lengths: 1 Metre / 2 Metres Designed for compatible Apple Lightning devices. Supp...`
- **Old browser description** — `Brand: LDNIO Cable Type: USB to Lightning Available Lengths: 1 Metre / 2 Metres Designed for compatible Apple Lightning devices. Supports device charging. Supports data transmission on compatible devices. Suitable for iPhones, iPads and other Lightning-compatible devices. Convenient for home, office`
- **Shared description (152 characters)** — `LDNIO Lightning USB Cable 1M / 2M. Cable Type: USB to Lightning. Available Lengths: 1 Metre / 2 Metres. Designed for compatible Apple Lightning devices.`
- **Canonical** — `https://southwest.lk/product/ldnio-lightning-usb-cable-1m-2m-ee0d3371-187f-41a5-a640-c5444bcbe6c2`
- **Primary OG image** — `https://api.southwest.lk/uploads/items/images/97390dfd-661c-4fb9-ba60-94956f501eb1.webp`

Cable type, available lengths and Apple Lightning compatibility replace a cut-off paragraph. Two active lengths share this URL; the snippet makes no variant-specific stock claim.

### Acer Aspire Go 15 AG15-42P-R917

- **Public UUID** — `c1dd22ae-f5a3-4da6-a5a8-bab11015c4ec`
- **Old title** — `Acer Aspire Go 15 AG15-42P-R917 | South West Sri Lanka`
- **New title** — `Acer Aspire Go 15 AG15-42P-R917 | South West Sri Lanka`
- **Old build description** — `Shop Acer Aspire Go 15 AG15-42P-R917 featuring AMD Ryzen™ 7 7730U Processor and 15.6-inch at South West Sri Lanka.`
- **Old browser description** — `Processor: AMD Ryzen™ 7 7730U Processor RAM: 16GB DDR4 Storage: 512GB PCIe NVMe SSD Display Size: 15.6-inch Display Resolution: Full HD (FHD) – verify exact panel specification Graphics: AMD Radeon™ Graphics Operating System: Windows 11 Home Keyboard: Full-size keyboard with numeric keypad Design: S`
- **Shared description (160 characters)** — `Acer Aspire Go 15 AG15-42P-R917. Processor: AMD Ryzen™ 7 7730U Processor. RAM: 16GB DDR4. Storage: 512GB PCIe NVMe SSD. Display Size: 15.6-inch. Colour: Silver.`
- **Canonical** — `https://southwest.lk/product/acer-aspire-go-15-ag15-42p-r917-c1dd22ae-f5a3-4da6-a5a8-bab11015c4ec`
- **Primary OG image** — `https://api.southwest.lk/uploads/items/images/c83bea8a-a707-4c7f-8ee2-0d3dad1a61c3.webp`

The processor, RAM, storage and screen size identify this configuration. The source flags a panel-resolution claim for verification, so the snippet omits it.

### OTN-5202 USB to HDMI Converter

- **Public UUID** — `b49b3ea8-ce13-4331-a176-2d608af7df9e`
- **Old title** — `OTN-5202 USB to HDMI Converter | South West Sri Lanka`
- **New title** — `ONTEN OTN-5202 USB to HDMI Converter | South West Sri Lanka`
- **Old build description** — `Shop ONTEN OTN-5202 USB to HDMI Converter featuring USB 3.0 to HDMI at South West Sri Lanka.`
- **Old browser description** — `Brand: ONTEN Model: OTN-5202 Product Type: USB 3.0 to HDMI Video Adapter Input Interface: USB 3.0 Type-A Output Interface: HDMI Female Maximum Resolution: 2K (as listed in product description) Cable Length: 0.2 Metres Connection: USB 3.0 to HDMI Features: USB Digital Video Output Applications: HDMI `
- **Shared description (127 characters)** — `ONTEN OTN-5202 USB to HDMI Converter. Input Interface: USB 3.0 Type-A. Output Interface: HDMI Female. Cable Length: 0.2 Metres.`
- **Canonical** — `https://southwest.lk/product/otn-5202-usb-to-hdmi-converter-b49b3ea8-ce13-4331-a176-2d608af7df9e`
- **Primary OG image** — `https://api.southwest.lk/uploads/items/images/391b9677-ca54-4dc5-8a54-e2fb4afd4b7f.webp`

Input, output and cable length distinguish the direction of conversion. Verify the precise resolution and refresh-rate combination before adding a display claim.

### R8 1610 Wired Mouse

- **Public UUID** — `2bb3b909-39ca-4682-8422-b05ff64faa41`
- **Old title** — `R8 1610 Wired Mouse | South West Sri Lanka`
- **New title** — `R8 1610 Wired Mouse | South West Sri Lanka`
- **Old build description** — `Shop R8 1610 Wired Mouse featuring USB Wired at South West Sri Lanka.`
- **Old browser description** — `Brand: R8 Model: 1610 Product Type: Wired Mouse Connection: USB Wired Interface: USB Designed for desktop computers and laptops. Convenient wired connectivity. Practical design for everyday use. Suitable for office work, browsing and general computing. Easy plug-and-play operation. Warranty: 6 Month`
- **Shared description (80 characters)** — `R8 1610 Wired Mouse. Interface: USB. Designed for desktop computers and laptops.`
- **Canonical** — `https://southwest.lk/product/r8-1610-wired-mouse-2-2bb3b909-39ca-4682-8422-b05ff64faa41`
- **Primary OG image** — `https://api.southwest.lk/uploads/items/images/50da2c8c-736b-45a7-ae08-18a739d6fc59.webp`

USB interface and supported computer types give the shopper concrete fit information. The public copy supplies few discriminating mouse specifications.

### Yesido MG67 Massage Gun for Muscle Therapy Relief

- **Public UUID** — `6a545a8b-e6f2-418a-ad67-de44a5387737`
- **Old title** — `Yesido MG67 Massage Gun for Muscle Therapy Relief | South West Sri Lanka`
- **New title** — `Yesido MG67 Massage Gun for Muscle Therapy Relief | South West Sri Lanka`
- **Old build description** — `Shop Yesido MG67 Massage Gun for Muscle Therapy Relief featuring 1200mAh at South West Sri Lanka.`
- **Old browser description** — `Model: MG67 Product Type: Portable Electric Massage Gun Motor: Brushless Motor (as specified in product artwork) Battery Capacity: 1200mAh Battery Voltage: 7.4V Maximum Power: 35W Massage Speed: Multiple adjustable intensity levels Speed Adjustment: 6-level adjustment Massage Amplitude: 6mm Massage `
- **Shared description (158 characters)** — `Yesido MG67 Massage Gun for Muscle Therapy Relief. Battery Capacity: 1200mAh. Maximum Power: 35W. Speed Adjustment: 6-level adjustment. Material: ABS plastic.`
- **Canonical** — `https://southwest.lk/product/yesido-mg67-massage-gun-for-muscle-therapy-relief-6a545a8b-e6f2-418a-ad67-de44a5387737`
- **Primary OG image** — `https://api.southwest.lk/uploads/items/images/50b7b772-3fcb-4e39-88e2-ea4363766662.webp`

Labeled capacity, power, speed adjustment and material preserve the units that the old standalone “1200mAh” feature left unexplained. No therapeutic outcome is asserted by the snippet generator.

### Anker Soundcore R50i NC True Wireless Bluetooth Earbuds

- **Public UUID** — `221db4b0-72f6-434c-97b6-fc7f85362ef2`
- **Old title** — `Anker Soundcore R50i NC True Wireless Bluetooth Earbuds | South West Sri Lanka`
- **New title** — `Anker Soundcore R50i NC True Wireless Bluetooth Earbuds | South West Sri Lanka`
- **Old build description** — `Shop Anker Soundcore R50i NC True Wireless Bluetooth Earbuds at South West Sri Lanka.`
- **Old browser description** — `True Wireless Stereo (TWS) in-ear Bluetooth earbuds. 10mm dynamic drivers with Soundcore BassUp technology. Adaptive Active Noise Cancellation (ANC) reduces environmental noise by up to 42dB. Transparency Mode allows surrounding sounds to be heard while listening. Bluetooth 5.4 wireless connectivity`
- **Shared description (148 characters)** — `Anker Soundcore R50i NC True Wireless Bluetooth Earbuds. 10mm dynamic drivers with Soundcore BassUp technology. Bluetooth 5.4 wireless connectivity.`
- **Canonical** — `https://southwest.lk/product/anker-soundcore-r50i-nc-true-wireless-bluetooth-earbuds-221db4b0-72f6-434c-97b6-fc7f85362ef2`
- **Primary OG image** — `https://api.southwest.lk/uploads/items/images/429d255f-c6be-4343-b355-1f8bee02debb.webp`

Driver size and Bluetooth version differentiate R50i from R60i. The earlier name-only snippet contained neither. Confirm all technical claims against the commercial listing before release.

### Anker Soundcore R60i NC True Wireless Earbuds

- **Public UUID** — `dd0b232d-6117-45fd-b759-e34fac440c46`
- **Old title** — `Anker Soundcore R60i NC True Wireless Earbuds | South West Sri Lanka`
- **New title** — `Anker Soundcore R60i NC True Wireless Earbuds | South West Sri Lanka`
- **Old build description** — `Shop Anker Soundcore R60i NC True Wireless Earbuds at South West Sri Lanka.`
- **Old browser description** — `True Wireless Stereo (TWS) in-ear Bluetooth earbuds. 11mm titanium-coated dynamic drivers for detailed audio reproduction. Hi-Res Audio certification for high-quality wireless audio. Supports LDAC, AAC and SBC Bluetooth audio codecs. Adaptive Active Noise Cancellation (ANC) reduces environmental noi`
- **Shared description (153 characters)** — `Anker Soundcore R60i NC True Wireless Earbuds. 11mm titanium-coated dynamic drivers for detailed audio reproduction. Bluetooth 6.1 wireless connectivity.`
- **Canonical** — `https://southwest.lk/product/anker-soundcore-r60i-nc-true-wireless-earbuds-dd0b232d-6117-45fd-b759-e34fac440c46`
- **Primary OG image** — `https://api.southwest.lk/uploads/items/images/ca142ebe-00f9-41de-a7d4-284ac198775b.webp`

The catalog calls this model “True Wireless Earbuds”. Its 11mm drivers and Bluetooth version distinguish it from R50i. Preserve the actual catalog name.

### 128GB NS100 2.5" SATA SSD

- **Public UUID** — `e63a62fc-4811-4131-b71e-6e62ec11b9b5`
- **Old title** — `128GB NS100 2.5" SATA SSD | South West Sri Lanka`
- **New title** — `Lexar 128GB NS100 2.5" SATA SSD | South West Sri Lanka`
- **Old build description** — `Shop Lexar 128GB NS100 2.5" SATA SSD featuring Up to 520MB/s and SATA III (6Gb/s) at South West Sri Lanka.`
- **Old browser description** — `• Brand: Lexar • Model: NS100 • Capacity: 128GB • Form Factor: 2.5 Inch • Interface: SATA III (6Gb/s) • Read Speed: Up to 520MB/s • Warranty: 3 Years`
- **Shared description (111 characters)** — `Lexar 128GB NS100 2.5" SATA SSD. Form Factor: 2.5 Inch. Interface: SATA III (6Gb/s). Read Speed: Up to 520MB/s.`
- **Canonical** — `https://southwest.lk/product/128gb-ns100-2-5-sata-ssd-e63a62fc-4811-4131-b71e-6e62ec11b9b5`
- **Primary OG image** — `https://api.southwest.lk/uploads/items/images/4a46f125-0482-47cc-b31a-fc376f7eb1e4.webp`

Brand, capacity, form factor, interface and qualified read speed identify the smaller SSD. No warranty claim is copied from the body.

### 256GB NS100 2.5" SATA SSD

- **Public UUID** — `42220123-c847-472a-965b-99463a7656ef`
- **Old title** — `256GB NS100 2.5" SATA SSD | South West Sri Lanka`
- **New title** — `Lexar 256GB NS100 2.5" SATA SSD | South West Sri Lanka`
- **Old build description** — `Shop Lexar 256GB NS100 2.5" SATA SSD featuring Up to 520MB/s and SATA III (6Gb/s) at South West Sri Lanka.`
- **Old browser description** — `Brand: Lexar Model: NS100 Capacity: 256GB Form Factor: 2.5 Inch Interface: SATA III (6Gb/s) Read Speed: Up to 520MB/s Warranty: 3 Years Company Warranty`
- **Shared description (111 characters)** — `Lexar 256GB NS100 2.5" SATA SSD. Form Factor: 2.5 Inch. Interface: SATA III (6Gb/s). Read Speed: Up to 520MB/s.`
- **Canonical** — `https://southwest.lk/product/256gb-ns100-2-5-sata-ssd-42220123-c847-472a-965b-99463a7656ef`
- **Primary OG image** — `https://api.southwest.lk/uploads/items/images/7e9ca1d5-65bb-4a1b-86ea-f447cbd01bb9.webp`

Capacity distinguishes this URL from the 128GB sibling. Shared interface and read speed are legitimate overlap; do not fabricate differences.

### 16GB DDR4/DDR5 DESKTOP RAM

- **Public UUID** — `06030b7a-f51e-4328-87ce-a368c20949c8`
- **Old title** — `16GB DDR4/DDR5 DESKTOP RAM | South West Sri Lanka`
- **New title** — `Kingston 16GB DDR4/DDR5 DESKTOP RAM | South West Sri Lanka`
- **Old build description** — `Shop Kingston 16GB DDR4/DDR5 DESKTOP RAM at South West Sri Lanka.`
- **Old browser description** — `Brand: Kingston Capacity: 16GB Memory Generation: DDR4 or DDR5 (depending on model) Module Type: Desktop DIMM Designed for compatible desktop motherboards. Supports improved multitasking and system memory capacity. Suitable for gaming, office applications and everyday computing. DDR4 and DDR5 versio`
- **Shared description (109 characters)** — `Kingston 16GB DDR4/DDR5 DESKTOP RAM. Module Type: Desktop DIMM. Designed for compatible desktop motherboards.`
- **Canonical** — `https://southwest.lk/product/16gb-ddr4-ddr5-desktop-ram-06030b7a-f51e-4328-87ce-a368c20949c8`
- **Primary OG image** — `https://api.southwest.lk/uploads/items/images/9d4704b8-34d9-438c-aa8f-efeb14ce5077.webp`

Desktop DIMM and motherboard fit describe the shared product. Three active variants are present; exact DDR generation and speed require a selected model.

### Yesido YSW14 Bluetooth Speaker

- **Public UUID** — `45591a3e-6165-48d5-a6f9-fad60463ebf3`
- **Old title** — `Yesido YSW14 Bluetooth Speaker | South West Sri Lanka`
- **New title** — `Yesido YSW14 Bluetooth Speaker | South West Sri Lanka`
- **Old build description** — `Shop Yesido YSW14 Bluetooth Speaker featuring Bluetooth 5.1 for fast transmission (plus TF card playback mode) at South West Sri Lanka.`
- **Old browser description** — `Key Specifications &amp; Features Connectivity: Bluetooth 5.1 for fast transmission (plus TF card playback mode) Speaker Output: 5W power with a 66mm loudspeaker Battery: 1200mAh built-in battery Design: Portable mini wireless design with a carrying rope Certifications: CE and ROHS certified Warrant`
- **Shared description (146 characters)** — `Yesido YSW14 Bluetooth Speaker. Connectivity: Bluetooth 5.1 for fast transmission (plus TF card playback mode). Battery: 1200mAh built-in battery.`
- **Canonical** — `https://southwest.lk/product/yesido-ysw14-bluetooth-speaker-45591a3e-6165-48d5-a6f9-fad60463ebf3`
- **Primary OG image** — `https://api.southwest.lk/uploads/items/images/63a48628-7b1d-42d3-b5c2-ecd6f0aa2813.webp`

Bluetooth connectivity, TF playback and the battery detail explain the speaker without promising stock. This public item was out of stock at capture.

## Verification and Phase 1 regression coverage

- Built a separate copy of the Customer application and shared modules with the installed dependencies. Ran npm run build against a local replay of all captured products and 160 active variants. The original dist and sitemap were preserved. The isolated build generated 143 product HTML files, seven static information pages and a sitemap with 155 unique locations.
- Independently parsed every output head and sitemap. All 143 had the previous canonical URL, one matching indexable product canonical, the expected OG URL and primary image, and an entry in the sitemap. Each contained exactly one Product and one BreadcrumbList. Existing structured data code and inputs were preserved.
- Used Chrome with intercepted local responses to compare each initial head against the shared output and the running Vue application. Compared title, description, canonical and all product-specific OG and Twitter fields. Traversed all 143 via actual related-product links and compared every head. Explicitly opened and refreshed all 11 pilot URLs; observed zero mismatches. Going Home removed the product head state. These checks establish parity for **equivalent data**, not freshness of future production snapshots.
- New permanent tests cover complete/incomplete records, HTML/entities, Unicode, special characters, brand duplication, long names, similar models, stock, variants, absolute/relative/missing images, deterministic output, volatile/uncertain facts, and named-paragraph fallback. A browser test generates two fixed records with the real static generator and compares raw, mounted, navigated, queried and refreshed heads and cleanup. Existing tests exercise renamed and new-product shell routes by UUID, query preservation, definitive misses and transient failures.
- Final combined run: **36 tests, 34 passed, one failed, one skipped**. This includes one temporary catalog-wide browser check. The repository Customer suite alone accounts for **35 tests, 33 passed, one failed, one skipped**. The existing gallery target-size assertion at tests/productImages-browser.test.mjs:62 is the sole failure. The HTTP-serving test requires two isolated Apache listeners that were not configured. Headless browser startup required the host-approved execution environment. Account flows, layout, information pages, sitemap, analytics/consent and product navigation tests passed there. No new regression failure observed.
- git status was checked before and after; git diff --check passed. No source changes to Admin, backend, hosting rules, visible product headings, gallery controls, canonical identity or category routes. No production build or activation was run.

## Exact Phase 2 change and commit scope

Two root reports were created: SEO_PHASE_2A_BASELINE_REPORT.md and SEO_PHASE_2B_METADATA_IMPLEMENTATION_REPORT.md. Customer paths below are relative to Frontend/Customer/.

| Paths | Disposition |
|---|---|
| src/utils/productSeo.js, scripts/generate-sitemap.mjs, src/pages/ProductDetails.vue | New Phase 2 hunks in files already carrying Phase 1 changes. Shared generator and its two consumers. |
| tests/productSeo.test.mjs | New Phase 2 unit tests added after existing Phase 1 coverage. |
| tests/productMetadata-browser.test.mjs | New controlled browser integration test. |
| package.json, package-lock.json | Declare the already-installed and locked entities 7.0.1 decoder as a direct dependency. No installation, new package version or regenerated dependency tree. |

Review only these nine paths and isolate Phase 2 hunks in the four mixed files if Phase 1 has not yet been committed. All earlier SEO reports, .cpanel.yml, hosting safety files, unrelated Customer changes, undeployed backend previews, unfinished Admin tools and caches belong to the pre-existing tree. Exclude captured data, screenshots, build/test workspaces, node_modules and dist. Nothing was staged or committed.

## Outstanding editorial and structured data work

1. **Phase 2C editorial pilot is ready for owner review.** Start with R50i/R60i, Kingston memory compatibility, Lexar capacities and the Acer configuration. Confirm supplier specs, compare long titles in context and retain accurate units. One separate listing, Yesido YP88 AA, describes AAA cells in its body. Resolve that conflict with the catalog owner before reusing that field. Confirm the identity of the OTN-5138S converter whose prose gives model OTN-51383. Product records remain untouched.
2. **Reviews.** The captured catalog had no positive approved review counts or ratings. Later, derive aggregateRating and visible review markup only from published approved reviews for the same item. Require a nonzero count, supported scale, matching displayed content and appropriate disclosure.
3. **Merchant policies.** Ask the owner to verify return windows, exclusions, costs, applicable countries and shipping zones, rates and delivery times. Model these only after approval and comparison with checkout and policy pages. A shipping weight alone cannot supply those values.
4. **Identifiers and variants.** Verify manufacturer-assigned GTIN/MPN against the specific sellable unit. Check model strings against packaging or manufacturer records. Reconcile variant-specific offers with selected SKU, currency, price and availability; never promote an internal UUID or item code into a manufacturer identifier.
5. **Measurement and release.** A separately approved release and subsequent recrawl are needed before measuring CTR, impressions or canonical consolidation. Google may rewrite snippets. Publication lag, renamed/deleted product lifecycle and the historical 5XX investigation remain separate Phase 1 exceptions. The gallery accessibility failure remains open. No Phase 2C work, schema expansion or deployment is authorized by this report.
