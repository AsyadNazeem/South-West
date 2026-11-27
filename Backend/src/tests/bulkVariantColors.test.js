'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
const { workbook, harness } = require('./fixtures/standardProductWorkbook');
const { headers } = require('../services/bulkVariantColors');

function setPair(sheet, row, values) {
    values.forEach((v,i) => { sheet.getCell(row,14+i).value = v; });
}
function withColors() {
    const book = workbook(), sheet = book.getWorksheet('Variants');
    setPair(sheet,1,headers);
    return { book, sheet };
}

test('current template appends optional text HEX columns and paints the existing reference list', async () => {
    const { service } = harness(), book = new ExcelJS.Workbook();
    await book.xlsx.load(await service.template());
    const variants = book.getWorksheet('Variants'), refs = book.getWorksheet('Reference Lists');
    assert.deepEqual(variants.getRow(1).values.slice(14),headers);
    for (const col of ['O','Q']) for (const r of [2,501]) assert.equal(variants.getCell(col+r).numFmt,'@');
    assert.equal(refs.getCell('J2').value,'#000000');
    assert.equal(refs.getCell('J2').fill.fgColor.argb,'FF000000');
    assert.match(book.getWorksheet('Instructions').getColumn(2).values.join(' '),/No colours:.+One colour:.+Two colours:/);
    assert.match(book.getWorksheet('Specifications').getCell('B501').dataValidation.formulae[0],/SW_VariantLists/);
    const legacy = await service.parseAndValidate(await workbook().xlsx.writeBuffer());
    assert.equal(legacy.counts.valid,2);
    assert.deepEqual(legacy.products[0].variants[0].colors,[]);
});

test('valid colours share a product palette and keep selection order and custom names', async () => {
    const { service } = harness(), { book,sheet } = withColors();
    setPair(sheet,2,['Rose Gold','#aabbcc','White','#FFFFFF']);
    setPair(sheet,4,[' rose gold ','#AABBCC']);
    const parsed = await service.parseAndValidate(await book.xlsx.writeBuffer());
    const preview = service.summary(parsed);
    assert.deepEqual(preview.workbookErrors,[]);
    assert.deepEqual(preview.rows[0].variants.map(v=>v.colors.map(c=>[c.color_name,c.hex_code])),[[['Rose Gold','#AABBCC'],['White','#FFFFFF']],[['Rose Gold','#AABBCC']]]);
    assert.deepEqual(preview.rows[1].variants[0].colors,[]);
});

for (const [title,first,second,column,row] of [
    ['name without HEX',['Blue'],null,'Color 1 HEX',2],
    ['HEX without name',[null,'#000000'],null,'Color 1 Name',2],
    ['abbreviated HEX',['Black','#000'],null,'Color 1 HEX',2],
    ['formula with cached HEX',['Black',{formula:'1+1',result:'#000000'}],null,'Color 1 HEX',2],
    ['oversized name',['x'.repeat(51),'#000000'],null,'Color 1 Name',2],
    ['same swatch twice',['Black','#000000','Black','#000000'],null,'Color 2 HEX',2],
    ['name reused for different code',['Black','#000000'],['black','#010101'],'Color 1 HEX',4],
    ['code reused with different label',['Black','#000000'],['Ink','#000000'],'Color 1 Name',4],
    ['partial second pair',['Black','#000000','Blue'],null,'Color 2 HEX',2]
]) test('rejects '+title+' with exact cell location',async()=>{
    const { book,sheet }=withColors(), { service }=harness();
    setPair(sheet,2,first);
    if(second) setPair(sheet,4,second);
    const bytes=await book.xlsx.writeBuffer();
    const issues=service.summary(await service.parseAndValidate(bytes)).workbookErrors;
    assert.ok(issues.some(i=>i.sheet==='Variants' && i.rowNumber===row && i.column===column));
    await assert.rejects(service.importProducts(bytes,1),/validation issues/);
});

test('actual colour suffix participates in SKU collision checks',async()=>{
    const {book,sheet}=withColors(), {service}=harness();
    sheet.getCell('B2').value='Mini'; sheet.getCell('B4').value='Mini B';
    setPair(sheet,2,['Blue','#0000FF']); setPair(sheet,4,['Lue','#000E00']);
    assert.match((await service.parseAndValidate(await book.xlsx.writeBuffer())).products[0].errors.join(' '),/same SKU/);
});

test('the fiftieth distinct colour is accepted and the next is identified',async()=>{
    const {book,sheet}=withColors(), {service}=harness();
    for(let i=0;i<50;i++) sheet.addRow(['Cable','Shade '+i,0,1,1,1,1,1,null,null,null,null,null,'Shade '+i,'#'+i.toString(16).padStart(6,'0')]);
    assert.equal((await service.parseAndValidate(await book.xlsx.writeBuffer())).counts.invalid,0);
    sheet.addRow(['Cable','Extra',0,1,1,1,1,1,null,null,null,null,null,'Extra','#111111']);
    assert.match((await service.parseAndValidate(await book.xlsx.writeBuffer())).products[0].errors.join(' '),/50-colour/);
});

test('rejects incomplete colour headers and unsupported third slots',async()=>{
    const {book,sheet}=withColors(), {service}=harness();
    sheet.getCell('Q1').value=null;
    await assert.rejects(service.parseAndValidate(await book.xlsx.writeBuffer()),/colour headers/);
    sheet.getCell('Q1').value='Color 2 HEX'; sheet.getCell('R1').value='Color 3 Name';
    await assert.rejects(service.parseAndValidate(await book.xlsx.writeBuffer()),/colour headers/);
});

test('500 business rows reuse swatches without changing the Standard row limit',async()=>{
    const {book,sheet}=withColors(), {service}=harness();
    book.getWorksheet('Products').spliceRows(3,1);
    for(let i=0;i<499;i++){
        sheet.getRow(i+2).values=['Cable','Size '+i,1,2,2,2,2,2,null,null,null,null,null,'Graphite','#303030','White','#FFFFFF'];
    }
    const bytes=await book.xlsx.writeBuffer();
    const preview=service.summary(await service.parseAndValidate(bytes));
    assert.deepEqual(preview.workbookErrors,[]);
    assert.equal(preview.rows[0].variants.length,499);
    assert.equal(preview.rows[0].variants[498].colors.length,2);
    sheet.getRow(501).values=['Cable','One too many',1,2,2,2,2,2];
    await assert.rejects(service.parseAndValidate(await book.xlsx.writeBuffer()),/500 total data rows/);
});
