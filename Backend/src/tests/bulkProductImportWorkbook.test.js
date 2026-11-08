'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const ExcelJS=require('exceljs');
const proxyquire=require('proxyquire').noCallThru();

const calls={items:[],variants:[],prices:[],payments:[],stock:[],movements:[],audits:[],transactions:[]};
const categories=[{id:1,name:'Accessories'}],brands=[{id:2,name:'UGREEN'}],itemTypes=[{id:3,name:'Cable'},{id:5,name:'Charger'}],units=[{id:6,name:'Each',code:'EA',is_active:true}],warranties=[{id:7,name:'1 Year',code:'Y1',is_active:true}],locations=[{id:4,name:'Main Store',code:'MAIN',is_active:true},{id:8,name:'Online Stock',code:'ONLINE',is_active:true}];
const model=(findAll=async()=>[],create=async values=>({id:1,...values}))=>({findAll,findOne:async()=>null,create,findByPk:async()=>null,findOrCreate:async()=>[{id:1}]});
const transaction=()=>{const tx={LOCK:{UPDATE:'UPDATE'},finished:false,async commit(){this.finished='commit'},async rollback(){this.finished='rollback'}};calls.transactions.push(tx);return tx;};
const db={
  sequelize:{transaction:async()=>transaction()},
  Item:model(async()=>[],async values=>{calls.items.push(values);return {id:88,...values}}),Category:model(async()=>categories),Brand:model(async()=>brands),ItemType:model(async()=>itemTypes),Unit:model(async()=>units),Warranty:model(async()=>warranties),
  ItemVariant:model(async()=>[],async values=>{calls.variants.push(values);return {id:100+calls.variants.length,...values}}),
  ItemPrice:model(async()=>[],async values=>{calls.prices.push(values);return {id:calls.prices.length,...values}}),
  ItemPaymentPrice:model(async()=>[],async values=>{calls.payments.push(values);return {id:calls.payments.length,...values}}),
  InventoryStock:model(async()=>[],async values=>{calls.stock.push(values);return {id:calls.stock.length,...values}}),
  InventoryStockMovement:model(async()=>[],async values=>{calls.movements.push(values);return {id:calls.movements.length,...values}}),
  InventoryLocation:model(async()=>locations)
};
const service=proxyquire('../services/bulkProductImportService',{
  '../models':db,
  '../services/itemCodeService':{generateItemCode:async()=> 'SW-000042'},
  '../services/auditLogService':{recordAuditLog:async values=>calls.audits.push(values)},
  '../controllers/itemVariantController':{generateVariantSku:(itemCode,name)=>`SWV-${itemCode.replace(/\W/g,'')}-${name.replace(/[^A-Za-z0-9]/g,'')}`},
  '../controllers/itemPriceController':{isValidPrice(value){return /^\d{1,13}(?:\.\d{1,2})?$/.test(String(value))&&Number(value)>=0}}
});
function reset(){for(const key of Object.keys(calls))calls[key].length=0;}
function baseWorkbook(){const wb=new ExcelJS.Workbook();wb.addWorksheet('Products').addRow(service.PRODUCT_HEADERS);wb.addWorksheet('Variants').addRow(service.VARIANT_HEADERS);return wb;}
function addProduct(wb,name='UGREEN Cable',type='Cable',weight=1,markAsNew='No'){wb.getWorksheet('Products').addRow([name,'Accessories','UGREEN',type,'Each','1 Year','New',weight,'Braided cable','Active',markAsNew]);}
function addVariant(wb,product='UGREEN Cable',name='1m Type-C',stock=0,location='',quickbooksItemCode='',reorderQuantity=0){wb.getWorksheet('Variants').addRow([product,name,250,350,350,355,360,360,stock,reorderQuantity,location,'Yes',quickbooksItemCode]);}

