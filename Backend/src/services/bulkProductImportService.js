'use strict';

const ExcelJS = require('exceljs');
const { Op } = require('sequelize');
const { randomUUID } = require('crypto');
const {
  sequelize, Item, Brand, Category, ItemType, ItemVariant, Unit, Warranty,
  ItemPrice, ItemPaymentPrice, InventoryStock,
  InventoryStockMovement, InventoryLocation,
} = require('../models');
const { generateItemCode } = require('./itemCodeService');
const { recordAuditLog } = require('./auditLogService');
const { generateVariantSku } = require('../controllers/itemVariantController');
const { isValidPrice } = require('../controllers/itemPriceController');

async function auditImportedRecord(options) {
  if (options.importSummaryOnly) return null;
  return recordAuditLog(options);
}

const LIMIT_ROWS = 500;
const PRODUCT_HEADERS = ['Product Name','Category','Brand','Item Type','Unit of Measure','Warranty','Condition','Shipping Weight (kg)','Description','Active Status','Mark as New'];
const VARIANT_HEADERS = ['Product Name','Variant Name','Cost Price','Selling Price','Cash Price','Card Price','Koko Price','Mintpay Price','Stock Quantity','Reorder Quantity','Stock Location','Default Variant','QuickBooks Item Code'];
const str = value => String(value ?? '').trim();
const key = value => str(value).toLocaleLowerCase();
const isActive = value => value === true || value === 1 || value === '1';
const cellValue = cell => {
  const value = cell?.value;
  if (value instanceof Date) return value.toISOString().slice(0,10);
  if (value && typeof value === 'object') {
    if (value.formula || value.sharedFormula) return '';
    if (value.richText) return value.richText.map(part => part.text).join('').trim();
    if ('text' in value) return str(value.text);
    if ('result' in value) return typeof value.result === 'string' || typeof value.result === 'number' ? value.result : '';
  }
  return typeof value === 'string' ? value.trim() : value;
};
const slugify = value => str(value).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,180).replace(/-+$/g,'') || 'product';
const bool = value => ['true','yes','1','active'].includes(key(value)) ? true : ['false','no','0','inactive'].includes(key(value)) ? false : null;

function readRows(sheet, sheetName, headers) {
  if (!sheet) throw new Error(`Workbook is missing the ${sheetName} sheet.`);
  const actual = sheet.getRow(1).values.slice(1).map(key);
  if (headers.some((header,index) => actual[index] !== key(header))) throw new Error(`Invalid headers in ${sheetName}. Download a fresh template.`);
  const rows=[];
  for(let n=2;n<=sheet.rowCount;n++) {
    const values={}; let nonEmpty=false;
    headers.forEach((header,index)=>{const value=cellValue(sheet.getRow(n).getCell(index+1));values[header]=value;if(value!==''&&value!==null&&value!==undefined)nonEmpty=true;});
    if(nonEmpty)rows.push({rowNumber:n,values});
  }
  return rows;
}
function price(value,label,errors,{required=false}={}) {
  if ((value===''||value===null||value===undefined)&&!required)return null;
  if(!isValidPrice(value)){errors.push(`${label} must be a non-negative amount with at most two decimal places.`);return null;}
  return Number(value);
}
function quantity(value,label,errors) {
  if(value===''||value===null||value===undefined)return null;
  const number=Number(value);
  if(!Number.isFinite(number)||number<0||number>=1e12||!/^\d{1,12}(?:\.\d{1,3})?$/.test(String(value))){errors.push(`${label} must be a non-negative quantity with at most three decimal places.`);return null;}
  return number;
}
async function references(){
  const [categories,brands,itemTypes,units,warranties,locations]=await Promise.all([
    Category.findAll({where:{is_active:true},attributes:['id','name'],raw:true}),
    Brand.findAll({where:{is_active:true},attributes:['id','name'],raw:true}),
    ItemType.findAll({where:{is_active:true},attributes:['id','name'],raw:true}),
    Unit.findAll({where:{is_active:true},attributes:['id','name','code'],raw:true}),
    Warranty.findAll({where:{is_active:true},attributes:['id','name','code'],raw:true}),
    InventoryLocation.findAll({where:{is_active:true},attributes:['id','name','code','is_active'],raw:true})
  ]);
  return {categories,brands,itemTypes,units,warranties,locations};
}

