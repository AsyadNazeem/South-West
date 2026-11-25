# Phase 2C.3.1 · Customer product metadata approval plan

**Decision requested:** approve the 107 Group A editorial targets, the bounded wording on 28 Group B products, and a small shared-rule pilot. Seven product identities stay on hold. The existing PK8899 tripod metadata stays as written. Approval of editorial text and approval of a particular generator output are separate decisions. Exact bespoke text across 135 products would require more control than the current catalog API provides.

## Evidence and editorial preview

The primary inputs are the Phase 2C editorial CSV and UUID-keyed correction register. The Phase 1 closure and Phase 2A/2B reports establish deployed versus local behavior. Reused the validated 25 November 2026 catalog captured at 14:28:19 UTC, including the variant evidence from the same run. Reviewed proposed titles and snippets against that evidence, with particular attention to model, connection direction, capacity, options and commercial claims. No repeat production retrieval or manufacturer research. The supplied GSC sample contained one disclosed Acer local-price impression; no measured benefit can be attributed to a suffix choice.

| Measure | Phase 2B baseline | Phase 2C.2 editorial proposal | Combined approval preview |
|---|---:|---:|---:|
| Public products | 143 | 143 | 143 |
| Titles changed from 2B | 0 | 113 | 108 |
| Descriptions changed from 2B | 0 | 142 | 135 |
| Titles above 60 characters | 62 | 23 | 26 |
| Descriptions above 160 characters | 0 | 0 | 0 |
| Duplicate titles / descriptions | 0 / 0 | 0 / 0 | 0 / 0 |
| UUID changes / canonical changes | 0 / 0 | 0 / 0 | 0 / 0 |

The longest combined title is 95 characters, and the longest description is 159. These are editorial preview measurements. Phase 2B static/browser parity was demonstrated on its local build. Parity for any future generation rules must be tested on an actual build.

| Group | Products | Title changes | Description changes | Decision |
|---|---:|---:|---:|---|
| A | 107 | 85 | 107 | Recommend both reviewed fields, including existing titles worth retaining. |
| B | 28 | 23 | 28 | Recommend only the displayed limited copy; owner tasks remain pending. |
| C | 7 | 0 | 0 | Both Phase 2B fields carried provisionally for comparison. No endorsement of those fields. |
| D | 1 | 0 | 0 | Retain Plokama PK8899 Tripod, UUID `81e3d088-671c-4e11-8dda-c8a688ae8ad8`. |

**Batch decisions.** The existing classification was a starting point. Group A keeps model and option differences such as the two LDNIO cable lengths, the UGREEN part numbers, and the Lexar capacities. The batch drops bare speed numbers from the 4GB Kingston RAM titles, preserves the VM80 Pro’s ANC identifier and removes the H01 description’s reference to “the product listing.” Group B was reviewed field by field. For example:

- **P24 Pro:** keep the identifiable Pro model. Replace the earlier 80 W and colour-temperature proposal with model-selection guidance until the label is verified.
- **Acer and Kingston:** Acer retains the supported CPU, screen size and storage; omit local installed RAM, OS and exact panel. Kingston retains 16GB desktop DIMM and distinct DDR4/DDR5 options; omit unitless speeds. Neither description asserts universal compatibility.
- **Power, warranty and water resistance:** WL02’s 15 W claim applies only to phone charging. CA209 omits the 140/240 W dispute. Eight warranty-only rows omit both warranty durations; the ninth warranty case, 50570, stays held for identity/direction as well. WB10 and BTS12 omit waterproof claims. The CM675 title restores the catalog’s 4K distinction.
- **Medical, configuration and images:** MG67 describes settings, attachments and charging. The PK772 kit omits the uncertain light power source. Three alt-text tasks concern individual images and do not prevent evidence-backed product metadata. All 28 have a bounded improvement after review. A partial recommendation never confirms the excluded facts.

## Existing risk in the seven held heads

