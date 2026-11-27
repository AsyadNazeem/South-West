'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
const { workbook, harness } = require('./fixtures/standardProductWorkbook');
const { HEADERS, typeLabel } = require('../services/bulkSpecificationWorkbook');

const definitions = ['select', 'boolean', 'number', 'decimal', 'date', 'text'].map((data_type, i) => ({
    item_type_id: 1, specification: { id: i + 1, name: data_type, data_type, options: data_type === 'select' ? '["USB","Cable"]' : [] }
}));
function fixture(rows) {
    const book = workbook(), { service, models, writes } = harness();
    const sheet = book.addWorksheet('Specifications'); sheet.addRow(HEADERS);
    rows.forEach(row => sheet.addRow(row));
    models.ItemTypeSpecification.findAll = async () => definitions;
    const common = [];
    models.ItemSpecificationValue = { create: async (value, options) => common.push([value, options]) };
    return { book, service, common, writes, models, sheet };
}

test('all six typed facts bind to the selected scope and survive import with interleaved variant rows', async () => {
    const { book, service, common, writes } = fixture([
        ['Cable', '', 'select', 'USB'], ['Cable', 'Long', 'boolean', 'No'], ['Cable', 'Short', 'number', 0],
        ['Adapter', 'Single', 'decimal', -1.25], ['Cable', '', 'date', new Date('2024-02-29')], ['Cable', '', 'text', 'Finish']
    ]);
    const bytes = await book.xlsx.writeBuffer();
    const preview = service.summary(await service.parseAndValidate(bytes));
    assert.deepEqual(preview.workbookErrors, []); assert.equal(preview.counts.specifications, 6);
    assert.deepEqual(preview.rows[0].specifications.map(s => s.value), ['USB', '2024-02-29', 'Finish']);
    assert.equal(preview.rows[0].variants[1].specifications[0].value, 'false');
    const result = await service.importProducts(bytes, 1);
    assert.equal(result.imported, 2);
    assert.deepEqual(common.map(([fact, options]) => [fact.item_id, fact.value, Boolean(options.transaction)]), [[1,'USB',true],[1,'2024-02-29',true],[1,'Finish',true]]);
    assert.deepEqual(writes.ItemVariant.map(v => v.attributes), [{number:'0'}, {boolean:'false'}, {decimal:'-1.25'}]);
});

test('invalid references, stale options, foreign variants, duplicates, formulas and malformed typed values identify exact cells', async () => {
    const rows = [
        ['Missing','','text','x'], ['Cable','Single','text','x'], ['Cable','','inactive','x'], ['Cable','','select','Other'],
        ['Cable','','number',1.5], ['Cable','','decimal','NaN'], ['Cable','','date','2025-02-29'], ['Cable','','boolean','sometimes'],
        ['Cable','Long','text','first'], ['Cable','Long','text','duplicate'], ['Cable','Short','text',{formula:'1+1',result:2}]
    ];
    const { book, service, writes } = fixture(rows);
    const bytes = await book.xlsx.writeBuffer();
    const { workbookErrors } = service.summary(await service.parseAndValidate(bytes));
    assert.deepEqual(workbookErrors.map(e => [e.sheet, e.rowNumber, e.column]), [
        [2,'Product Name'],[3,'Variant Name'],[4,'Specification'],[5,'Value'],[6,'Value'],[7,'Value'],[8,'Value'],[9,'Value'],[11,'Specification'],[12,'Value']
    ].map(([r,c]) => ['Specifications',r,c]));
    await assert.rejects(service.importProducts(bytes, 1), /validation issues/);
    assert.equal(writes.Item.length, 0);
    const report = new ExcelJS.Workbook(); await report.xlsx.load(await service.report(bytes));
    assert.deepEqual(report.getWorksheet('Import Error Report').getRow(2).values.slice(1,4), ['Specifications',2,'Product Name']);
});

test('specification rows retain their own 500-row capacity alongside the original product and variant capacity', async () => {
    const { book, sheet, service } = fixture([]);
    for (let i = 0; i < 500; i++) sheet.addRow(['Cable', 'Long', 'text', 'x']);
    assert.equal((await service.parseAndValidate(await book.xlsx.writeBuffer())).counts.specifications, 500);
    sheet.addRow(['Cable','','text','one more']);
    await assert.rejects(service.parseAndValidate(await book.xlsx.writeBuffer()), /500 populated Specifications/);
});

test('generated dependent validation and compact indexes survive an XLSX round trip', async () => {
    const { service } = harness();
    const refs = { categories:[],brands:[],units:[],warranties:[],locations:[],itemTypes:[{id:1,name:'Laptop\u00a0RAM'},{id:2,name:'Cable'}],
        assignments:definitions.map(r => ({ ...r,specification:{ ...r.specification,options:r.specification.data_type === 'select' ? ['USB','Cable'] : [] } })) };
    const book = new ExcelJS.Workbook(); await book.xlsx.load(await service.template(refs));
    const s = book.getWorksheet('Specifications'), v = book.getWorksheet('_Validation');
    assert.equal(v.getCell('N2').value,'Laptop RAM'); assert.equal(typeLabel('Laptop\u200b  RAM'),'Laptop RAM');
    assert.equal(v.getCell('O2').value,'SW_T_1'); assert.equal(v.getCell('O3').value,'SW_Empty');
    assert.deepEqual(v.getColumn('Q').values.slice(2,5),['SW_V_1','SW_Boolean','SW_Empty']);
    assert.equal(v.getCell('S2').value,'USB');
    assert.deepEqual(book.definedNames.getRanges('SW_T_1').ranges, ["'_Validation'!$P$2:$P$7"]);
    let count = 0; v.eachRow(r => r.eachCell(c => { if (c.formula) count++; }));
    assert.equal(count,2000);
    for (const r of [2,501]) {
        assert.match(v.getCell('H'+r).formula, /MATCH\(.+ProductNames/);
        assert.match(v.getCell('I'+r).formula, /SMALL\(SW_VariantKeys/);
        assert.match(v.getCell('J'+r).formula, /COUNTIFS/);
        assert.match(v.getCell('K'+r).formula, /SW_TypeLabels/);
        for (const [col, pattern] of [['A',/ProductNames/],['B',/SW_VariantLists/],['C',/SW_RowType/],['D',/OFFSET/]]) {
            const rule=s.getCell(col+r).dataValidation;
            assert.equal(rule.type,'list'); assert.match(rule.formulae[0],pattern); assert.ok(rule.formulae[0].length<=255);
        }
    }
    assert.equal(s.getCell('D501').dataValidation.showErrorMessage,undefined);
    refs.itemTypes.push({id:3,name:'Laptop RAM'});
    await assert.rejects(service.template(refs), /Duplicate item type/);
});

test('a complete 500-business-row workbook accepts 500 distinct specification assignments', async () => {
    const { book, service, sheet } = fixture([]);
    const products = book.getWorksheet('Products'), variants = book.getWorksheet('Variants');
    products.spliceRows(3, 1);
    for (let i = 1; i <= 499; i++) {
        variants.getRow(i + 1).values = ['Cable','Size ' + i,0,1,1,1,1,1];
        sheet.getRow(i + 1).values = ['Cable','Size ' + i,'number',i];
    }
    sheet.getRow(501).values = ['Cable','','boolean','No'];
    const summary = service.summary(await service.parseAndValidate(await book.xlsx.writeBuffer()));
    assert.deepEqual(summary.workbookErrors, []);
    assert.equal(summary.counts.valid, 1);
    assert.equal(summary.counts.variants, 499);
    assert.equal(summary.counts.specifications, 500);
});
