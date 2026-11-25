# South West Phase 2 on-page SEO audit

25 November 2026 | Customer storefront | Read-only review

## Executive summary

The best first change is to make the product description in the delivered HTML survive hydration. All 123 historical snapshots had distinct descriptions, but applying today's browser formula to their product records changed all 123. The next editorial opportunity is to distinguish similar items by model, fit and purchasing constraints. The strongest category opportunity is selective: South West already has indexable directories, while their individual categories and brands are filters.

The November release established reachability for 143 public products. It did not establish search rankings, snippet quality or initial metadata for the two products published after the build. Start with a small product pilot and compare its results before expanding the site architecture.

## Method and evidence limits

Compared current local Vue routes, head management, product display, listing components and build scripts with the HTML, embedded product records, head tags and JSON-LD in all 123 local legacy `Frontend/Customer/dist/product/*/index.html` files. Compared the URL sets in local dist and public sitemaps (135 unique URLs each, same set). These are older directory-layout artifacts. The supplied production verification concerns a later flat-file release with 141 snapshots, 12 static sitemap routes and subsequently 155 live sitemap URLs. The local corpus is suitable for measuring patterns, not for reporting today's stock, prices, inventory mix or live defect prevalence.

Counts below use one record per historical product URL. Character counts use plain strings; body comparisons remove markup and normalize whitespace/case; the short-body screen counts whitespace-delimited words including bullet tokens. Length thresholds flag records for editorial review. Checked template behavior against source separately. No production fetches, Search Console query export, analytics, search volume, competitor research or fresh catalog export were part of this review. Google can choose its own displayed titles and snippets.

## Current product architecture and measured baseline

Product cards construct a slug-plus-stable-UUID URL. The build fetches public data and emits product-specific head tags, Product and BreadcrumbList JSON-LD and initial data. The browser resolves the product and sets head and offer data again. For a valid-shaped URL without a file the host can return a Vue shell. Anker Soundcore R50i NC and R60i NC were verified to load that way after publication. Their initial metadata coverage remains unknown. Existing canonical links and sitemap URLs are valuable invariants for Phase 2.

| Historical measure | Result and interpretation |
|---|---|
| Titles and URLs | 123 distinct titles, names and slugs. Titles used the product name plus “South West Sri Lanka”. Length 37–128 characters, median 53; 35 exceeded 60. Slugs before the UUID ranged from 14 to 101 characters. Canonical path, Open Graph URL and offer URL agreed on 123/123; each had one canonical and index/follow. |
| Descriptions in head | 123 distinct. Length 51–154 characters, median 106. 79 began “Shop”, 51 of those used “featuring”, 25 were exactly “Shop {name} at South West Sri Lanka.” and 44 ended with three dots. Distinct strings can still offer little reason to choose one result over another. |
| Visible content inputs | 123 nonempty, distinct normalized bodies. Plain-text length 149–1,486 characters, median 493. Five had fewer than 30 words. None of the 123 historical initial HTML documents contained an H1; Vue supplies a product H1 when rendered. |
| Identity and detail | 13 brands, 43 category labels, 123 distinct item codes. Brand appeared literally, case-insensitively, in 89 names. 54 bodies contained an explicit Model label; none of the Product objects supplied a model field. All 123 embedded records lacked populated structured specifications. Useful specs can still appear in description prose. |
| Images and offers | 291 of 294 image rows had nonempty alt text. All 123 Product objects had a brand, SKU, image and LKR offer. Availability was InStock on 121 and OutOfStock on two. Nine products had multiple active variants. These are historical values for testing patterns only. |
| Warranty | All 123 records carried a warranty value. The distribution was 71 six-month, 34 one-year, 12 two-year, five three-year and one one-month entry. A fresh product- or variant-level check is necessary before making customer-facing promises. |

## Current category and listing architecture

The following four clean routes each have a distinct indexable head defined in `Frontend/Customer/src/router/listingMeta.js`. The build provides landing-page metadata. Directory entries and product grids depend on client-side data.

| Route | Title before the South West Sri Lanka suffix | Meta description | Visible landing experience |
|---|---|---|---|
| /shop | Shop products | Browse products available from South West, Sri Lanka. | Shop H1, introduction, sort, grid, Load More and Home breadcrumb. |
| /offers | Special offers | Explore current offers and discounted products at South West. | Offers H1 and introductory text, discounted listing, link to Shop. |
| /categories | Shop by category | Explore product categories available from South West. | Directory H1; linked H2 category cards, optional description and child links. |
| /brands | Shop by brand | Browse brands available at South West online store. | Directory H1; linked brand cards with H2 names and shopping action. |