**20 existing heads warrant factual or ambiguity review** against the prior register: all seven held rows and 13 Group B rows. Counted once per product where the current title or snippet itself repeats an unresolved, version-dependent or materially ambiguous claim. A disputed warranty absent from the current head is a catalog issue only. The CSV describes each risk and the seven below remain in the combined preview. The Group B limited wording removes the flagged signals.

| Held product | Risk already in Phase 2B | Product-level release decision |
|---|---|---|
| Yesido YP88 | AA in title and snippet; 440 mAh/666 mWh in snippet conflicts with the model/size evidence. | Hold until both pack and cell identify size and capacity with units. |
| Plokama P24 | Base-model name next to a 2900–6900 K range although the source also references Pro. | Match base and Pro labels before assigning the range. |
| Kingston Exodia 512GB | DTX family, 512GB and physical dimensions presented as a single configuration. | Require the actual part number and capacity. |
| ONTEN OTN-5165 | Current head advertises HDMI male to VGA female while variant fields identify USB. | Verify signal input and output and any separate power lead. |
| ONTEN OTN-5138S | Current head presents 5138S VGA-to-HDMI as the unit sold; body and variant fields conflict. | Package match required even though manufacturer evidence supports the model name. |
| UGREEN MM142 50570 | Current title presents USB-C-to-HDMI and aluminium shell; snippet adds PP/TPE. Direction/material roles are disputed. | Verify code, signal direction and construction. Reconcile warranty separately under the same task. |
| Yesido MG44 | Both fields identify MG44 while body says MC44. | Read printed model and maximum load before promoting either identity. |

These are release blockers for **publishing revised metadata on the affected products**. A generator change is global. If a candidate changes any held field, stop that release candidate or return for a separately reviewed disposition. A build that still carries a pre-existing disputed claim also requires the owner’s explicit decision before production promotion. The plan does not recommend embedding exceptions keyed by ID or treating provisional output as a safe fallback.

## Branding policy

Default to **“| South West Sri Lanka” when it fits naturally**, using “| South West” when the complete verified product identity plus the full suffix would exceed the 60-character editorial guide. Preserve identifiers, compatibility and capacity even when the short form still exceeds 60. For a product genuinely branded SouthWest, one store-brand mention is sufficient; recognize the brand as a whole value. Keep approved local wording where the existing evidence supports it, as with Acer. A local cue can also appear naturally in a description. Avoid special-casing a model to target a keyword.

Applied to unchanged Phase 2B product wording, shortening every suffix would reduce over-60 titles from 62 to 40, saving ten characters per title. The earlier editorial proposal reached 23 with body-of-title edits as well. The combined preview reaches 26 while preserving holds and product distinctions. Both suffix choices keep a store identifier. Neither search improvement nor visual truncation is established by a character count. Validate collisions catalog-wide, and compute the policy in a single shared function for both renderers.

## Product management and serving architecture

