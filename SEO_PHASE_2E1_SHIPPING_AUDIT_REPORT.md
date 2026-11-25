# SEO Phase 2E.1 Shipping Structured Data Report

## 1. Status

Shipping implementation audit completed.
Shipping structured data implementation deferred.

No application changes or production deployment.

## 2. Objective

Evaluate the feasibility of accurate shippingDetails
structured data for South West merchant listings.

## 3. Existing shipping calculation

The shared prepaidDeliveryPricingService calculates:

billableKg = max(1, ceil(totalWeightKg))

deliveryCharge =
    firstKgCharge +
    (billableKg - 1) * additionalKgCharge

Charges are rounded to two decimal places.

## 4. Payment-dependent pricing

Prepaid methods:
- Card
- Koko
- Mintpay

Prepaid pricing uses database-configured Colombo or
outside-Colombo first kilogram charges and a shared
additional kilogram charge.

Cash on delivery uses area-specific first kilogram
and additional kilogram charges.

## 5. Database model defaults

- Colombo first kilogram: LKR 450
- Outside Colombo first kilogram: LKR 550
- Additional kilogram: LKR 100

These are model defaults only.
Current production values were not verified.

## 6. Inspected source files

- Backend/src/services/prepaidDeliveryPricingService.js
- Backend/src/models/DeliveryDistrict.js
- Backend/src/models/DeliveryArea.js
- Backend/src/models/PrepaidDeliverySetting.js
- Backend/src/controllers/prepaidDeliverySettingController.js
- Backend/src/routes/deliveryAreaRoutes.js
- Backend/src/routes/deliveryDistrictRoutes.js
- Frontend/Customer/src/utils/structuredData.js
- Frontend/Customer/scripts/generate-sitemap.mjs

## 7. Structured data findings

Static and runtime Product Offer schemas currently
omit shippingDetails.

An existing runtime Organization schema is available.

Organization-level ShippingService is a potential
future implementation approach.

Compatibility with the complete payment-dependent
pricing model has not been established.

## 8. Implementation blockers

- Dynamic database-configured shipping charges.
- Payment-dependent pricing.
- Area-specific cash-on-delivery charges.
- Unverified production pricing values.
- Unverified geographical service coverage.
- Unverified numerical delivery timeframes.
- Static snapshot freshness after pricing changes.
- Protected prepaid pricing configuration endpoint.

## 9. Implementation decision

Defer shipping structured data for the current release.

Do not:
- Hardcode database model defaults as actual rates.
- Invent delivery timeframes.
- Advertise unverified free shipping.
- Weaken protected endpoint permissions.
- Modify checkout solely for SEO.
- Introduce additional shipping infrastructure.

Preserve existing valid Product structured data.

The optional shippingDetails warning may remain.

## 10. Future implementation requirements

- Verify current production delivery configuration.
- Verify supported service destinations.
- Establish accurate delivery timeframes.
- Confirm supported payment-dependent representation.
- Establish structured data freshness strategy.
- Validate static and runtime schema consistency.
- Evaluate Merchant Center shipping configuration.

## 11. Deployment status

No application source modifications.
No database queries or writes.
No API requests.
No Admin changes.
No backend changes.
No build executed.
No production deployment.

## 12. Next phase

Phase 2E.2: Return policy structured data optimization.