The directories are useful standalone navigation destinations. There is no dedicated canonical landing document, unique title/intro or sitemap URL per category or brand. Cards lead to /shop?category=ID or /shop?brand=ID. Header category navigation also uses /?category=ID. The listing consumes these selections; the router applies query-sensitive robots after navigation. Snapshot URLs provide a separate discovery channel for products. Category counts in the older data include Converters (18), RAM (8), Power Sockets (8), LED Lights (6), Wired Keyboards (6) and SATA SSD (5). Counts alone do not establish demand or justify publishing all categories.

## Prioritized findings and proposed tasks

Paths in this section are relative to Frontend/Customer. Severity describes impact on discovery, representation or buyer understanding. Effort is implementation complexity, independent of priority.

### P01 · High · Align product snippets and Open Graph metadata · Low–medium effort

**Evidence and behavior.** In scripts/generate-sitemap.mjs:210 the build selects features and constructs a short description. In src/pages/ProductDetails.vue:1597 the browser strips tags from the body and takes its first 300 characters. Applying the browser formula to the same historical inputs gave 123/123 differences from the saved head and 123 distinct results. The build sets OG title, description, image, URL and product type together at line 469; the browser supplies its own description and image selection to usePageMeta. “Featuring USB Port” on the R8 keyboard pair illustrates a valid but uninformative differentiator.

**Correction and benefit.** Use one pure selector for title, snippet and primary social image at build and runtime. Prefer verified, decision-relevant facts, such as layout or compatibility. This makes crawler, social and browser representations consistent and gives similar products distinct reasons to click. **Acceptance:** for the pilot, compare raw head, hydrated head and SPA navigation for identical title, description, canonical and OG fields against the same fixture; verify missing and escaped values and a sensible fallback. Review the 25 generic historical patterns against fresh records.

### P02 · High · Distinguish models, variants and purchasing constraints · Medium effort plus editorial review

**Evidence and behavior.** src/pages/ProductDetails.vue:2095 uses the catalog name for H1. Build titles repeat it with a site suffix. “16GB DDR4/DDR5 DESKTOP RAM” omits Kingston while the snippet includes it. Its copy says “DDR4 or DDR5 (depending on model)”; a buyer must know which generation fits. A 32GB desktop RAM entry uses “3200MHz” in the name and “3200MT/s” in the snippet. Verify the technical field and units. The YESIDO MG22 hair dryer name includes motor speed, technology, color and plug before the site suffix. The R8 1812 and 1801 keyboard bodies have 27 and 29 words; the Lexar 128GB and 256GB NS100 SATA SSDs have 29 and 24. These SSDs already include useful interface/speed details; length alone is a poor quality gate.

**Correction and benefit.** Pilot a verified brand + model + type naming rule with distinguishing capacity, size, fit or interface where needed. Keep a concise title and a readable H1; retain stable canonical URLs and product IDs. Use actual structured specifications where available; confirm variant-specific fit, stock and warranty with the catalog owner. Distinguish the two earbuds by verified features as well as model. This supports model searches and reduces ambiguity between nearby products. Similar search intent is plausible; no competing search impressions have been established. **Acceptance:** editorial sign-off on a 10–15 SKU pilot including RAM, keyboards, SSDs and variants; one unambiguous model/option per claim, no invented specs, no changed product hrefs, no forced minimum word count.

### P03 · High · Deliver useful initial product content across publication states · Medium for build; lifecycle work separate

**Evidence and behavior.** scripts/generate-sitemap.mjs:413 and src/pages/ProductDetails.vue:2095,2406 build head data and render the visible H1/details at different times. The historical files had product metadata but zero initial H1s. Vue renders the name, details H2 and specifications H3. Imported description markup can itself contain headings (sanitization at ProductDetails.vue:1196). New post-build products start from the shell; a successful response alone says little about their initial document.