test('template contains only product and variant import sections',async()=>{
  const bytes=await service.template({categories,brands,itemTypes,units,warranties,locations});const wb=new ExcelJS.Workbook();await wb.xlsx.load(bytes);
  assert.deepEqual(wb.worksheets.map(sheet=>sheet.name),['Products','Variants','_Validation','Instructions','Reference Lists']);
  assert.deepEqual(wb.getWorksheet('Products').getRow(1).values.slice(1),service.PRODUCT_HEADERS);
  assert.deepEqual(wb.getWorksheet('Variants').getRow(1).values.slice(1),service.VARIANT_HEADERS);
  assert.ok(wb.getWorksheet('Products').getCell('B2').dataValidation);
  assert.ok(wb.getWorksheet('Variants').getCell('A2').dataValidation);
  assert.equal(wb.getWorksheet('_Validation').state,'veryHidden');
  assert.deepEqual(wb.getWorksheet('Products').getRow(1).values.slice(1),['Product Name','Category','Brand','Item Type','Unit of Measure','Warranty','Condition','Shipping Weight (kg)','Description','Active Status','Mark as New']);
  assert.equal(wb.getWorksheet('Products').getCell('E2').dataValidation.formulae[0],'=UnitList');
  assert.equal(wb.getWorksheet('Products').getCell('F2').dataValidation.formulae[0],'=WarrantyList');
  assert.equal(wb.getWorksheet('Products').getCell('G2').dataValidation.formulae[0],'=ConditionList');
  assert.equal(wb.getWorksheet('Products').getCell('H2').dataValidation.type,'decimal');
  assert.equal(wb.getWorksheet('Products').getCell('K2').dataValidation.formulae[0], '"Yes,No"');
  assert.equal(wb.getWorksheet('Products').getCell('K2').value,'No');
  assert.equal(wb.getWorksheet('Variants').getCell('J2').dataValidation.type,'decimal');
  assert.equal(wb.getWorksheet('Variants').getCell('J2').dataValidation.operator,'greaterThanOrEqual');
  assert.equal(wb.getWorksheet('Variants').getCell('K2').dataValidation.formulae[0],'=LocationList');
  assert.equal(wb.getWorksheet('Variants').getCell('M2').numFmt,'@');
  assert.ok(wb.getWorksheet('_Validation').getColumn(7).values.includes('Online Stock'));
  assert.equal(wb.getWorksheet('Variant Specifications'),undefined);
  const instructions=wb.getWorksheet('Instructions').getColumn(2).values.join(' ');
  assert.match(instructions,/Reorder Quantity accepts zero or a positive quantity/);
  assert.match(instructions,/edit each variant to enter its configured specifications/);
  assert.match(instructions,/Products > Variants/);
});

test('products without variants are rejected',async()=>{
  const wb=baseWorkbook();addProduct(wb);const parsed=await service.parseAndValidate(await wb.xlsx.writeBuffer());
  assert.match(parsed.products[0].errors.join(' '),/at least one variant/);
});

test('invalid unit, warranty, and condition values are rejected',async()=>{
  const wb=baseWorkbook();addProduct(wb);addVariant(wb);
  const sheet=wb.getWorksheet('Products');sheet.getCell('E2').value='Not a unit';sheet.getCell('F2').value='Not a warranty';sheet.getCell('G2').value='Not a condition';
  const parsed=await service.parseAndValidate(await wb.xlsx.writeBuffer());
  assert.match(parsed.products[0].errors.join(' '),/active Unit of Measure/);assert.match(parsed.products[0].errors.join(' '),/active Warranty/);assert.match(parsed.products[0].errors.join(' '),/Condition must be/);
});

test('Mark as New accepts Yes or No, defaults blanks to No, and rejects other values',async()=>{
  const yes=baseWorkbook();addProduct(yes,'New Product','Cable',1,'Yes');addVariant(yes);
  const yesParsed=await service.parseAndValidate(await yes.xlsx.writeBuffer());
  assert.equal(yesParsed.products[0].isNew,true);
  assert.equal(service.summary(yesParsed).rows[0].isNew,true);

  const blank=baseWorkbook();addProduct(blank,'Regular Product','Cable',1,'');addVariant(blank);
  const blankParsed=await service.parseAndValidate(await blank.xlsx.writeBuffer());
  assert.equal(blankParsed.products[0].isNew,false);

  const invalid=baseWorkbook();addProduct(invalid,'Invalid Product','Cable',1,'Sometimes');addVariant(invalid);
  const invalidParsed=await service.parseAndValidate(await invalid.xlsx.writeBuffer());
  const issue=service.summary(invalidParsed).workbookErrors.find(error=>error.column==='Mark as New');
  assert.ok(issue);assert.equal(issue.rowNumber,2);
});

