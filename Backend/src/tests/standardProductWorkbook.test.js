'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
const { workbook, harness, sheetNames, productHeaders, variantHeaders } = require('./fixtures/standardProductWorkbook');

test('V1 download matches independent headings, samples, reference lists and validation ranges', async () => {
    const { service } = harness();
    const book = new ExcelJS.Workbook();
    const bytes = await service.template();
    await book.xlsx.load(bytes);
    assert.deepEqual(book.worksheets.map(s => s.name), [...sheetNames.slice(0, 2), 'Specifications', ...sheetNames.slice(2)]);
    const [products, variants, specifications, validation, instructions, lists] = book.worksheets;
    assert.deepEqual(specifications.getRow(1).values.slice(1), ['Product Name', 'Variant Name', 'Specification', 'Value']);
    assert.equal(validation.state, 'veryHidden');
    assert.deepEqual(products.getRow(1).values.slice(1), productHeaders);
    assert.deepEqual(variants.getRow(1).values.slice(1), [...variantHeaders, 'Color 1 Name', 'Color 1 HEX', 'Color 2 Name', 'Color 2 HEX']);
    assert.deepEqual(products.getRow(2).values.slice(1), ['Example product', 'Accessories', 'Example',
        'Cable type', 'Each', '', 'New', 1, 'Replace this example description', 'Active', 'No']);
    assert.deepEqual(variants.getRow(2).values.slice(1), ['Example product', 'Standard', 100, 150, 150, 155, 160, 160, 0, 0, '', 'Yes', '']);
    assert.equal((await service.parseAndValidate(bytes)).counts.valid, 1);
    assert.deepEqual(instructions.getRow(1).values.slice(1), ['Step', 'What to do']);
    assert.deepEqual(lists.getRow(1).values.slice(1,8), ['Categories', 'Brands', 'Item Types', 'Units of Measure', 'Warranties', 'Conditions', 'Stock Locations']);
    assert.deepEqual(lists.getRow(2).values.slice(1,8), ['Accessories', 'Example', 'Cable type', 'Each', 'One year', 'New', 'Online']);
    const ranges = Object.fromEntries(book.definedNames.model.map(entry => [entry.name, entry.ranges]));
    assert.deepEqual(Object.fromEntries(Object.entries(ranges).filter(([name]) => !name.startsWith('SW_'))), {
        CategoryList: ["'_Validation'!$A$2"], BrandList: ["'_Validation'!$B$2"], ItemTypeList: ["'_Validation'!$C$2"],
        UnitList: ["'_Validation'!$D$2"], WarrantyList: ["'_Validation'!$E$2"], ConditionList: ["'_Validation'!$F$2:$F$6"],
        LocationList: ["'_Validation'!$G$2"], ProductNames: ['Products!$A$2:$A$501']
    });
    for (const [sheet, columns] of [
        [products, { B: '=CategoryList', C: '=BrandList', D: '=ItemTypeList', E: '=UnitList', F: '=WarrantyList',
            G: '=ConditionList', J: '"Active,Inactive"', K: '"Yes,No"' }],
        [variants, { A: '=ProductNames', K: '=LocationList', L: '"Yes,No"' }]
    ]) {
        for (const [column, formula] of Object.entries(columns)) {
            for (let row = 2; row <= 501; row++) {
                const rule = sheet.getCell(column + row).dataValidation;
                assert.equal(rule.type, 'list');
                assert.deepEqual(rule.formulae, [formula]);
            }
            assert.equal(sheet.getCell(column + '502').dataValidation, undefined);
        }
    }
    for (const row of [2, 501]) {
        assert.equal(products.getCell('H' + row).dataValidation.operator, 'greaterThan');
        assert.equal(variants.getCell('J' + row).dataValidation.operator, 'greaterThanOrEqual');
    }
});

