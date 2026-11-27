# Standard bulk product import · specification support

The existing Standard download, upload, preview, confirmation and retry workflow now accepts three input sheets. A Specifications row with an empty Variant Name creates a shared product fact. A named variant receives the fact in its existing attributes. Specifications are optional, including for older workbooks. The Standard API, permissions and database schema retain their existing contracts.

[Open the standalone review workbook](Standard_Specifications_Review.xlsx). It contains two synthetic products, three interleaved variants and three example facts. Use it for Excel review. For an actual registration, download a fresh template with your own catalog references.

## Failure analysis and baseline

The removed approach reportedly materialized 250,000–500,000 helper formulas before Node reached about 2 GB of heap. A separate output cell for every candidate variant of every input row makes workbook construction grow quadratically. ExcelJS must also assemble styles, cell models and ZIP/XML output. The current checkout contained the temporary populated-sheet rejection and the Product Name dropdown. It did not contain the failed generator or a heap snapshot. The historical memory figure comes from the incident description.

The opening template generated successfully at the default heap limit. Three of the initial 38 focused tests failed because their expected download structure still omitted the existing Specifications sheet. The original unversioned fixture remains independent and retains its old sheet structure.

Before integration, a small FILTER workbook was written and its XLSX parts inspected. ExcelJS 4.4.0 serialized the FILTER expression as an array formula and preserved a literal D2# validation expression. It emitted neither a worksheet cell metadata index nor an xl/metadata.xml part. That round trip established formula storage only. Excel distinguishes legacy fixed-size arrays from dynamically resizing spills. The shipped implementation uses ordinary scalar formulas and named ranges. [Microsoft’s explanation of dynamic and legacy array behavior](https://support.microsoft.com/en-US/Excel/dynamic-array-formulas-and-spilled-array-behavior) · [Standalone experimental probe](/private/tmp/sw-standard-spec.Z78ryP/FILTER-probe.xlsx)

## Dropdown architecture

Products and Variants retain their original column order. Specifications uses Product Name, Variant Name, Specification and Value in A–D. Its 500 entry rows use the existing very-hidden validation sheet.

| Selection | Source and behavior |
|---|---|
| Product Name | Existing ProductNames range on Products. Names identify products within this workbook. |
| Variant Name | Helper H assigns each usable variant a numeric key combining its parent’s position and its own position. I uses SMALL and INDEX to assemble one grouped list. J records each parent’s contiguous slice using counts of keys in its interval. The selected parent picks that slice. Interleaved source rows retain their relative order within a group. Blank parents and empty groups lead to an empty list. |
| Specification | K looks up the selected product’s type. The issued type-label table resolves that label to an ID-derived named range with only its active assigned definitions. MATCH inputs escape Excel wildcard characters. The visible headings stay human-readable. |
| Value | The chosen definition indexes an adjacent range-name column. Selects point to worksheet-backed approved options shared by definition ID. Booleans point to Yes/No. Other types have an empty choice list and allow direct entry. Because all six types share one physical Value column, Excel allows typing in it. The server independently rejects unapproved Select values and invalid typed values. |

Only H–K contain helper formulas. Each has 500 formulas, giving **2,000 total**, of which 500 produce the grouped variant names. Static lists grow with actual assignments and distinct approved option sets. There is no precomputed product-by-variant grid. Excel still performs bounded range scans during recalculation. The generation measurements below do not measure Excel’s recalculation time.

The visible type is taken from Products. Type-to-specification and definition-to-option relationships are keyed by database identities in hidden named ranges. Excel and the server normalize ordinary repeated spaces, nonbreaking spaces, ASCII control characters, zero-width spaces and byte-order marks for the type-label lookup. An ambiguous normalized item type blocks generation or validation. A fixture with a nonbreaking space in “Laptop RAM” resolved correctly during an actual database import. The original two offending cell values were unavailable, so their exact historical character difference remains unknown.

## Validation, preview and storage

The parser recognizes an optional Specifications sheet, checks its four headers and validates up to 500 populated specification rows alongside the existing 500 combined Products and Variants rows. Empty or absent sheets preserve legacy deferral of required specifications. A supplied zero or No is a value. An obsolete sheet named Variant Specifications continues to produce the existing error.