**Correction and benefit.** First verify raw and hydrated HTML for a fresh built and post-build sample. Reuse the existing build to supply a semantic product name and short factual summary; preserve the current hydrated layout. Define a publication-to-snapshot refresh interval before considering a request-time service. This reduces dependence on delayed rendering. **Acceptance:** one primary H1 and consistent core text, canonical and Product/OG data before and after hydration for built pilot products; sanitized headings, no duplicate visible content or layout shift. For a new SKU measure time to a verified snapshot against an owner-approved target. Track stale, renamed, deleted and temporarily unavailable items independently.

### C01 · Medium · Pilot category landing pages only where justified · Medium–high effort

**Evidence and behavior.** src/pages/Categories.vue:44 and src/pages/Brands.vue:44 provide navigable directories. H2 names and optional category descriptions supply limited context; brand cards offer little beyond the name. The four route descriptions above are unique but generic. Filter results reuse listing identity; no standalone RAM, SATA SSD or brand page currently targets those topics.

**Correction and benefit.** Use fresh inventory and Sri Lankan Search Console page/query data to choose one or two stable groups. Write a short introduction explaining how to choose among stocked products; nominate a stable category path only after approval. Keep Offers useful with genuine active discounts and an accurate empty state. Apply the same evidence threshold to brands. This would give broader buying queries a relevant entry point without indexing arbitrary facets. **Acceptance:** approved pilot pages have a unique title, intro, H1, clean self-canonical, indexable raw head, linked inventory, breadcrumb and sitemap entry. Empty or retired groups have a documented lifecycle. Unapproved combinations retain their filter behavior.

### C02 · Medium · Improve crawlable paths to deeper inventory · Medium effort

**Evidence and behavior.** src/pages/footer/StoreListing.vue:92–129,223–265 starts with 20 products and uses a cursor and Load More button. Sorting and further loads operate in the browser; the button has no next-page href. src/layouts/CategoryNav.vue:97–120 navigates to a homepage filter while directory anchors open Shop filters. src/components/products/SimilarProducts.vue:20–49 loads related products before ProductGrid renders card links. In ProductDetails.vue:1964 the visible Shop crumb is text while the JSON-LD lists Home, Shop and product. Directory and listing breadcrumbs link Home.

**Correction and benefit.** Start with a linked Shop crumb and ordinary product anchors in pilot category content. If a group exceeds the first page, provide stable, linkable continuation with deterministic ordering while preserving Load More UX. Keep filters, sort, cart and variant navigation intact. This improves discovery beyond sitemap submission and helps shoppers retrace a path. **Acceptance:** with JS disabled a crawler can follow pilot hub → product and reach a product beyond the initial batch; no skipped/duplicated products across stable pages, accessible Home/Shop links and matching breadcrumb URLs after navigation.

### P04 · Medium · Keep offers, stock and identifiers consistent · Medium effort

**Evidence and behavior.** scripts/generate-sitemap.mjs:315–397 and src/pages/ProductDetails.vue:1609 construct offers from product/variant data. Historical Product and BreadcrumbList objects were universal. An offer with LKR and stock says little about which variant's price is displayed or how recently stock changed. Models buried in prose are unavailable as structured identifiers; an internal SKU is not evidence of a GTIN.

**Correction and benefit.** Reuse trusted fields and a common default-variant selection policy. Include a verified manufacturer model where available. Show out-of-stock products accurately; refresh affected snapshots when price/stock changes. This makes machine-readable offers more faithful to what a shopper can buy. **Acceptance:** fixtures for in/out of stock, mixed variants, missing price/image, special price and stale data; compare schema SKU, price, currency, availability and canonical offer URL to the displayed default choice. Omit unsupported claims and identifiers.

### P05 · Low · Describe meaningful differences between gallery images · Low effort

**Evidence and behavior.** src/pages/ProductDetails.vue:1997,2082 uses the product name on the main image and indexed thumbnail labels. Nonempty alt text existed on 291/294 historical image records. That count measures availability only; the text may be generic or inaccurate.

**Correction and benefit.** Use reviewed, meaningful image descriptions for distinct views with a product-name fallback. Keep selecting an image or variant understandable to assistive technology. **Acceptance:** test front/back/detail views, empty alt, color variant changes and thumbnail accessible names. Existing image URLs, sizes, controls and dimensions remain intact.

### C03 · Medium · Specify query indexation at the initial response · Medium effort