test('V1 resolves interleaved rows and writes each amount and receipt for its owning SKU', async () => {
    const { service, writes } = harness();
    const result = await service.importProducts(await workbook().xlsx.writeBuffer(), 17);
    assert.deepEqual([result.imported, result.failed], [2, 0]);
    assert.deepEqual(writes.Item.map(p => [p.item_name, p.is_active, p.is_new]), [['Cable', true, true], ['Adapter', false, false]]);
    assert.deepEqual(writes.ItemVariant.map(v => [v.item_id, v.variant_sku, v.is_default, v.is_active, v.attributes]), [
        [1, 'SWV-000001-Short', false, true, {}], [1, 'SWV-000001-Long', true, true, {}], [2, 'SWV-000002-Single', true, false, {}]
    ]);
    assert.deepEqual(writes.ItemPrice.map(p => [p.item_id, p.variant_id, p.price_type, p.price, p.is_active]), [
        [1, 1, 'cost', 1.01, true], [1, 1, 'selling', 2.22, true], [1, 2, 'selling', 4, true], [2, 3, 'selling', 0, false]
    ]);
    const amounts = [[2.23, 2.24, 2.25, 2.26], [4, 4, 4, 4], [0, 0, 0, 0]];
    for (const variant of writes.ItemVariant) {
        const prices = writes.ItemPaymentPrice.filter(p => p.variant_id === variant.id);
        assert.deepEqual(prices.map(p => p.price), amounts[variant.id - 1]);
        assert.deepEqual(prices.map(p => p.payment_method), ['cash', 'card', 'koko', 'mintpay']);
        assert.ok(prices.every(p => p.item_id === variant.item_id && p.is_active === variant.is_active && p.currency === 'LKR'));
    }
    assert.deepEqual(writes.InventoryStock.map(s => [s.item_id, s.variant_id, s.location_id, s.quantity_on_hand, s.reorder_quantity]),
        [[1, 1, 1, 3.125, 1.5], [2, 3, 1, 0, 2]]);
    assert.deepEqual(writes.InventoryStockMovement.map(m => [m.item_id, m.variant_id, m.location_id, m.quantity, m.movement_type, m.reference_type]),
        [[1, 1, 1, 3.125, 'goods_receipt', 'bulk_product_import']]);
});

test('V1 defers required specifications but still needs explicit variants and valid amounts', async () => {
    const { service, models } = harness();
    models.ItemTypeSpecification = { findAll: async () => [{ item_type_id: 1, is_required: true, specification_id: 9 }] };
    const book = workbook();
    const parse = async () => service.parseAndValidate(await book.xlsx.writeBuffer());
    assert.equal((await parse()).counts.valid, 2);
    book.getWorksheet('Variants').spliceRows(3, 1);
    book.getWorksheet('Variants').getCell('D2').value = 3.123;
    const parsed = await parse();
    assert.match(parsed.products[0].errors.join(' '), /Selling Price/);
    assert.match(parsed.products[1].errors.join(' '), /at least one variant/);
});

test('V1 tolerates header case, surrounding spaces, unrelated sheets and trailing columns', async () => {
    const book = workbook();
    book.getWorksheet('Products').getCell('A1').value = '  PRODUCT NAME ';
    book.getWorksheet('Variants').getCell('B1').value = ' variant name ';
    book.getWorksheet('Products').getCell('L1').value = 'Product Ref';
    book.addWorksheet('Personal Notes').getCell('A1').value = 'personal notes';
    book.addWorksheet('Version').getCell('A1').value = 9;
    assert.equal((await harness().service.parseAndValidate(await book.xlsx.writeBuffer())).counts.valid, 2);
});

test('V1 enforces the combined 500-row boundary', async () => {
    const book = workbook();
    const variants = book.getWorksheet('Variants');
    for (let n = 5; n < 500; n++) variants.addRow(['Cable', 'Size ' + n, '', 1, 1, 1, 1, 1]);
    const { service } = harness();
    assert.equal((await service.parseAndValidate(await book.xlsx.writeBuffer())).counts.valid, 2);
    variants.addRow(['Cable', 'Last', '', 1, 1, 1, 1, 1]);
    await assert.rejects(service.parseAndValidate(await book.xlsx.writeBuffer()), /500 total data rows/);
});

test('malformed Standard workbooks retain their Standard header error', async () => {
    const book = workbook();
    book.getWorksheet('Variants').getCell('A1').value = 'Unknown';
    await assert.rejects(harness().service.parseAndValidate(await book.xlsx.writeBuffer()), /Invalid headers in Variants/);
});
