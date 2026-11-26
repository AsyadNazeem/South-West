# R8 H01 headset consolidation plan

**Decision requested — approve one USB stock reclassification, the USB commercial inputs and one permanent storefront redirect.** The imported catalog already has a single visible H01 product. The old parent **167 and its USB variant 183 are both inactive**, yet their active stock balance still holds **5 units, 0 reserved**. The retained USB variant **206** has neither pricing nor stock. Adding five units through an opening balance would double-count the USB headsets. The plan moves the verified quantity in a single balanced transaction.

Evidence comes from read-only MySQL transactions against the local `south_west` import, loopback Customer API GETs, local media/build files and repository source inspected on 26 November 2026. Production state, physical stock and deployed redirects were not observed. All operational steps below are proposed for a separately approved execution.

## 1. Catalog identity and visibility

| Field | Retained product | Retired product |
|---|---|---|
| Item | 166 · SW-000166 · R8 H01 3.5mm/USB Wired Gaming Headset | 167 · SW-000167 · R8 H01 USB Wired Gaming Headset |
| Public UUID | `1f9e219d-defe-47d3-a102-02c1ff4c4665` | `c8feeb55-99f0-4c15-a160-fe631d16f7c3` |
| Parent status | Active | Already inactive |
| Public detail lookup by UUID | HTTP 200, one item, 5 available | HTTP 200, empty product list |
| Public variants GET | HTTP 200, only ID 182, 5 available | HTTP 404 |

Both parents have brand R8 (196), category Gaming Headset (17), item type Headphones (18), unit Piece (1), active six-month warranty definition (5), new condition, non-serialized stock, 0.900 kg shipping weight and null parent QuickBooks code.

| Item / variant | SKU | Active / default | Connector Type | Other distinguishing data |
|---|---|---|---|---|
| 166 / 182 · H01 3.5 | `SWV-000166-H0135` | Yes / yes | 3.5MM | Model and QB code H01 3.5; Interface USB/3.5MM |
| 166 / 206 · H01 USB | `SWV-000166-H01USB` | Yes / no | USB | Model and QB code H01 USB; Interface USB |
| 167 / 183 · H01 USB | `SWV-000167-H01USB` | No / yes within retired parent | **Key absent** | Model and QB code H01 USB; Interface USB |

No colour links or item-level specification assignments exist on either parent. Connector Type is already present on both retained SKU attribute objects. Keep 182 as default. Preserve both old identifiers and the old default flag for traceability. The shared USB QB code needs an accounting-owner check wherever an external system uses it instead of the SKU.

## 2. Dependency audit

The audit enumerated physical columns and foreign keys in `information_schema`, searched item, variant and product references independently, decoded guest cart JSON and checked downstream relationships. Counts below are for these headsets only unless otherwise stated.

| Dependency | Local finding and cutover treatment |
|---|---|
| Procurement | Zero `purchase_order_items` and zero `goods_receipt_items` for either item or any of the three variants. No linked PO/receipt headers. The two opening movements are labelled goods receipts from bulk import; neither has a receipt-document ID. Preserve the movements. |
| Sales and finance | Zero `order_items`. Consequently zero linked pending/completed orders, invoices, payments, deliveries, addresses, order promotions or order idempotency results. These tables depend on the original order ID. Retain all original links if the execution environment differs. |
| Carts and checkout | Zero cart lines of any status, zero direct customer checkout sessions of any age. All 43 guest session payloads in the import decoded successfully, with zero matching lines, including expired/consumed sessions. No target-linked guest idempotency result through these sessions. |
| Wishlists and reviews | Zero wishlist entries and zero product reviews; no linked review images. Both features use parent item IDs. |
| Warranties | Same warranty definition on both items. Zero claim matches by product ID, linked order line or legacy product text containing H01. No dependent evidence, requests, history or mail through such claims. Future sales on 206 use the retained item's warranty. |
| Pricing and inventory | Four normal price rows, eight method-price rows, two balances and two ledger entries across the three variants. Details below. No parent-level price or stock row. |
| Media and specifications | Two active item images on 166, none on 167. No videos, item colours, variant-colour relations or item specification-value rows. Type-level definitions remain shared across other products. |
| Discounts | No direct promotion-item or campaign-item links, no matching brand/category links, and no discount campaigns in the import. Three all-product promotions exist; all are past their end dates. Recheck effective dates and global/category/brand eligibility at cutover. |
| Merchandising links | No H01 name/code/UUID-prefix matches in homepage banner or FAQ URLs, homepage section settings or website theme config. External advertisements, bookmarks, feeds, CDN caches and accounting mappings cannot be enumerated from MySQL. |
| Audit and notifications | Matching item/variant/image entity IDs or top-level old/new item IDs identified 2 item updates, 2 image creates, 1 variant create and 5 variant updates. Preserve these append-only records. Zero matching typed product/item/variant references in customer or admin notifications. Polymorphic logs and external free text are not enforced by foreign keys. |
| Inventory identity | The unique balance index is `(variant_id, location_id)`. A stock row ID is independent of a variant ID. **Balance 182 belongs to variant 183**; balance 181 belongs to variant 182. Always match parent, variant and location. |