test('shipping weight is required and invalid values include the Excel row and column',async()=>{
  for(const value of ['',0,-1,'heavy','1.2345']){
    const wb=baseWorkbook();addProduct(wb,'UGREEN Cable','Cable',value);addVariant(wb);
    const parsed=await service.parseAndValidate(await wb.xlsx.writeBuffer());
    const issue=service.summary(parsed).workbookErrors.find(error=>error.column==='Shipping Weight (kg)');
    assert.ok(issue,`Expected shipping weight issue for ${value}`);assert.equal(issue.sheet,'Products');assert.equal(issue.rowNumber,2);
  }
});

test('reference dropdown lists are refreshed from current database rows for every template',async()=>{
  let currentCategories=[...categories],currentBrands=[...brands];
  db.Category.findAll=async()=>currentCategories;db.Brand.findAll=async()=>currentBrands;
  const first=new ExcelJS.Workbook();await first.xlsx.load(await service.template());
  currentCategories=[...currentCategories,{id:9,name:'Recently added category'}];currentBrands=[...currentBrands,{id:10,name:'Recently added brand'}];
  const next=new ExcelJS.Workbook();await next.xlsx.load(await service.template());
  assert.ok(next.getWorksheet('Reference Lists').getColumn(1).values.includes('Recently added category'));
  assert.ok(next.getWorksheet('Reference Lists').getColumn(2).values.includes('Recently added brand'));
  assert.ok(next.getWorksheet('_Validation').getColumn(1).values.includes('Recently added category'));
  assert.ok(next.getWorksheet('_Validation').getColumn(2).values.includes('Recently added brand'));
  db.Category.findAll=async()=>categories;db.Brand.findAll=async()=>brands;
});

test('variants may be interleaved and match their product names correctly',async()=>{
  const wb=baseWorkbook();addProduct(wb);addProduct(wb,'Anker Adapter');
  addVariant(wb,'UGREEN Cable','1m Type-C');addVariant(wb,'Anker Adapter','20W');addVariant(wb,'UGREEN Cable','2m USB-A');addVariant(wb,'Anker Adapter','30W');addVariant(wb,'UGREEN Cable','3m USB-A');
  [4,5,6].forEach(row=>wb.getWorksheet('Variants').getCell(row,12).value='No');
  const parsed=await service.parseAndValidate(await wb.xlsx.writeBuffer());
  assert.equal(parsed.counts.valid,2,JSON.stringify(parsed.products.map(p=>p.errors)));
  assert.deepEqual(parsed.products[0].variants.map(v=>v.name),['1m Type-C','2m USB-A','3m USB-A']);
  assert.deepEqual(parsed.products[1].variants.map(v=>v.name),['20W','30W']);
});

test('variants and products may contain spaces and punctuation',async()=>{
  const wb=baseWorkbook();addProduct(wb,'USB-C Hub & Dock (7-in-1) *?');addVariant(wb,'USB-C Hub & Dock (7-in-1) *?','2m, USB-A (Blue)');
  const parsed=await service.parseAndValidate(await wb.xlsx.writeBuffer());
  assert.equal(parsed.counts.valid,1,JSON.stringify(parsed.products[0].errors));
  assert.equal(parsed.products[0].variants[0].name,'2m, USB-A (Blue)');
});