| Stage | Current behavior and evidence |
|---|---|
| Create or edit | Admin `Frontend/Admin/src/pages/products/ItemCreate.vue:1641` loads an item for editing. Its form submits item name, rich description, classification, warranty, status and shipping fields at line 1853; POST /items creates and PUT /items/:id updates. `Backend/src/routes/itemRoutes.js` requires authentication and the relevant create/update permission. Variant and image data have separate surfaces, including `CreateItemVariants.vue` and `CreateImage.vue` in that Admin directory. |
| Persistence and identity | `Backend/src/models/Item.js` maps items: internal id, item/public/accounting codes, slug, name, description, category/brand/unit/type/warranty references, condition, shipping weight/unit, serialized/active/new flags, new-label timing and timestamps. Variants, price, specification values, media and stock are associated records. `Backend/src/migrations/20260928113905-create-items.js` and `20261022120000-add-public-product-identifiers.js` in the same directory document the table and unique public identity. `Backend/src/controllers/itemController.js:361` creates a generated item code, UUID and unique slug derived from the name. The locked transaction at line 492 updates supplied fields; the update assignments at line 565 do not regenerate slug or UUID. Name edits still affect H1, storefront identity and metadata. Keep names fixed. |
| Public contract | `Backend/src/controllers/storeProductController.js:637` returns public ID, slug, item code/name/description, brand/category/warranty, shipping fields, condition/new status, prices, campaign information, availability, approved review aggregates, colour and images. Listing requires public eligibility, positive price and an image. Stock status is distinct from active status. Separate variants return SKU/name, attributes, default/active state, price/stock and colours (line 1181). Item specification records in storage do not by themselves create a public editorial field. |
| Browser freshness | `Backend/src/routes/storeProductRoutes.js:17` sets private, no-cache on the product listing/lookup. `Frontend/Customer/src/pages/ProductDetails.vue:1495` fetches by public UUID on mount or product navigation, resolves the current catalog path, gets variants and calls productMetadata on success (line 1603). A saved change can appear on the next successful lookup. An already open page has no automatic update subscription here. Cache layers and failed requests preclude an immediate visibility guarantee. |
| Initial document | `Frontend/Customer/scripts/generate-sitemap.mjs:33` paginates the public list; line 283 calls the same metadata utility and line 353 embeds a product snapshot. Builds write flat product HTML. An Admin save does not rewrite existing deployed files. After publication a new valid-shaped product can open in the shell; its product head is populated after successful lookup. Existing raw HTML and fallback records stay at their build revision until a reviewed rebuild and activation. A sitemap refresh does not regenerate those files. |
| Head ownership and exception | `Frontend/Customer/src/utils/productSeo.js` owns successful product metadata. The build HTML writer and `src/composables/usePageMeta.js` populate head tags. `ProductDetails.vue:1655` also has a transient-error snapshot branch: when a matching snapshot exists and the canonical node is missing, it manually constructs a branded title and generic defaults. Include this exceptional path in the next change so an approved branding rule does not diverge there. Preserve existing valid head when present. |

**SEO field assessment.** The inspected item model, migrations, Admin form, write assignments and public serialization expose no dedicated SEO title or meta-description fields. This is a repository contract finding; no production database inspection was performed. Visible product description and variant facts can support generated metadata. They cannot store invisible, independently approved strings today.

## Approaches and implementation scope

| Approach | What it can deliver | Decision |
|---|---|---|
| A · Shared generation rules | Measured a small candidate rule on the 135 A/B rows: start with the Phase 2B base title, normalize the standalone word “pro” to “Pro” and choose the suffix by complete length. Of 108 changed titles, **8** match that rule exactly. The other **100** need different wording or further evidence for reusable rules. Another 27 A/B titles already match their target without any title change. No rule was demonstrated to reproduce the 135 changed descriptions verbatim. | Start here for new and existing products. Use only well-defined textual transforms and factual, complete excerpts. Measure exact results; present any different wording for approval. |
| B · Correct catalog content | Existing Admin workflow can correct inaccurate body, variants, warranty and alt text with owner evidence. Approved factual improvements then reach visible pages and successful browser requests, and enter static HTML at the next build. Changing a body can affect shoppers and structured-data descriptions. Selection of facts can still differ from a manually written snippet. | Use only for genuine product-data corrections. Do not rewrite visible body copy merely to obtain a preferred search snippet. |
| C · Existing SEO overrides | No supported dedicated fields across the inspected end-to-end path. | Unavailable. Do not repurpose item names, alt text, variant attributes or internal codes. |
| D · Optional editorial fields | If exact independently edited titles/descriptions become an ongoing requirement, introduce two nullable item text fields, one schema migration, optional authenticated Admin inputs, write validation and public read projection. Treat blank as automatic. Validate plain text, output escaping, completeness and precedence. Use the same pure generator for static and Vue output; normalize branding once. Existing products default to automatic. Overrides can become stale on renames, changed capacities or product retirement and require review ownership. | Separate architecture and business approval only. Higher ongoing maintenance than A+B; no migration, backend change or Admin change is necessary for the recommended next stage. |