const CONDITION_OPTIONS=[
  {label:'New',value:'new'},
  {label:'Used',value:'used'},
  {label:'Refurbished',value:'refurbished'},
  {label:'Open Box',value:'open_box'},
  {label:'Damaged',value:'damaged'}
];
function shippingWeight(value){
  if(value===''||value===null||value===undefined)return null;
  const text=String(value),number=Number(value);
  return Number.isFinite(number)&&number>0&&/^\d{1,7}(?:\.\d{1,3})?$/.test(text)?number:null;
}

async function parseAndValidate(buffer){
  const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(buffer);
  const productRows=readRows(workbook.getWorksheet('Products'),'Products',PRODUCT_HEADERS);
  const variantRows=readRows(workbook.getWorksheet('Variants'),'Variants',VARIANT_HEADERS);
  if(workbook.getWorksheet('Variant Specifications'))throw new Error('The Variant Specifications sheet is no longer supported. Import the products and variants, then edit variant specifications in product administration.');
  if(productRows.length+variantRows.length>LIMIT_ROWS)throw new Error(`Workbook exceeds ${LIMIT_ROWS} total data rows.`);
  const refs=await references();
  const productNames=new Map();const products=[];const problems=[];
  for(const row of productRows){const v=row.values,errors=[];const name=str(v['Product Name']);if(!name)errors.push('Product Name is required.');if(name.length>255)errors.push('Product Name must be 255 characters or fewer.');
    const category=refs.categories.find(x=>key(x.name)===key(v.Category));if(!category)errors.push('Choose an active category from the Reference Lists sheet.');
    const brand=refs.brands.find(x=>key(x.name)===key(v.Brand));if(!brand)errors.push('Choose an active brand from the Reference Lists sheet.');
    const typeName=str(v['Item Type']);const itemType=typeName?refs.itemTypes.find(x=>key(x.name)===key(typeName)):null;if(typeName&&!itemType)errors.push('Choose an active item type from the Reference Lists sheet.');
    const unitName=str(v['Unit of Measure']);const unit=unitName?refs.units.find(x=>key(x.name)===key(unitName)||key(x.code)===key(unitName)):null;if(unitName&&!unit)errors.push('Choose an active Unit of Measure from the Reference Lists sheet.');
    const warrantyName=str(v.Warranty);const warranty=warrantyName?refs.warranties.find(x=>key(x.name)===key(warrantyName)||key(x.code)===key(warrantyName)):null;if(warrantyName&&!warranty)errors.push('Choose an active Warranty from the Reference Lists sheet.');
    const conditionLabel=str(v.Condition);const condition=CONDITION_OPTIONS.find(x=>key(x.label)===key(conditionLabel)||x.value===key(conditionLabel));if(!condition)errors.push('Condition must be New, Used, Refurbished, Open Box, or Damaged.');
    const weight=shippingWeight(v['Shipping Weight (kg)']);if(weight===null)errors.push('Shipping Weight (kg) must be a positive number with up to 3 decimal places.');
    const active=bool(v['Active Status']);if(v['Active Status']!==''&&v['Active Status']!==null&&v['Active Status']!==undefined&&active===null)errors.push('Active Status must be Active or Inactive.');
    const newValue=str(v['Mark as New']);const isNew=newValue===''?false:['yes','no'].includes(key(newValue))?key(newValue)==='yes':null;if(isNew===null)errors.push('Mark as New must be Yes or No.');
    const product={rowNumber:row.rowNumber,name,category,brand,itemType,unit,warranty,condition:condition?.value||null,shippingWeight:weight,description:str(v.Description),active:active??true,isNew:isNew??false,variants:[],errors};
    products.push(product);if(name){const normalized=key(name);if(productNames.has(normalized)){errors.push('Product Name is duplicated. Give each product a unique name so its variants can be linked safely.');productNames.get(normalized).errors.push('Product Name is duplicated. Give each product a unique name so its variants can be linked safely.');}else productNames.set(normalized,product);}
  }
  // Variants for the same product may appear in any order on the Variants sheet.
  for(const row of variantRows){const v=row.values,errors=[];const productKey=key(v['Product Name']);const parent=productNames.get(productKey);if(!parent)errors.push('Product Name must exactly match one product on the Products sheet.');
    const name=str(v['Variant Name']);if(!name)errors.push('Variant Name is required.');if(name.length>255)errors.push('Variant Name must be 255 characters or fewer.');
    const prices={cost:price(v['Cost Price'],'Cost Price',errors),selling:price(v['Selling Price'],'Selling Price',errors,{required:true}),cash:price(v['Cash Price'],'Cash Price',errors,{required:true}),card:price(v['Card Price'],'Card Price',errors,{required:true}),koko:price(v['Koko Price'],'Koko Price',errors,{required:true}),mintpay:price(v['Mintpay Price'],'Mintpay Price',errors,{required:true})};
    const stock=quantity(v['Stock Quantity'],'Stock Quantity',errors);
    const reorderQuantity=quantity(v['Reorder Quantity'],'Reorder Quantity',errors)??0;
    const locationName=str(v['Stock Location']);const location=locationName?refs.locations.find(l=>isActive(l.is_active)&&(key(l.name)===key(locationName)||key(l.code)===key(locationName))):null;
    if((stock>0||reorderQuantity>0)&&!location)errors.push(locationName?'Choose an active stock location from the Reference Lists sheet.':'Stock Location is required when Stock Quantity or Reorder Quantity is greater than zero.');
    const defaultValue=bool(v['Default Variant']);if(v['Default Variant']!==''&&v['Default Variant']!==null&&v['Default Variant']!==undefined&&defaultValue===null)errors.push('Default Variant must be Yes or No.');
    const quickbooksItemCode=v['QuickBooks Item Code']===''||v['QuickBooks Item Code']===null||v['QuickBooks Item Code']===undefined?'':String(v['QuickBooks Item Code']).trim();
    if(quickbooksItemCode.length>100)errors.push('QuickBooks Item Code must be 100 characters or fewer.');
    const variant={rowNumber:row.rowNumber,parent,name,prices,stock,reorderQuantity,locationName,location,isDefault:defaultValue??false,quickbooksItemCode,attributes:{},errors};
    if(stock>0&&parent&&!parent.active)errors.push('Opening stock cannot be recorded for an inactive product variant.');
    if(parent){if(parent.variants.some(existing=>key(existing.name)===key(name)))errors.push('Variant Name is repeated within this product. Use a distinct variant name.');parent.variants.push(variant);if(errors.length)parent.errors.push(...errors.map(message=>`Variants row ${row.rowNumber}: ${message}`));}
    else problems.push({sheet:'Variants',rowNumber:row.rowNumber,errors});
  }
  for(const product of products){if(!product.variants.length)product.errors.push('Add at least one variant for this product on the Variants sheet.');const defaults=product.variants.filter(v=>v.isDefault);if(defaults.length>1){product.errors.push('Only one variant can be marked as the default.');for(const v of defaults)v.errors.push('Only one variant can be marked as the default.');}if(product.variants.length&&defaults.length===0)product.variants[0].isDefault=true;}
  for(const product of products){const generated=new Map();for(const variant of product.variants){try{const candidate=generateVariantSku('SW-000001',variant.name).toLowerCase();if(generated.has(candidate)){const error='This variant name would generate the same SKU as another variant. Use a more distinct name.';variant.errors.push(error);product.errors.push(error);generated.get(candidate).errors.push(error);}else generated.set(candidate,variant);}catch(error){variant.errors.push(error.message);product.errors.push(error.message);}}}
  for(const product of products){for(const variant of product.variants)if(variant.errors.length&&!product.errors.some(e=>e.startsWith(`Variants row ${variant.rowNumber}:`)))product.errors.push(...variant.errors.map(e=>`Variants row ${variant.rowNumber}: ${e}`));}
  const counts={products:products.length,variants:variantRows.length,valid:products.filter(p=>!p.errors.length).length,invalid:products.filter(p=>p.errors.length).length,duplicates:products.filter(p=>p.errors.some(e=>/duplicat/i.test(e))).length,withVariants:products.filter(p=>p.variants.length).length};
  return {products,refs,problems,counts};
}
function columnFor(message,sheet){const text=message.toLowerCase();for(const [column,label] of [['product name','Product Name'],['category','Category'],['brand','Brand'],['item type','Item Type'],['unit of measure','Unit of Measure'],['warranty','Warranty'],['condition','Condition'],['shipping weight','Shipping Weight (kg)'],['active status','Active Status'],['mark as new','Mark as New'],['variant name','Variant Name'],['quickbooks item code','QuickBooks Item Code'],['cost price','Cost Price'],['selling price','Selling Price'],['cash price','Cash Price'],['card price','Card Price'],['koko price','Koko Price'],['mintpay price','Mintpay Price'],['stock quantity','Stock Quantity'],['reorder quantity','Reorder Quantity'],['stock location','Stock Location'],['default variant','Default Variant']])if(text.includes(column))return label;return sheet==='Variant Specifications'?'Specification':sheet==='Variants'?'Variant Name':'Product Name';}
function validationIssues(data){const issues=[];for(const product of data.products)for(const original of product.errors){let sheet='Products',rowNumber=product.rowNumber,error=original;const prefix=original.match(/^(Variants|Variant Specifications) row (\d+):\s*/);if(prefix){sheet=prefix[1];rowNumber=Number(prefix[2]);error=original.slice(prefix[0].length);}issues.push({sheet,rowNumber,column:columnFor(error,sheet),error,suggestion:'Check this field and correct the value using the choices or format shown in the workbook.'});}for(const problem of data.problems)for(const error of problem.errors)issues.push({sheet:problem.sheet,rowNumber:problem.rowNumber,column:columnFor(error,problem.sheet),error,suggestion:'Check the matching product and variant names, then correct this row.'});const unique=new Map(issues.map(issue=>[`${issue.sheet}:${issue.rowNumber}:${issue.column}:${issue.error}`,issue]));return [...unique.values()];}
function summary(data){return {counts:data.counts,rows:data.products.map(p=>({rowNumber:p.rowNumber,name:p.name,category:p.category?.name||'',brand:p.brand?.name||'',unitOfMeasure:p.unit?.name||'',warranty:p.warranty?.name||'',condition:p.condition||'',shippingWeight:p.shippingWeight,isNew:p.isNew,variants:p.variants.map(v=>({name:v.name,quickbooksItemCode:v.quickbooksItemCode,sellingPrice:v.prices.selling,stock:v.stock,reorderQuantity:v.reorderQuantity,stockLocation:v.locationName})),status:p.errors.length?'Invalid':'Valid',errors:p.errors})),workbookErrors:validationIssues(data)};}