Each supplied row must match an uploaded product, an optional variant belonging to that product, and one active definition assigned to that active item type. Duplicate product/definition and variant/definition pairs are rejected. Wrong parent selections, pasted values, stale choices and formula cells produce worksheet, row and column errors. The preview shows product facts separately from each variant’s facts. The existing error download lists the same issues.

The importer reuses readOptions and the manual specification value validator. Selects require exact approved literals. Booleans accept Yes/No and the existing true/false or 1/0 forms and store canonical true/false strings. Whole numbers require integer values, decimals require finite numeric input, and dates must be valid ISO calendar days or Excel date cells representing a day. Free text goes through the existing value check and a storage-byte limit. A numeric-looking code that must retain leading zeros belongs in a text specification.

On confirmation, validation runs again against the current database. Inside each product transaction the importer locks and rechecks relevant active assignments, definition names, types and option membership. It writes common facts through ItemSpecificationValue and supplies variant facts through ItemVariant.attributes. Existing price and stock writes share that transaction. A failed product can be retried through the existing failed-row selection. Standard’s existing process-local token lifetime and restart behavior still apply.

## Measurements and tests

| Fixture | Generated XLSX | Generation time | Peak process RSS |
|---|---:|---:|---:|
| Opening template, small reference fixture | 29,567 bytes | 433 ms including service loading | 139,280 KiB |
| Updated template, two types and six definitions | 47,532 bytes | 162 ms | 136,816 KiB |
| Updated template, 50 types, 1,200 assignments, 24 shared Select definitions with 100 options each | 77,204 bytes | 200 ms | 152,032 KiB |

These are single local measurements, using default Node heap settings. Updated timings cover template creation and XLSX serialization after service loading. Peak RSS includes the runtime and libraries. The filled standalone review workbook is 47,860 bytes and was reopened after writing.

| Verification | Result |
|---|---|
| Backend Standard workbook, HTTP, audit, confirmation, retry, specification, stock, price, checkout and related regression suites | **89 passed**. Zero failures, skips or cancellations. Includes existing and new tests. |
| Admin Node tests | **22 passed**. Zero failures, skips or cancellations. |
| Admin production build, backend syntax and Git whitespace checks | Passed. Build output was directed outside the working tree. |
| Actual workbook limits | One product, 499 variants and 500 distinct specification rows validated together. A 501st populated specification row was rejected. Existing HTTP tests cover the compressed upload limit. |
| Database evidence | Disposable MySQL exercised the actual Standard generator, parser, catalog models, hooks, transactions and item-code helper. A deliberate failure after a stock movement rolled back the second product including specifications, variants, prices, balance and movement. The first product retained both variants, both balances and its two receipts. Retrying only the failed product produced exactly one additional receipt and the correct common value. Deactivating a definition subsequently invalidated its workbook row. |
| Desktop Excel for Mac | Opened an isolated copy. Product Name offered both demo products. Demo Memory offered 8 GB and 16 GB, Demo Headset offered only Wired, and switching the parent recalculated the list. RAM offered Memory Type and Capacity (GB). Memory Type offered DDR4/DDR5 and Microphone offered Yes/No. Typing 32 into the numeric field succeeded. Edits were discarded on the test copy. The initial scripting attempt timed out during local file access and Excel showed an Adobe add-in error. The interactive checks subsequently succeeded. |
| Compatibility limits | Automated workbook write/read and desktop dropdown interaction were tested separately. A desktop-edited workbook save/re-upload into a real staff catalog, other Excel versions, and third-party spreadsheet clients remain unverified. No production data was used. |

The new server tests also exercise malformed dates, zero, No, fractional numbers, unknown products, foreign variants, stale options, duplicates, literal error locations, shared facts and interleaved per-variant facts. The existing registered HTTP tests use real requests with fixture persistence. The rollback result above comes from persisted MySQL row counts.

Final Backend command from Backend, with test database defaults pointed at loopback port 1 and three opt-in fixture socket variables set to the disposable server:

~~~sh
node --test src/tests/{bulkProductImport*,bulkSpecificationImport*,standardProduct*,specificationOptions*,variantPriceManagement.mysql,inventoryStockController.variant,itemNewFlag,itemVariantPagination,variantCartReview,customerCheckoutController.variant,goodsReceiptController.variant}.test.js
~~~

## Files changed

| Path | Change |
|---|---|
| Backend/src/services/bulkSpecificationWorkbook.js | Compact workbook helpers, named ranges and dependent validation. |
| Backend/src/services/bulkSpecificationImport.js | Active assigned-definition reads, typed rows, issue mapping and transactional recheck. |
| Backend/src/services/specificationValue.js | Existing manual value validator extracted for use by both paths. |
| Backend/src/controllers/itemSpecificationValueController.js | Imports and continues to expose the shared validator. |
| Backend/src/services/bulkProductImportService.js | Template integration, optional worksheet parsing, preview, transactional specification persistence and instructions. |
| Backend/src/controllers/bulkProductImportController.js | Includes specification rows in audit counts. |
| Frontend/Admin/src/pages/products/BulkProductImport.vue | Instructions and product/variant specification preview in the existing page. |
| Backend/src/tests/bulkSpecificationImport.test.js | Real XLSX validation, range, capacity and persistence-call regression tests. |
| Backend/src/tests/bulkSpecificationImport.mysql.test.js | Actual per-product commit, rollback, retry and stale-definition tests. |
| Backend/src/tests/bulkProductImportWorkbook.test.js | Updates the generated-sheet contract and reference query fixture. |
| Backend/src/tests/standardProductWorkbook.test.js | Checks the additive sheet while preserving the existing header, range and legacy fixture assertions. |
| Backend/src/tests/standardProductHttp.test.js | Updates the download contract. The older uploaded fixture and its error-workbook contract remain intact. |
| Backend/src/tests/fixtures/standardProductWorkbook.js | Adds the empty assignment-query double to the existing harness. |
| docs/Standard_Specifications_Review.xlsx | Standalone fixture workbook for manual review. |
| docs/SPECIFICATION_BULK_IMPORT_REPORT.md | Implementation and verification evidence. |

## Manual Excel check

1. Open the review workbook in Excel for Mac. Select Specifications B3. Its parent is Demo Memory. Verify the two sizes are available and the headset variant is absent.
2. Select C3 and D2. Verify the RAM definitions and DDR4/DDR5 values. Select D4 and check Yes/No.
3. Change A4 to Demo Memory. Open B4 and check that the choices change. Excel can retain previously entered child values after a parent changes. Reselect the child fields. Upload validation catches stale combinations.
4. In a fresh template issued by an isolated test catalog, leave Variant Name blank for one product fact and select a particular variant for another. Try zero, No, an ISO date and an invalid pasted option. Check the preview and error download, correct the value and confirm.
5. Open product administration to verify the shared value and the selected variant’s attributes. Check prices, location and opening receipt. Use an isolated catalog for this step.

## Rollback and working-tree integrity

The opening branch was integration/complete-project at 3565ce64c80c3b9ef6b2e00f6c64e16aabde5f4d. The 47 opening status entries included unrelated sales and cleanup work. Targeted opening copies for every edited existing file, opening status, diff and hashes are under `/private/tmp/sw-standard-spec.Z78ryP`. The opening tracked binary diff SHA-256 was `0cf89ca75f8680075dc5e05b3e75ed6a309510e0e8b8445bd8b0feebb6d5c49a`. Nothing was staged, committed, pushed or deployed.

To roll back this change, first save any subsequent edits. Compare each existing file in the table against its corresponding path under the backup directory. Revert only this feature’s changes, retaining subsequent or unrelated hunks. For files exclusive to this implementation, archive those listed above before removing them. Restoring the opening importer also restores its temporary populated-sheet rejection. Keep a durable copy of the targeted backups if rollback will be needed after temporary-directory cleanup. The change requires no migration or schema rollback. Reverting application code does not reverse already committed catalog records.