**Evidence and behavior.** src/router/index.js:218–240 and src/router/listingMeta.js distinguish clean routes and query-bearing views. Browser policy generally marks listing queries noindex/nofollow and points the canonical to the clean path. A static landing file can initially carry clean-route index/follow on a filtered request. This is a source-based possibility; the audit did not measure live crawler outcomes. Indexing every filter to gain category exposure could multiply near-duplicate URLs.

**Correction and benefit.** Inventory filter, sort, tracking and future pagination parameters separately. Agree on the intended raw and rendered policy per class. Use dedicated clean routes for approved hubs, preserving filter behavior and query propagation elsewhere. This gives crawlers consistent signals and bounds duplicate discovery. **Acceptance:** HTTP and hydration matrix for clean Shop, category, brand, sort, tracking, combined and approved continuation URLs. Check single intended canonical, robots, retained parameters, sitemap inclusion and filter results. Confirm hosting behavior on the actual serving stack before changing rules.

## Sri Lankan search intent and measurement

The catalog supports product/model, type, variant and brand language. LKR offers and recorded warranty periods make price, availability and support useful shopping facts when freshly verified. For example, a buyer comparing a Kingston desktop DIMM to laptop memory benefits from memory generation, module type, capacity, current LKR price and the applicable warranty. A keyboard buyer may distinguish “compact 83-key” from “full size” before comparing prices. Put stable differences in titles and volatile price/stock in maintained offer and visible price fields. Confirm fulfillment coverage before making delivery promises.

“R50i NC price in Sri Lanka”, “SATA SSD Sri Lanka” and “DDR4 desktop RAM warranty” are candidate queries, not observed searches. Obtain a dated Search Console page/query export segmented by Sri Lanka, device and branded/nonbranded traffic. Check whether overlapping products actually compete for the same queries and whether category intent differs from model intent. Record impressions, clicks, CTR, average position and indexed canonical for pilot and comparable unchanged pages before and after recrawl. Flag changes in stock, promotions and seasonality in the comparison. No ranking or traffic uplift can be estimated from these artifacts.

## Delivery sequence, risks, regression gates and effort

| Order | Proposed work and expected benefit | Planning estimate |
|---|---|---|
| 1 | Obtain a fresh catalog sample, rendered/raw heads and dated search baseline. Align snippet and OG selection (P01). | 1–2 engineering days |
| 2 | Pilot model-led titles and useful specs (P02); verify offers and image labels on the same products (P04/P05). | 1–2 engineering days plus 2–3 editorial/catalog days |
| 3 | Prototype initial product content through the existing build and measure publication lag (P03). | 1–2 engineering days |
| 4 | Select one category pilot from verified inventory and demand; establish its query/canonical policy (C01/C03). | 1 engineering day for design; allow 3–5 additional days if new routes, sitemap and serving behavior are approved |
| 5 | Align breadcrumbs and pilot discovery links, exercise browsing regressions and compare before/after evidence (C02). | 1 engineering day; deeper stable pagination may require separate API/design estimation |

**Estimated pilot:** 5–8 engineering days plus 2–3 editorial days, assuming one engineer, existing fixtures and prompt catalog review. With approved landing-route work, allow roughly 8–13 engineering days. Request-time resolution, backend changes, a new activation system, automated publication hooks and the wait for search recrawl are outside these estimates.

**Regression gate:** use isolated data covering similarly named models, missing fields, single/multiple variants, out-of-stock and new/retired products. Parse built HTML, then compare hydrated heads, headings, schema and links after direct loads, refresh and SPA transitions. Validate sitemap uniqueness and exclusions, query semantics, listing sort/filter/load-more, related links, image switching, cart addition and checkout navigation. Preserve old canonical hrefs and the existing gallery test, including its documented failure. Verify no second H1 from catalog markup, duplicate canonical or stale product schema on navigation away. Reconcile the representative snapshot with its live catalog revision before any release.

**Risks and decision gates:** inaccurate fit, price or warranty claims can mislead buyers. Catalog-owner sign-off precedes copy and offer changes. Head changes can cause canonical or hydration regressions; compare raw and rendered outputs. New hubs can compete with existing directories or survive after stock disappears; approve creation, refresh and retirement criteria first. Initial HTML work can duplicate Vue content; test accessibility and layout with and without JavaScript. The new-product publication interval, current catalog extract and search demand evidence are still needed. Phase 2 implementation awaits approval.