**Recommended architecture:** implement a small shared-rule pilot plus independently approved catalog corrections. Keep the CSV as a review fixture outside runtime. A generic rule cannot determine which of two conflicting catalog facts is correct, and “unverified” is not a machine-readable status in the API. Avoid deriving snippets from ambiguous variant-specific values or volatile fields, and never promote a selected variant’s facts to all variants without validation. Where general rules cannot meet approved wording safely, defer it or present the actual generated alternative. Product-level suppression via a permanent UUID table would defeat the architecture. If the owner requires every proposed sentence verbatim, revisit D before promising delivery.

**Exact candidate files for the minimal path**, relative to Frontend/Customer:

- `src/utils/productSeo.js` for deterministic rule changes and shared fallback inputs.
- `src/pages/ProductDetails.vue` only for the exceptional snapshot/missing-canonical head update. Retain route-level robots decisions, stable UUID and correct absence handling.
- `tests/productSeo.test.mjs`, `tests/productMetadata-browser.test.mjs`, `tests/sitemapGeneration.test.mjs` and `tests/productNavigation-browser.test.mjs` for additions where existing assertions do not exercise the new paths. The build generator and normal browser call already consume the utility; no separate title/snippet implementation is needed.
- No write to deployment tools, rewrite configuration, sitemap scheduling, database, backend or Admin source. A later optional D design would involve the existing Item model/controller, public projection and ItemCreate form identified above plus a new migration whose name is determined only if approved.

## Phase 2C.3.2 sequence and acceptance

1. Owner marks acceptable A/B text and branding policy, signs off on each risk disposition in the separate checklist, and identifies any exact wording that is indispensable. Keep all seven holds pending. A staged local prototype can proceed after explicit approval while stock checks continue.
2. Use controlled fixtures for a compact shared-title and description-rule prototype. Recompute all 143 heads offline. Diff exact output against the approved batch and Phase 2B, including C/D. Partition exact matches, safe alternatives requiring approval, and deferred copy. Do not describe an approved editorial target as implemented until its actual output matches the decision.
3. For new products, continue normal Admin creation, publish through the public catalog, use automatic metadata in Vue, and include the product at the next approved static build. For updates, use the existing editor only for evidence-backed catalog corrections, keep the identity fixed, verify the next public lookup and compare source revision on the subsequent build. Route owners must review stale raw heads before any future release.
4. Unit-test full/short suffix boundaries, repeated store brand, casing, stable SKU/model/units, Unicode/escaping, long names, absent brand/body/image, commercial or disputed text, and deterministic fallbacks. Test exact approved wording where attainable. Use siblings with similar names, multiple or mixed variants, an out-of-stock active product and a newly published shell product.
5. Build in isolation with mocked API data. Compare raw head, hydration, direct refresh and real product-to-product SPA navigation across old and updated descriptions and equal record revisions. On a changed revision deliberately demonstrate old static versus refreshed browser output. Test canonical deduplication, slashless apex path, stable UUID, renamed slug, query-bearing noindex, unchanged primary OG image, OG/Twitter parity, absence vs transient failure, matching embedded snapshot, missing-canonical recovery, and stale metadata removal when leaving a product.
6. Catalog-wide gates: validate uniqueness and lengths, reject changed UUIDs/canonicals, compare product schema/breadcrumbs, information pages, sitemap and static asset behavior. Keep existing analytics/consent and customer workflow tests. Run the previously skipped `tests/servingSeo.test.mjs` against its two configured isolated Apache listeners for final release verification. LiteSpeed acceptance is separate. Preserve the known 24 × 24 gallery assertion at `tests/productImages-browser.test.mjs:62` and report it separately if still failing.
7. Seek separate approval for any implementation beyond shared rules, actual content writes or release. The editorial pack is ready for owner decision. Production readiness cannot be inferred from this preview.

**Planning validation.** The batch has exactly one row per input UUID, unchanged canonical URLs and all seven original blocked rows held byte-for-byte in both head fields. The checklist has 35 unique, pending owner records and covers all nine warranty cases. Git status and diff whitespace checks were run. The three planning files are the only additions from this task.