## 3. Price comparison and owner decisions

All observed rows are active LKR rows. Normal price rows have open effective dates. Retirement has left old price records intact.

| LKR | 182 retained 3.5MM | 183 old USB | 206 retained USB today | Required for 206 |
|---|---:|---:|---|---|
| Cost | 100 (row 318) | 100 (320) | No row | **Owner/accounting decision.** Old USB cost 100 is the recorded candidate. Confirm against supplier/import evidence. There is no linked PO or receipt line to substantiate it. |
| Selling | 4,000 (319) | 4,250 (321) | No row | **4,000 approved** |
| Cash/COD | 4,000 | 4,250 | No row | Explicit owner-approved amount |
| Card | 4,100 | 4,350 | No row | Explicit owner-approved amount |
| Koko | 4,715 | 5,002 | No row | Explicit owner-approved amount |
| Mintpay | 4,715 | 5,002 | No row | Explicit owner-approved amount |

Obtain four explicit method amounts, cost, currency and effective date in the change record. Equal selling prices do not authorize equal method prices. Both columns of existing figures are comparison evidence only. Neither SKU's method schedule should be inherited, scaled or copied automatically.

## 4. Stock and movement comparison

The only recorded location is **3 · ONLINE-001 · Online Store**, active, online. Reorder level and quantity are zero on both existing balances.

| Item / variant | Balance ID | On hand | Reserved | Available in ledger | Publicly available |
|---|---:|---:|---:|---:|---:|
| 166 / 182 | 181 | 5 | 0 | 5 | 5 |
| 167 / 183 | 182 | 5 | 0 | 5 | 0, parent and SKU inactive |
| 166 / 206 | absent | — | — | 0 | 0, no selling price |

Movements **143** (166/182) and **144** (167/183) each record +5 at location 3 on 25 November 2026, type `goods_receipt`, reference type `bulk_product_import`, null reference ID. There are no other matching movements. The current combined physical ledger is **10**, of which **5 are USB**. If a fresh count and all gates confirm these numbers, the after-state is 5 on 182, 0 on 183, 5 on 206, with reserved zero throughout. This is a change of SKU attribution at the same location, with no procurement, sale or physical relocation.

## 5. Execution gates and exact Admin operations