test('configured required specifications do not block import and are left for admin editing',async()=>{
  const wb=baseWorkbook();addProduct(wb,'UGREEN Cable','Cable');addVariant(wb);
  const parsed=await service.parseAndValidate(await wb.xlsx.writeBuffer());
  assert.equal(parsed.counts.valid,1,JSON.stringify(parsed.products[0].errors));
  assert.deepEqual(parsed.products[0].variants[0].attributes,{});
});

test('legacy workbook with a Variant Specifications sheet is rejected instead of discarding data',async()=>{
  const wb=baseWorkbook();wb.addWorksheet('Variant Specifications').addRow(['Product Name','Variant Name','Specification','Value']);
  await assert.rejects(service.parseAndValidate(await wb.xlsx.writeBuffer()),/Variant Specifications sheet is no longer supported/);
});

test('positive stock needs an active location, while zero stock creates none',async()=>{
  const invalid=baseWorkbook();addProduct(invalid);addVariant(invalid,'UGREEN Cable','1m Type-C',2,'Closed Store');
  const invalidResult=await service.parseAndValidate(await invalid.xlsx.writeBuffer());assert.equal(invalidResult.counts.invalid,1);assert.match(invalidResult.products[0].errors.join(' '),/active stock location/);
  reset();const zero=baseWorkbook();addProduct(zero);addVariant(zero,'UGREEN Cable','1m Type-C',0,'');
  await service.importProducts(await zero.xlsx.writeBuffer(),55);assert.equal(calls.movements.length,0);assert.equal(calls.stock.length,0);
});

test('valid active Online Stock location resolves from Excel for multiple variants and appears in preview',async()=>{
  reset();const wb=baseWorkbook();addProduct(wb,'Anker USB Type C');
  addVariant(wb,'Anker USB Type C','0.5m Type C braided Cable',5,'Online Stock','',0);
  addVariant(wb,'Anker USB Type C','1m Type C braided Cable',3,' Online Stock ','',4);
  wb.getWorksheet('Variants').getCell('L3').value='No';
  const preview=service.summary(await service.parseAndValidate(await wb.xlsx.writeBuffer()));
  assert.equal(preview.counts.valid,1,JSON.stringify(preview.workbookErrors));
  assert.deepEqual(preview.rows[0].variants.map(v=>[v.stockLocation,v.reorderQuantity]),[['Online Stock',0],['Online Stock',4]]);
  const result=await service.importProducts(await wb.xlsx.writeBuffer(),55);
  assert.equal(result.imported,1);assert.equal(result.failed,0);
  assert.equal(calls.stock.length,2);assert.deepEqual(calls.stock.map(s=>s.location_id),[8,8]);
  assert.deepEqual(calls.stock.map(s=>s.reorder_quantity),[0,4]);
  assert.equal(calls.movements.length,2);assert.deepEqual(calls.movements.map(m=>m.location_id),[8,8]);
});

test('inactive locations are rejected and a location is required for positive opening stock',async()=>{
  const originalFindAll=db.InventoryLocation.findAll;
  db.InventoryLocation.findAll=async()=>[...locations,{id:11,name:'Inactive Stock',code:'INACTIVE',is_active:false}];
  const inactive=baseWorkbook();addProduct(inactive);addVariant(inactive,'UGREEN Cable','1m Type-C',2,'Inactive Stock');
  const inactiveResult=await service.parseAndValidate(await inactive.xlsx.writeBuffer());
  assert.match(inactiveResult.products[0].errors.join(' '),/active stock location/);
  const missing=baseWorkbook();addProduct(missing);addVariant(missing,'UGREEN Cable','1m Type-C',2,'');
  const missingResult=await service.parseAndValidate(await missing.xlsx.writeBuffer());
  assert.match(missingResult.products[0].errors.join(' '),/Stock Location is required/);
  db.InventoryLocation.findAll=originalFindAll;
});

