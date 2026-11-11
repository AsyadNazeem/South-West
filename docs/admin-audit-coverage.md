# Admin audit logging coverage review

Review date: 2026-11-11

## Scope and method

Reviewed the shared audit model, migration, service, controller, routes, and Admin page. Searched backend controllers and services for `recordAuditLog` calls and related wrappers, then inspected mutation routes and the bulk product import and notification controllers. This report describes code-path coverage, not a runtime guarantee. The supplied request ends after the website theme requirement, so later categories were not assumed.

## Existing audit architecture

- `AuditLog` stores actor user ID, action, module, entity type/ID, description, old/new JSON values, IP, user agent, request ID and creation timestamp. The existing migration creates this table.
- `auditLogService.recordAuditLog` is the single write path, supports the caller's transaction, and redacts sensitive-key values. It does not sanitize sensitive free-text values, so callers must choose safe descriptions and metadata.
- `auditLogController` provides paginated filtering and joins the actor email. Its route is protected by `audit_logs.view`; the Admin page displays actor, action, module, entity, description, network metadata and value snapshots.
- Most transactional mutation controllers write the audit event in the same transaction as the mutation. A failed transaction consequently leaves no success event; failed login paths are handled separately. There is no general failed-operation event wrapper.

## Coverage by area

| Area | Current coverage | Gaps / limitations |
| --- | --- | --- |
| Authentication and sessions | Admin auth and session controllers contain audit calls; user/session security operations have audit coverage. | Verify event-by-event behavior for failed authentication and logout; no global failed-mutation mechanism. Avoid expanding failure logging without rate limiting. |
| Admin users, roles, permissions | User, role, user-role and role-permission controllers contain audit calls. | Confirm each deletion/deactivation variant retains a corresponding event; coverage is implemented in controller paths rather than enforced centrally. |
| Catalogue | Items, brands, categories, variants, images, videos, pricing, payment pricing, specifications, type/specification links, warranties, units, colors, and campaign frames have audit calls. | Bulk product imports have an aggregate summary and transactional record events. No other spreadsheet import route was found in Admin. |
| Inventory and purchasing | Inventory stock/movements/locations, receipts and receipt items, suppliers, purchase orders and purchase order items have audit calls. | Coverage appears action-specific; audit logs inside imports can create many records per workbook. |
| Orders and payments | Order status, order/item/address/promotion, payment and delivery controllers contain audit calls. Invoice and some auxiliary order paths need action-level confirmation; an audit-call count alone does not establish full mutation coverage. | Manual payment/refund and invoice action completeness should be checked against each handler before asserting complete coverage. |
| Promotions and discounts | Promotion, discount campaign, promotion item/category controllers contain audit calls. | Activation/schedule paths require handler-level confirmation; no central enforcement. |
| Delivery and shipping | Delivery, delivery area/district and prepaid delivery settings contain audit calls. | Configuration event completeness is action-specific. |
| Website content and configuration | Homepage banners and website theme administration contain audit calls. | Campaign visual frame controller also contains audit calls. |
| Customer-facing account/cart actions | Customer/account, cart, wishlist, review and preference controllers contain audit calls in multiple paths. | These are not necessarily administrator actions and should remain distinguishable by module/actor. |
| Bulk import | One Admin spreadsheet import was found: product/variant `.xlsx`, with validation and explicit confirmation. Import service emits transactional record events, and the controller records an aggregate import summary. | Summary data uses safe row counts, a sanitized filename, outcome, and duration. No bulk stock, price, customer, or master-data import route was found. |
| Customer notification management | Staff notification create/update/delete are audited transactionally. | Audit snapshots retain title and message lengths, not their content. These are one-customer CRUD actions; no publish, schedule, broadcast, or bulk-send API was found. |
| Admin notification feed/settings | Admin preference, read, and dismiss actions are audited; system-generated notification fanout is not logged as an administrative action. | Preference events remain separate from system-generated feed records. |

## Implementation priorities

1. The product import emits an aggregate event with a sanitized filename, safe row and outcome counts, duration, and request metadata. Business transactions remain independent of aggregate audit-write failure, and audit events do not store spreadsheet values.
2. Notification audit snapshots omit title and message content while retaining their lengths and other safe metadata. Admin feed read and dismiss changes have separate audit events; customer notifications and automated system events remain separate paths.
3. Revisit lower-priority action completeness per mutation handler in any follow-up review; this pass found broad coverage across the listed modules but cannot infer full coverage from presence of calls alone.

## Known limits

The frontend audit page exposes value snapshots and descriptions, so privacy depends on safe caller payloads as well as key redaction. Audit writes in existing transactional paths can fail the associated business mutation. The bulk import summary is best-effort, so audit storage availability does not change import outcomes. The brief supplied for this review is truncated after website theme changes.