1. **Inventory, accounting and storefront owners** record approval, a unique numeric change reference, approved prices, warranty/QB mapping, operator and maintenance window. Capture row IDs, quantities, price schedules, statuses, thumbnails, dependency counts, and a restorable database and storefront release baseline. Re-run section 9 against the authorized environment. Count actual USB units separately from 3.5MM at each location. Stop on a discrepancy, changed location, unexplained ledger delta, reservation or unresolved commitment.
2. **Admin → Products → Items / Item Variants.** Search SW-000166 by code. Verify active parent, active variants 182 and 206, Connector Type values, default 182 and both SKUs. Search SW-000167 with the inactive filter and verify variant 183. In the observed state leave both retired records inactive. If the live source is active, keep sales/stock writes gated until all checks pass; deactivate through the item and variant edit status controls at cutover and verify both flags independently. Never use Delete.
3. **Admin → Products → Item Prices → Create** (`/admin/products/item-prices/create`). Select SW-000166, choose **Different prices**, select only `SWV-000166-H01USB` on the price row, choose Cost Price, LKR, approved cost and effective dates. Save and reopen. Repeat for Selling Price at **4,000**, entering the separately approved COD, card, Koko and Mintpay amounts. Save and read back all five selling/method values and the cost for **206**. The “Same price” mode applies across active variants and would touch 182. Recheck 182 and 183 against section 3. Per-variant selling and bulk method prices use separate requests: on a partial failure, inspect what persisted and complete or correct that record before releasing stock. Avoid creating a duplicate active schedule on retry.
4. **Admin → Products → Images.** Check 166's primary and secondary photos and confirm the owner considers them appropriate for both connectors. No source media requires transfer. Use the existing media upload form if additional verified USB photos are supplied later. The current gallery is item-wide.
5. **Admin → Inventory → Stock.** Reconcile the by-variant/location balances again. Leave the destination at zero or absent during price preparation. A priced zero-stock USB option may be visible as unavailable. For an all-at-once public switch, hold storefront purchases during staging. Do not seed the destination with an opening count. Perform only the bounded stock transaction below.
6. **Before reopening sales**, reconcile balances, movement pair and audit entries. Validate public detail, variants, selection, cart and quote in a staging fixture or otherwise approved non-paying test flow. Retire the source if this is still required in the execution environment, validate sitemap/snapshots and enable the tested 301. Reopen sales after all checks pass. Keep the old SKU available to authorized historical lookups.

Admin source: `Frontend/Admin/src/router/index.js:187,216,292,298,334,479`, `Frontend/Admin/src/pages/products/CreatePrice.vue:344,678,710,1128`, and `Frontend/Admin/src/pages/products/ItemCreate.vue:491`.

## 6. Necessary atomic stock operation

The standard movement controller accepts positive-quantity `transfer_out` and `transfer_in`, locks a balance, writes a ledger row, writes an audit event and commits **one movement per request**. It explicitly rejects inactive variants and its nonnegative check alone does not protect reserved units. Two Admin requests could leave half a transfer committed. The daily stock-count workflow also operates on a single variant. Temporarily making 183 sellable, changing its existing balance's variant key, editing old receipts, or entering two independent stock counts would give the wrong safeguards or provenance.

**Proposed exception for approval:** a reviewed, single-use Sequelize transaction run by an authorized operator, scoped to these identities, using `InventoryStock`, `InventoryStockMovement` and `recordAuditLog`. No migration or merge feature is needed. The exception permits decrementing this inactive source; it grants no general movement privilege.

- Gate purchase, inventory and catalog writes affecting the three SKUs. Lock both item rows, then variant rows and balances in deterministic ID/location order. Verify exact codes, ownership, status, location type, current stock, reserved units and destination selling/payment configuration inside the execution window. Include zero/missing destination handling under the unique variant/location index. Recheck live carts, sessions and orders under the write gate. On a deadlock or changed prerequisite, roll back and re-read.
- With both SKU rows locked, look for existing movement rows with the approved `reference_type='catalog_reclassification'` and unique numeric `reference_id`. Two expected legs **plus** reconciled balances mean already applied. A partial pair, unexpected rows or unexplained balances require investigation. No blind retry. Use the same reference on retry; serialize competing attempts on the same locked parent/variant rows.
- For each verified location compute **Q from the locked source balance and physical count**. For this full retirement require zero reserved and no outstanding obligations. Require that the result leaves on-hand ≥ reserved. If the destination already has stock, reconcile its separate physical provenance first; an unexplained prior credit blocks execution. Create a missing destination balance at zero with the correct item, variant and location, active status and approved reorder settings.
- Debit source on-hand by Q and credit destination on-hand by Q. Preserve reservations and retain the old zero balance. Append `transfer_out` on **167/183** and `transfer_in` on **166/206** with **positive Q in both ledger rows**, same location, same reference, operator ID, timestamp and explanatory notes naming both SKUs. Record both `INVENTORY_STOCK_MOVEMENT_CREATED` audit entries with movement IDs, before/after balances, both identities and shared reference. Never update variant 182's balance.
- Before commit assert both legs, matching quantities, exact old/new balances, stable reserved totals and unchanged per-location total across both USB SKUs. Any failure, including audit failure, rolls back both legs and any new balance. Re-read after commit and retain the signed reconciliation. If commercial or public checks fail later, use the compensating procedure below.