test('Reorder Quantity accepts zero and decimals, while rejecting negative or invalid values',async()=>{
  for(const value of [0,3.125]){
    const wb=baseWorkbook();addProduct(wb);addVariant(wb,'UGREEN Cable','1m Type-C',0,value>0?'Main Store':'','',value);
    const parsed=await service.parseAndValidate(await wb.xlsx.writeBuffer());
    assert.equal(parsed.counts.valid,1,JSON.stringify(parsed.products[0].errors));
    assert.equal(parsed.products[0].variants[0].reorderQuantity,value);
  }
  for(const value of [-1,'many',1.2345]){
    const wb=baseWorkbook();addProduct(wb);addVariant(wb,'UGREEN Cable','1m Type-C',0,'','',value);
    const parsed=await service.parseAndValidate(await wb.xlsx.writeBuffer());
    const issue=service.summary(parsed).workbookErrors.find(error=>error.column==='Reorder Quantity');
    assert.ok(issue,`Expected Reorder Quantity issue for ${value}`);assert.equal(issue.rowNumber,2);
  }
});

test('Reorder Quantity saves to a variant stock record with zero opening stock',async()=>{
  reset();const wb=baseWorkbook();addProduct(wb);addVariant(wb,'UGREEN Cable','1m Type-C',0,'Main Store','',7);
  const result=await service.importProducts(await wb.xlsx.writeBuffer(),55);
  assert.equal(result.imported,1);assert.equal(calls.stock.length,1);
  assert.equal(calls.stock[0].variant_id,101);assert.equal(calls.stock[0].location_id,4);
  assert.equal(calls.stock[0].quantity_on_hand,0);assert.equal(calls.stock[0].reorder_quantity,7);
  assert.equal(calls.movements.length,0);
});

test('orphan variants are reported with their workbook row',async()=>{
  const wb=baseWorkbook();addProduct(wb);wb.getWorksheet('Variants').addRow(['Missing Product','Loose Variant',1,2,2,2,2,2,0,0,'','Yes','']);
  const parsed=await service.parseAndValidate(await wb.xlsx.writeBuffer());assert.equal(parsed.problems.length,1);assert.equal(parsed.problems[0].rowNumber,2);
});

test('import persists product fields and variant QuickBooks code including leading zeros',async()=>{
  reset();const wb=baseWorkbook();addProduct(wb,'UGREEN Cable','Cable',1,'Yes');addVariant(wb,'UGREEN Cable','1m Type-C',5,'Main Store','000042-A');
  const result=await service.importProducts(await wb.xlsx.writeBuffer(),55,{ipAddress:'127.0.0.1'});
  assert.equal(result.imported,1);assert.equal(calls.variants[0].variant_sku,'SWV-SW000042-1mTypeC');assert.equal(calls.variants[0].is_default,true);
  assert.deepEqual({unit_id:calls.items[0].unit_id,warranty_id:calls.items[0].warranty_id,condition:calls.items[0].condition,shipping_weight:calls.items[0].shipping_weight,shipping_weight_unit:calls.items[0].shipping_weight_unit},{unit_id:6,warranty_id:7,condition:'new',shipping_weight:1,shipping_weight_unit:'kg'});
  assert.equal(calls.items[0].is_new,true);
  assert.equal(calls.variants[0].qb_item_code,'000042-A');
  assert.deepEqual(calls.variants[0].attributes,{});assert.equal(calls.prices.length,2);assert.equal(calls.payments.length,4);assert.equal(calls.stock[0].variant_id,101);
  assert.equal(calls.movements[0].movement_type,'goods_receipt');assert.equal(calls.movements[0].reference_type,'bulk_product_import');assert.equal(calls.movements[0].created_by,55);
  assert.ok(calls.transactions.every(tx=>tx.finished==='commit'));
});

test('a failed movement rolls the entire product transaction back',async()=>{
  reset();db.InventoryStockMovement.create=async()=>{throw new Error('movement failed')};const wb=baseWorkbook();addProduct(wb);addVariant(wb,'UGREEN Cable','1m Type-C',5,'Main Store');
  const result=await service.importProducts(await wb.xlsx.writeBuffer(),55);assert.equal(result.failed,1);assert.equal(calls.transactions[0].finished,'rollback');
  db.InventoryStockMovement.create=async values=>{calls.movements.push(values);return {id:calls.movements.length,...values}};
});