async function template(refsArg){
  const refs=refsArg||await references();const wb=new ExcelJS.Workbook();wb.creator='South West Admin';wb.calcProperties={calcMode:'auto',fullCalcOnLoad:true,forceFullCalc:true};
  const add=(name,headers,rows=[])=>{const sheet=wb.addWorksheet(name);sheet.addRow(headers);sheet.views=[{state:'frozen',ySplit:1}];sheet.autoFilter={from:{row:1,column:1},to:{row:1,column:headers.length}};sheet.columns=headers.map(h=>({header:h,width:Math.max(18,h.length+4)}));const header=sheet.getRow(1);header.font={bold:true,color:{argb:'FFFFFFFF'}};header.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF17365D'}};rows.forEach(r=>sheet.addRow(r));return sheet;};
  const products=add('Products',PRODUCT_HEADERS,[['Example product',refs.categories[0]?.name||'',refs.brands[0]?.name||'',refs.itemTypes[0]?.name||'',refs.units[0]?.name||'','',CONDITION_OPTIONS[0].label,1,'Replace this example description','Active','No']]);
  const variants=add('Variants',VARIANT_HEADERS,[['Example product','Standard',100,150,150,155,160,160,0,0,'','Yes','']]);
  const validation=wb.addWorksheet('_Validation');validation.state='veryHidden';
  const defined=[];
  const lists=[
    ['CategoryList',refs.categories.map(x=>x.name)],
    ['BrandList',refs.brands.map(x=>x.name)],
    ['ItemTypeList',refs.itemTypes.map(x=>x.name)],
    ['UnitList',refs.units.map(x=>x.name)],
    ['WarrantyList',refs.warranties.map(x=>x.name)],
    ['ConditionList',CONDITION_OPTIONS.map(x=>x.label)],
    ['LocationList',refs.locations.map(x=>x.name)]
  ];
  const columns={};
  lists.forEach(([name,values],index)=>{
    const column=index+1,letter=validation.getColumn(column).letter;
    columns[name]=letter;
    const rows=values.length?values:[''];
    rows.forEach((value,rowIndex)=>validation.getCell(rowIndex+2,column).value=value);
    defined.push([name,`'_Validation'!$${letter}$2:$${letter}$${rows.length+1}`]);
  });
  const define=(name,range)=>wb.definedNames.add(range,name);
  for(const [name,range] of defined)define(name,range);
  define('ProductNames',"'Products'!$A$2:$A$501");
  const productLists=[[2,'CategoryList'],[3,'BrandList'],[4,'ItemTypeList'],[5,'UnitList'],[6,'WarrantyList'],[7,'ConditionList']];
  for(let row=2;row<=501;row++){
    for(const [column,name] of productLists)products.getCell(row,column).dataValidation={type:'list',formulae:[`=${name}`],allowBlank:column===6,showErrorMessage:true};
    products.getCell(row,10).dataValidation={type:'list',formulae:['"Active,Inactive"'],allowBlank:false};
    products.getCell(row,11).dataValidation={type:'list',formulae:['"Yes,No"'],allowBlank:true,showErrorMessage:true,errorTitle:'Invalid new-product setting',error:'Choose Yes or No.'};
    products.getCell(row,8).dataValidation={type:'decimal',operator:'greaterThan',formulae:[0],allowBlank:false,showErrorMessage:true,errorTitle:'Shipping weight required',error:'Enter a positive shipping weight in kilograms with up to three decimal places.'};
    products.getCell(row,8).numFmt='0.000';
  }
  for(let row=2;row<=501;row++){
    variants.getCell(row,1).dataValidation={type:'list',formulae:['=ProductNames'],allowBlank:false};
    variants.getCell(row,3).numFmt=variants.getCell(row,4).numFmt=variants.getCell(row,5).numFmt=variants.getCell(row,6).numFmt=variants.getCell(row,7).numFmt=variants.getCell(row,8).numFmt='"LKR "#,##0.00';
    variants.getCell(row,9).numFmt='0.000';
    variants.getCell(row,10).dataValidation={type:'decimal',operator:'greaterThanOrEqual',formulae:[0],allowBlank:true,showErrorMessage:true,errorTitle:'Invalid reorder quantity',error:'Enter zero or a positive quantity with up to three decimal places.'};
    variants.getCell(row,10).numFmt='0.000';
    variants.getCell(row,11).dataValidation={type:'list',formulae:['=LocationList'],allowBlank:true};
    variants.getCell(row,12).dataValidation={type:'list',formulae:['"Yes,No"'],allowBlank:false};
    variants.getCell(row,13).numFmt='@';
  }
  const instructions=add('Instructions',['Step','What to do'],[
    ['1. Products','Add one row per product. Product Name must be unique in this workbook. Choose Category, Brand, and Item Type from the lists. Mark as New is optional and defaults to No. This badge setting does not make a never-stocked product visible in the storefront.'],
    ['2. Variants','Every product needs at least one variant. Variants for different products can be mixed in any order. Choose its Product Name from the list. Enter a Selling Price and all four checkout prices. Cost Price is optional. QuickBooks Item Code is optional text for the individual variant.'],
    ['3. Stock','Enter a non-negative Stock Quantity and Reorder Quantity for each variant. Reorder Quantity accepts zero or a positive quantity with up to three decimal places. Choose an active Stock Location when either quantity is positive. Leave Stock Quantity blank or enter 0 if there is no opening stock.'],
    ['4. Default','Mark one variant Yes as the default. If none is marked Yes, the first variant for that product will be used.'],
    ['5. Upload','Save as .xlsx, upload, review all messages and correct blocking errors, then confirm the import. The system creates product codes and variant SKUs automatically.'],
    ['6. Add specifications','After the import completes, open Products > Variants in admin and edit each variant to enter its configured specifications. Required specification values are managed on the variant after import. Shipping Weight is entered in kilograms.']
  ]);instructions.getColumn(1).width=22;instructions.getColumn(2).width=105;
  const refsSheet=add('Reference Lists',['Categories','Brands','Item Types','Units of Measure','Warranties','Conditions','Stock Locations']);
  const max=Math.max(refs.categories.length,refs.brands.length,refs.itemTypes.length,refs.units.length,refs.warranties.length,refs.locations.length,1);
  for(let i=0;i<max;i++)refsSheet.addRow([refs.categories[i]?.name||'',refs.brands[i]?.name||'',refs.itemTypes[i]?.name||'',refs.units[i]?.name||'',refs.warranties[i]?.name||'',CONDITION_OPTIONS[i]?.label||'',refs.locations[i]?.name||'']);
  for(const column of [1,2,3,4,5,7,8,10])products.getRow(1).getCell(column).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFC65911'}};
  for(const column of [1,2,4,5,6,7,8,11,12])variants.getRow(1).getCell(column).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFC65911'}};
  return wb.xlsx.writeBuffer();
}
async function report(buffer){const parsed=await parseAndValidate(buffer);const wb=new ExcelJS.Workbook();await wb.xlsx.load(buffer);let reportName='Import Error Report',suffix=2;while(wb.getWorksheet(reportName))reportName=`Import Error Report ${suffix++}`;const sheet=wb.addWorksheet(reportName);sheet.addRow(['Worksheet','Excel Row','Column','Problem','Suggested correction']);for(const issue of validationIssues(parsed))sheet.addRow([issue.sheet,issue.rowNumber,issue.column,issue.error,issue.suggestion]);sheet.columns=[{width:30},{width:14},{width:24},{width:90},{width:75}];sheet.views=[{state:'frozen',ySplit:1}];sheet.autoFilter={from:{row:1,column:1},to:{row:1,column:5}};return wb.xlsx.writeBuffer();}

async function importProducts(buffer,userId,reqMeta={},rowFilter=null){
  const parsed=await parseAndValidate(buffer);const selected=rowFilter?parsed.products.filter(p=>rowFilter.includes(p.rowNumber)):parsed.products;if(selected.some(p=>p.errors.length)||parsed.problems.length)throw new Error('The workbook has validation issues. Correct the workbook and upload it again before importing.');const eligible=selected;const rejected=[];const results=[];
  for(const p of eligible){const transaction=await sequelize.transaction();try{
    const itemCode=await generateItemCode(transaction);const slug=slugify(p.name);let finalSlug=slug,suffix=2;while(await Item.findOne({where:{slug:finalSlug},transaction,attributes:['id']}))finalSlug=`${slug.slice(0,180-String(suffix).length)}-${suffix++}`;
    const item=await Item.create({item_code:itemCode,public_id:randomUUID(),slug:finalSlug,qb_item_code:null,item_name:p.name,category_id:p.category.id,brand_id:p.brand.id,unit_id:p.unit?.id||null,item_type_id:p.itemType?.id||null,warranty_id:p.warranty?.id||null,description:p.description||null,shipping_weight:p.shippingWeight,shipping_weight_unit:'kg',condition:p.condition,is_active:p.active,is_new:p.isNew},{transaction});
    for(const v of p.variants){const sku=generateVariantSku(item.item_code,v.name);const variant=await ItemVariant.create({item_id:item.id,variant_sku:sku,variant_name:v.name,attributes:v.attributes,qb_item_code:v.quickbooksItemCode||null,is_default:v.isDefault,is_active:p.active},{transaction});
      await auditImportedRecord({userId,action:'ITEM_VARIANT_CREATED',module:'items',entityType:'item_variant',entityId:variant.id,description:`Variant ${variant.variant_sku} created through bulk import`,newValues:{item_id:item.id,variant_sku:variant.variant_sku,variant_name:variant.variant_name,qb_item_code:variant.qb_item_code,is_default:variant.is_default,is_active:variant.is_active},...reqMeta,transaction});
      for(const [priceType,amount] of [['cost',v.prices.cost],['selling',v.prices.selling]])if(amount!==null){const priceRecord=await ItemPrice.create({item_id:item.id,variant_id:variant.id,price_type:priceType,price:amount,currency:'LKR',is_active:p.active},{transaction});await auditImportedRecord({userId,action:'ITEM_PRICE_CREATED',module:'inventory',entityType:'item_price',entityId:priceRecord.id,description:`${priceType} price created for imported variant ${variant.variant_sku}`,newValues:{item_id:item.id,variant_id:variant.id,price_type:priceType,price:amount,currency:'LKR',is_active:p.active},...reqMeta,transaction});}
      for(const method of ['cash','card','koko','mintpay']){const paymentPrice=await ItemPaymentPrice.create({item_id:item.id,variant_id:variant.id,payment_method:method,price:v.prices[method],currency:'LKR',is_active:p.active},{transaction});await auditImportedRecord({userId,action:'ITEM_PAYMENT_PRICE_CREATED',module:'inventory',entityType:'item_payment_price',entityId:paymentPrice.id,description:`${method} payment price created for imported variant ${variant.variant_sku}`,newValues:{item_id:item.id,variant_id:variant.id,payment_method:method,price:v.prices[method],currency:'LKR',is_active:p.active},...reqMeta,transaction});}
      if(v.stock>0||v.reorderQuantity>0){const location=v.location;if(!location||!isActive(location.is_active))throw new Error(`Choose an active stock location for variant ${v.name}.`);if(v.stock>0&&!variant.is_active)throw new Error(`Opening stock cannot be recorded for inactive variant ${v.name}.`);const where={item_id:item.id,variant_id:variant.id,location_id:location.id};let balance=await InventoryStock.findOne({where,transaction,lock:transaction.LOCK.UPDATE});const previous=Number(balance?.quantity_on_hand||0),next=previous+v.stock;if(balance)await balance.update({quantity_on_hand:next,reorder_quantity:v.reorderQuantity},{transaction});else await InventoryStock.create({...where,quantity_on_hand:next,quantity_reserved:0,reorder_level:0,reorder_quantity:v.reorderQuantity,is_active:true},{transaction});if(v.stock>0){const movement=await InventoryStockMovement.create({item_id:item.id,variant_id:variant.id,location_id:location.id,movement_type:'goods_receipt',quantity:v.stock,reference_type:'bulk_product_import',reference_id:null,notes:`Opening stock imported for ${item.item_code} / ${variant.variant_sku}.`,created_by:userId||null,created_at:new Date()},{transaction});await auditImportedRecord({userId,action:'INVENTORY_STOCK_MOVEMENT_CREATED',module:'inventory',entityType:'inventory_stock_movement',entityId:movement.id,description:`Opening stock recorded for ${item.item_code} at ${location.name}`,oldValues:{quantity_on_hand:previous},newValues:{quantity_on_hand:next,reorder_quantity:v.reorderQuantity,movement_type:'goods_receipt',quantity:v.stock,reference_type:'bulk_product_import'},...reqMeta,transaction});}}
    }
    await auditImportedRecord({userId,action:'ITEM_CREATED',module:'items',entityType:'item',entityId:item.id,description:`Item ${item.item_code} created through bulk import`,newValues:{item_code:item.item_code,item_name:item.item_name,category_id:item.category_id,brand_id:item.brand_id,unit_id:item.unit_id,item_type_id:item.item_type_id,warranty_id:item.warranty_id,condition:item.condition,shipping_weight:item.shipping_weight,shipping_weight_unit:item.shipping_weight_unit,is_new:item.is_new,source:'bulk-import'},...reqMeta,transaction});await transaction.commit();results.push({rowNumber:p.rowNumber,name:p.name,status:'Imported',itemCode});
  }catch(error){if(!transaction.finished)await transaction.rollback();results.push({rowNumber:p.rowNumber,name:p.name,status:'Failed',error:error.message});}}
  for(const p of rejected)results.push({rowNumber:p.rowNumber,name:p.name,status:'Rejected',errors:p.errors});return {imported:results.filter(r=>r.status==='Imported').length,failed:results.filter(r=>r.status!=='Imported').length,results};
}
module.exports={PRODUCT_HEADERS,VARIANT_HEADERS,parseAndValidate,summary,template,report,importProducts};