Source: `Backend/src/controllers/inventoryStockMovementController.js:149–382`, `Backend/src/controllers/inventoryStockController.js:599–784`, `Backend/src/models/InventoryStockMovement.js:64–87`.

## 7. Historical records, open activity and media

Keep old item/variant IDs, SKU, cost, historical selling/method rows, stock movement history and all transaction foreign keys. An invoice reaches a product through `invoices.order_id → order_items.item_id/variant_id`. A warranty claim may additionally point to the original order line and invoice. Keep receipts and PO lines under the ordered/received SKU, and preserve product text and original charge amounts. Both old and new identifiers should remain resolvable for fulfillment, support, returns and reconciliation.

If live checks find pending orders, reserve or fulfill against the recorded SKU under the existing workflow and defer the transfer until reconciled. Do not release reservations because a listing is inactive. For open POs, agree how outstanding receipts will be booked before moving balances. For carts and unconsumed checkout sessions, let them expire or have the customer explicitly reselect USB 206 and obtain a fresh price/stock quote. Do not change a stored token, pending payment or accepted purchase under the customer. Resolve wishlist UX separately if entries appear; a page redirect does not update a wishlist, and reviews/verified-purchase relationships should retain their original item IDs.

Images **465** (primary, sort 1, 64,402 bytes) and **466** (sort 2, 48,434 bytes) are active under 166. The two local originals exist under the configured upload root at their recorded sizes. Their alt text describes the combined headset. The source item has zero images and videos. Keep these assets, order, URLs and alt text; do not duplicate the gallery or infer SKU-specific images. Physical connector depiction requires owner visual confirmation.

## 8. SEO and public cutover

- Retained canonical: `https://southwest.lk/product/r8-h01-3-5mm-usb-wired-gaming-headset-1f9e219d-defe-47d3-a102-02c1ff4c4665`
- Retired canonical path derived from its stored slug/UUID: `https://southwest.lk/product/r8-h01-usb-wired-gaming-headset-c8feeb55-99f0-4c15-a160-fe631d16f7c3`

Neither UUID occurs in the checked local `Frontend/Customer/public/sitemap.xml` or `dist/sitemap.xml`, and neither has a matching file/directory in the existing `dist/product` tree. This local build is not a reliable representation of the current catalog. The retained item **is** returned by the live local API. Rebuild from the approved post-cutover catalog into a clean release directory; verify exactly one retained sitemap entry, zero retired entries, one retained product snapshot and no retired snapshot or legacy directory index. Keep the existing canonical, metadata, shared default-variant Offer and static fallback purchase guard. Check that a rebuild has not unintentionally removed unrelated sitemap entries.

Proposed storefront Apache rule, in `Frontend/Customer/public/.htaccess` after storefront host/path exclusions and **before** generic product, host, HTTPS and static-snapshot rewrites. The fixed HTTPS destination also handles the supported aliases in one hop. Apache preserves the incoming query string by default; verify tracking queries and a clean destination canonical.

```apache
RewriteRule ^product/r8-h01-usb-wired-gaming-headset-c8feeb55-99f0-4c15-a160-fe631d16f7c3(?:/index\.html|\.html)?/*$ https://southwest.lk/product/r8-h01-3-5mm-usb-wired-gaming-headset-1f9e219d-defe-47d3-a102-02c1ff4c4665 [R=301,END,NC]
```

Test against a local/staging Apache host with automatic redirect following disabled: old canonical, trailing slash, `.html`, `/index.html`, query string and supported www/HTTP aliases must yield **301 → retained URL → 200**. Test JavaScript disabled, retained canonical and Product/Breadcrumb JSON-LD, unrelated product URLs and a random unknown UUID. Validate the host/CDN and any social-preview route serving crawler user agents separately before publishing the permanent response. Purge stale old HTML/sitemap caches through the normal release process. Do not implement a Vue-only redirect or redirect the retired variant API to another item's data.

Sources: `Frontend/Customer/public/.htaccess:8–64`, `Frontend/Customer/scripts/generate-sitemap.mjs` (catalog pagination, `generateProductPages`, sitemap writes), `Frontend/Customer/tools/customer_release.py:105–129`, `Backend/src/utils/customerProductEligibility.js:7–42`.

