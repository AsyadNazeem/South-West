# SEO Phase 2E.4 Product Identifier and Specification Audit

## 1. Status

Source audit completed.
Existing SKU and brand markup retained.
Additional identifier implementation deferred.

## 2. Audit scope

- 267 source files inspected.
- 29 files containing identifier references.
- Read-only source inspection.

## 3. Existing identifiers

Item.js defines item_code as a mandatory,
unique string with a maximum length of 50 characters.

itemVariantController.js generates internal variant
SKUs using the SWV prefix and item/variant information.

Neither internal item codes nor generated variant
SKUs establish manufacturer-issued identifiers.

## 4. Existing structured data

Both static and runtime Product schema generators
already publish:

- Product name.
- Product description.
- Product image.
- Internal SKU.
- Brand.
- Offer information.
- LKR currency.

Existing SKU and brand behavior will be retained.

## 5. Manufacturer identifiers

No verified GTIN or MPN source was established
during the source and catalog audits.

Do not:

- Convert internal SKUs into GTINs.
- Convert internal SKUs into MPNs.
- Treat all model numbers as manufacturer part numbers.
- Invent identifiers to eliminate optional warnings.

## 6. Product specifications

Existing infrastructure includes:

- ItemSpecification.
- ItemSpecificationValue.
- Variant attributes.
- Public variant specification information.

The earlier editorial audit identified conflicting
technical specifications and model information.

Automatic model and additionalProperty markup
is deferred until catalog accuracy is verified.

## 7. Previous catalog baseline

- 143 active products.
- 68 products with model information in descriptions.
- 105 products with model information in variants.
- 109 products with model information in either source.
- 124 products with variant attributes.
- No verified GTIN or MPN availability established.

These are historical Phase 2A measurements,
not fresh production measurements.

## 8. Product schema consistency findings

Static and runtime generators differ in:

- Price fallback behavior.
- Unknown stock handling.
- Boolean-only stock handling.
- Image URL validation.
- Product description normalization.

These are confirmed source implementation differences,
not independently verified production errors.

Phase 2H must evaluate static and runtime consistency,
including default variant price and availability.

Any confirmed material inaccuracies should be resolved
before production deployment.

## 9. Implementation decision

Retain existing SKU and brand structured data.

Defer:

- GTIN.
- MPN.
- Model.
- Additional technical specification markup.

Future implementation requires verified product-level
or variant-level data that matches visible page content.

## 10. Limitations

Previously reported optional global identifier warnings
may remain.

No fresh production catalog measurement was performed.

Manufacturer identifiers were not independently
verified against packaging or manufacturer records.

## 11. Scope restrictions

No application source modifications.
No new database columns.
No new Admin forms.
No backend changes.
No API requests.
No database queries.
No build executed.
No production deployment.

## 12. Next phase

Phase 2F: Category and brand optimization.
