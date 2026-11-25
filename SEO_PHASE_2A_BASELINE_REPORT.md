# Phase 2A · South West catalog and search baseline

**Completed 25 November 2026.** South West’s public catalog returned 143 distinct, active public products. On this capture, the previous build and browser formulas produced different descriptions for all 143. The older 123-product audit described a separate catalog. The figures below distinguish operator-reported Google measurements from the public data independently retrieved for this review.

## Google Search Console baseline

The operator captured the following figures on 25 November. Daily performance data covers 2–23 November 2026, before the completed Phase 1 deployment. Total clicks were **18**, impressions **87**, CTR **20.69%** and approximate impression-weighted average position **6.30**.

| Segment | Impressions | Clicks |
|---|---:|---:|
| Sri Lanka | 78 | 18 |
| United Kingdom | 3 | 0 |
| Other countries | 6 | 0 |
| Mobile | 53 | 10 |
| Desktop | 33 | 8 |
| Tablet | 1 | 0 |

Country and device rows describe the same traffic in different dimensions.

| Disclosed query | Clicks | Impressions | Position |
|---|---:|---:|---:|
| south west online | 1 | 1 | 1 |
| southwest hardware | 1 | 1 | 3 |
| sauth west | 0 | 1 | 2 |
| south western | 0 | 1 | 9 |
| what pen is this | 0 | 1 | 10 |
| acer aspire go 15 price in sri lanka | 0 | 1 | 48 |

Only six queries were disclosed. The Acer observation supports including the laptop in the pilot. One impression is insufficient to infer demand. Historical homepage clicks were split between HTTPS apex (7), HTTP apex (5) and HTTP www (5). Compare subsequent page reports for consolidation under https://southwest.lk/.

| GSC report | Operator-supplied evidence | Interpretation |
|---|---|---|
| Page indexing, updated 16 November | 12 indexed, 59 excluded, 71 known. Exclusions comprised 42 discovered/currently not indexed, eight crawled/currently not indexed, seven noindex, one duplicate without user-selected canonical and one alternative with a proper canonical. | Validation had started for discovered/currently not indexed and the duplicate without a selected canonical. Inspect representative URLs and intended indexability before classifying exclusions. |
| Sitemap | https://southwest.lk/sitemap.xml submitted and last read 25 November. Success, 142 discovered pages. | Phase 1 verification counted 155 live entries including 143 products. GSC discovery and the served XML were measured at different processing times. |
| Product snippets | 25 valid, zero invalid. Missing aggregateRating on 25; missing review on 25. | Optional enhancement warnings. The public data below provides no approved ratings to publish. |
| Merchant listings | 25 valid, zero invalid. Visible warnings covered missing offer return policy (25), shipping details (25), and global identifier (3). | The screenshot was cropped and may omit additional warnings. |
| Core Web Vitals, updated 24 November | Insufficient real-user usage data on mobile and desktop. | No field performance verdict is available for either device. |

## Public catalog retrieval

Sequential read-only GETs used the storefront generator’s /api/store/products endpoint with paginate=1 and requested limit=100. The server applied a 25-item limit. Captured the first response at **14:27:49 UTC** and completed the listing at **14:28:19 UTC (19:58:19 Sri Lanka)**. Validated success, arrays, stable seed, nonrepeating cursors, terminal hasMore=false and unique parseable UUIDs. Six successful listing requests; one earlier sandbox DNS failure before an HTTP connection. Every product had a valid Phase 1 path. The public controller restricts eligibility to active products. It omits the active flag from its listing projection; no private or inactive inventory was enumerated.

One sequential GET of the public variants endpoint per product provided the missing variant attributes. The 11 pilot requests are included in these 143 calls. Variant retrieval completed at **14:31:21 UTC**. All returned successful arrays. Total successful HTTP requests were **149**, with timeouts of 15–20 seconds and no repeated successful pages. The two reads form a short observation window rather than a database transaction. Temporary copies were kept outside the repository. This task did not request customer review records.

## Catalog and metadata measurements

| Measure | Observed result |
|---|---|
| Product identity and availability | 143/143 unique names, slugs, UUIDs and public product paths. 142 in stock, one active out of stock (Yesido YSW14 Bluetooth Speaker). |
| Existing titles | Catalog item name plus “South West Sri Lanka”. 143 distinct, zero duplicates. 37–128 characters, median 54; 55 over about 60 characters. |
| Existing build snippets | Priority feature selector, body truncation or shopping fallback. 143 distinct, zero duplicates. 51–154 characters, median 121; zero over 160. 32 name-only shopping templates including brand enrichment; 29 matched the literal raw item-name template. |
| Existing browser snippets | Removed HTML tags, collapsed whitespace and took the first 300 characters. 143 distinct, zero duplicates, median 300; 141 over 160. All 143 differed from the build output for identical records. A missing-body fallback was never needed in this capture. |
| Product content | All 143 plain bodies nonempty and distinct after normalization. Length 149–1,597 characters, median 554. Five under 30 whitespace-separated words (including bullet tokens). Concise SSD specs can still answer real buying questions. |
| Brand, model and specifications | All 143 supplied a brand (14 labels); 34 lacked its literal text in the name. Zero top-level structured specification arrays. 68 bodies contained an explicit Model/Model Number label. 105 products had a nonempty variant Model attribute; 109 had one or both signals. 124 products had populated attributes on at least one variant. A model-like string requires verification before use as a manufacturer identifier. |
| Variants | 160 active variants, zero inactive returned. 132 products had one; seven had two, two had three and two had four. LDNIO cable length and Kingston RAM generation illustrate material differences within one canonical URL. |
| Images | All 143 products had images. 340 image rows, 337 with nonempty alt text; no qualitative claim about those labels. All captured primary images agreed between the old image policies and the shared implementation. |
| Product schema | The isolated build with captured variant data produced one Product and one BreadcrumbList for each of 143 products. The current generator requires a valid price, stock information and an eligible image; default active variant precedes first active variant. GSC’s count of 25 is a separate historical measurement. |
| Ratings and identifiers | Zero products with positive review_count; all 143 rating values null. The public controller aggregates approved reviews. All had an internal item code. Product and variant fields did not expose verified GTINs or MPNs. |
| Commercial policies | 143 had a warranty value and shipping weight. These values do not establish delivery regions, shipping charges, transit times or return policy terms. No product-level merchant return policy or shipping details object in this capture. |

Character counts are editorial screens. No threshold establishes Google eligibility or predicts snippet selection. The measurements replay the old local formulas against current data. They do not claim that every live static file contained the newly captured record.

## Validation pilot and editorial follow-up

Selected the five operator candidates plus both Anker models, both Lexar capacities, Kingston’s 16GB desktop RAM and the out-of-stock Yesido speaker. Exact names, UUIDs and before/after output are in the companion implementation report. All eleven were public at capture. No genuine published-review product qualified. The pilot covers incomplete top-level specifications, products published since the Phase 1 build, closely related names, multi-variant identity and temporary unavailability.

The strongest comparison pairs are Lexar 128GB/256GB and Anker R50i NC/R60i NC. The Kingston record needs variant-level compatibility review. Keep a dated capture of the same pilot pages and GSC country/device breakdowns after any separately approved release and recrawl. Search Console access and commercial policy verification remain with the operator.