## 9. Before-and-after verification queries

Run the following SELECTs on an authorized local/staging copy before execution and again from a **fresh** snapshot after commit. Archive both sets. Use the approved execution reference in the movement query when checking a particular cutover. Recheck current time and the application's effective-price window. No statement below changes catalog data.

```sql
SELECT i.id, i.item_code, i.public_id, i.slug, i.is_active AS parent_active,
       v.id AS variant_id, v.variant_sku, v.qb_item_code, v.is_active, v.is_default,
       JSON_UNQUOTE(JSON_EXTRACT(v.attributes,'$."Connector Type"')) AS connector
FROM items i JOIN item_variants v ON v.item_id=i.id
WHERE i.id IN (166,167) ORDER BY i.id,v.id;

SELECT item_id,variant_id,price_type,price,currency,is_active,effective_from,effective_to
FROM item_prices WHERE item_id IN (166,167) OR variant_id IN (182,183,206)
ORDER BY item_id,variant_id,price_type,id;
SELECT item_id,variant_id,payment_method,price,currency,is_active
FROM item_payment_prices WHERE item_id IN (166,167) OR variant_id IN (182,183,206)
ORDER BY item_id,variant_id,payment_method,id;

SELECT s.id,s.item_id,s.variant_id,l.code,l.location_type,l.is_active AS location_active,
       s.is_active,s.quantity_on_hand,s.quantity_reserved,
       s.quantity_on_hand-s.quantity_reserved AS available
FROM inventory_stock s JOIN inventory_locations l ON l.id=s.location_id
WHERE s.item_id IN (166,167) OR s.variant_id IN (182,183,206)
ORDER BY s.location_id,s.variant_id;
SELECT location_id,SUM(quantity_on_hand) AS usb_total,SUM(quantity_reserved) AS reserved
FROM inventory_stock WHERE variant_id IN (183,206) GROUP BY location_id;
SELECT id,item_id,variant_id,location_id,movement_type,quantity,reference_type,reference_id,created_at
FROM inventory_stock_movements WHERE item_id IN (166,167) OR variant_id IN (182,183,206)
ORDER BY id;
SELECT m.reference_id,m.location_id,m.variant_id,m.movement_type,m.quantity,
       COUNT(a.id) AS audit_events
FROM inventory_stock_movements m LEFT JOIN audit_logs a
 ON a.entity_type='inventory_stock_movement' AND a.entity_id=CAST(m.id AS CHAR)
 AND a.action='INVENTORY_STOCK_MOVEMENT_CREATED'
WHERE m.reference_type='catalog_reclassification' AND m.variant_id IN (183,206)
GROUP BY m.id,m.reference_id,m.location_id,m.variant_id,m.movement_type,m.quantity;

SELECT ci.item_id,ci.variant_id,c.status,COUNT(*) AS cart_lines
FROM cart_items ci JOIN carts c ON c.id=ci.cart_id
WHERE ci.item_id IN (166,167) OR ci.variant_id IN (182,183,206)
GROUP BY ci.item_id,ci.variant_id,c.status;
SELECT item_id,variant_id,COUNT(*) AS live_direct_sessions FROM customer_checkout_sessions
WHERE (item_id IN (166,167) OR variant_id IN (182,183,206))
 AND consumed_at IS NULL AND expires_at>CURRENT_TIMESTAMP GROUP BY item_id,variant_id;
SELECT j.item_id,j.variant_id,COUNT(*) AS live_guest_lines FROM guest_checkout_sessions g
JOIN JSON_TABLE(JSON_UNQUOTE(g.cart_items),'$[*]' COLUMNS
 (item_id BIGINT PATH '$.item_id',variant_id BIGINT PATH '$.variant_id')) j ON TRUE
WHERE g.consumed_at IS NULL AND g.expires_at>CURRENT_TIMESTAMP
 AND (j.item_id IN (166,167) OR j.variant_id IN (182,183,206))
GROUP BY j.item_id,j.variant_id;

SELECT oi.item_id,oi.variant_id,o.status,o.payment_status,o.fulfillment_status,
       COUNT(DISTINCT oi.id) AS order_lines,COUNT(DISTINCT inv.id) AS invoices
FROM order_items oi JOIN orders o ON o.id=oi.order_id
LEFT JOIN invoices inv ON inv.order_id=o.id
WHERE oi.item_id IN (166,167) OR oi.variant_id IN (182,183,206)
GROUP BY oi.item_id,oi.variant_id,o.status,o.payment_status,o.fulfillment_status;
SELECT p.status,pi.item_id,pi.variant_id,pi.quantity_ordered,pi.quantity_received,pi.unit_cost
FROM purchase_order_items pi JOIN purchase_orders p ON p.id=pi.purchase_order_id
WHERE pi.item_id IN (166,167) OR pi.variant_id IN (182,183,206);
SELECT r.status,ri.item_id,ri.variant_id,ri.quantity_received,ri.unit_cost
FROM goods_receipt_items ri JOIN goods_receipts r ON r.id=ri.goods_receipt_id
WHERE ri.item_id IN (166,167) OR ri.variant_id IN (182,183,206);
SELECT 'wishlist' AS relation_name,COUNT(*) AS n FROM wishlists WHERE item_id IN (166,167)
UNION ALL SELECT 'review',COUNT(*) FROM product_reviews WHERE item_id IN (166,167)
UNION ALL SELECT 'claim',COUNT(*) FROM warranty_claims WHERE product_id IN (166,167)
 OR order_item_id IN (SELECT id FROM order_items WHERE item_id IN (166,167) OR variant_id IN (182,183,206))
UNION ALL SELECT 'image',COUNT(*) FROM item_images WHERE item_id IN (166,167)
UNION ALL SELECT 'video',COUNT(*) FROM item_videos WHERE item_id IN (166,167)
UNION ALL SELECT 'promotion item',COUNT(*) FROM promotion_items WHERE item_id IN (166,167)
UNION ALL SELECT 'campaign item',COUNT(*) FROM discount_campaign_items WHERE item_id IN (166,167);
```

**Release acceptance.** For the observed baseline expect exactly two new movements and two linked movement audits, one destination balance, source/destination USB total still 5 at ONLINE-001, 3.5MM balance still 5 and all historical counts/amounts intact. Source stays absent from the public list and its variants GET remains 404. The retained variant response must return exactly 182 and 206 with selling prices 4,000, actual per-SKU stock and the four independently approved method prices. Verify default 182, then click USB, then 3.5MM. Confirm SKU, connector, quantity cap and each amount follow the ID, and the canonical stays fixed. Verify signed-in and guest cart lines and non-paying checkout quotes in isolated fixtures. Phase B's earlier fixture pass establishes picker capability; these after-state checks have not been executed on a consolidated catalog.

## 10. Rollback and outstanding decisions

**Before stock commit:** roll back the open transaction on any mismatch. If Admin staged prices or media before the failure, compare to the saved baseline and disable only the newly introduced commercial entries through supported controls, or use an approved scoped compensating transaction where an independent method-price status cannot be restored in Admin. Leave both original product identities and all historical rows intact.

**After stock commit:** hold affected writes. Reconcile fresh on-hand, reservations, sales, open orders and receipt activity. If the transferred units are still free and traceable, use the same locked, audited procedure in reverse with a **new reversal reference** linked to the original. Debit 206 and credit 183 at the same location, append both legs and confirm conserved USB totals. Never delete original movements or overwrite stock from the old snapshot. If units have sold, been reserved or been returned, keep orders/invoices/warranties under the actual sold SKU and reconcile only the physically available remainder with the inventory owner. Disable new purchasing where necessary; use forward correction for fulfilled units. Restore only the pricing/status changes actually made. The observed pre-cutover state for 167 **and** 183 is inactive.

**Web rollback:** retain the previous release manifest, HTML and Apache config. If the retained page remains valid, keep the redirect while correcting stock or price. If a web rollback is necessary, restore the coordinated release and purge affected caches. A 301 already cached by browsers cannot reliably be withdrawn; validate the destination and stage the redirect before publishing. Do not point the retained canonical back to an inactive listing.

**Outstanding approvals:** actual USB count/location and absence of commitments; cost and four method prices; effective date/window; acceptance of the shared USB accounting code and two retained photos; operator/reference and one-off paired-transfer authority; redirect/release owner. No schema change, consolidation execution, price entry, stock movement, code edit or deployment was performed in this investigation.
