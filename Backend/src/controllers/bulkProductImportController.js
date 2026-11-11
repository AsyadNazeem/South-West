'use strict';
const ExcelJS=require('exceljs');
const service=require('../services/bulkProductImportService');
const {recordAuditLog}=require('../services/auditLogService');
const MAX_BYTES=10*1024*1024;
// Process-local temporary storage: uploads are user-bound, expire after 30 minutes,
// and are capped to bound memory. Production deployments must keep import routes
// on one worker (or replace this store with a shared ephemeral store).
const uploads=new Map();
const MAX_STORED_BYTES=100*1024*1024;
let storedBytes=0,pendingUploads=0;
const token=()=>require('crypto').randomBytes(24).toString('hex');
const safeFilename=value=>String(value||'upload.xlsx').split(/[\\/]/).pop().replace(/[\u0000-\u001f\u007f]/g,'').replace(/[^a-zA-Z0-9._ -]/g,'_').replace(/^\.+/,'').slice(0,120)||'upload.xlsx';
async function auditImport(req,entry,action,summary={}){try{await recordAuditLog({userId:req.user?.id??req.user?.userId??null,action,module:'items',entityType:'bulk_product_import',entityId:entry?.id||null,description:'Product workbook import '+String(summary.result||'operation').toLowerCase(),newValues:{import_type:'products',filename:entry?.filename||null,...summary},ipAddress:req.ip||null,userAgent:req.get?.('user-agent')||null,requestId:req.id||null});}catch(error){console.error('Unable to write product import audit event:',error.message);}}
function rowCounts(results,parsed){
  const byRow=new Map((parsed.products||[]).map(product=>[product.rowNumber,product]));
  const counts={total_rows:(parsed.products||[]).length+(parsed.counts?.variants||0),successful_rows:0,failed_rows:0,skipped_rows:0,records_created:0,records_updated:0,variants_created:0,records_failed:0};
  for(const result of results||[]){const product=byRow.get(result.rowNumber);const variants=product?.variants?.length||0;const rows=1+variants;if(result.status==='Imported'){counts.successful_rows+=rows;counts.records_created++;counts.variants_created+=variants;}else{counts.failed_rows+=rows;counts.records_failed++;}}
  counts.skipped_rows=Math.max(0,counts.total_rows-counts.successful_rows-counts.failed_rows);
  return counts;
}
function validationRowCounts(parsed){
  const total=(parsed.products||[]).length+(parsed.counts?.variants||0);
  const invalid=new Set((parsed.products||[]).filter(product=>product.errors?.length).map(product=>product.rowNumber));
  let failed=0;
  for(const product of parsed.products||[])if(invalid.has(product.rowNumber))failed+=1+(product.variants||[]).length;
  failed+=parsed.problems?.length||0;
  return {total_rows:total,successful_rows:0,failed_rows:Math.min(total,failed),skipped_rows:Math.max(0,total-failed),records_created:0,records_updated:0,variants_created:0,records_failed:invalid.size};
}
function cleanupExpired(){const cutoff=Date.now()-30*60*1000;for(const [key,value] of uploads){if(value.createdAt<cutoff&&!value.processing){storedBytes-=value.buffer.length;uploads.delete(key);}}}
const cleanupTimer=setInterval(cleanupExpired,5*60*1000);cleanupTimer.unref?.();
const upload=async(req,res)=>{
  const startedAt=Date.now();
  let reservation=0,slotReserved=false;
  try {
    const file=req.file;
    if(!file||!file.buffer)return res.status(400).json({message:'Upload an .xlsx workbook.'});
    if(file.size>MAX_BYTES)return res.status(413).json({message:'Workbook exceeds the 10 MB limit.'});
    if(!file.originalname.toLowerCase().endsWith('.xlsx')||file.mimetype!=='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')return res.status(400).json({message:'Only .xlsx workbooks are accepted.'});
    const signature=file.buffer.subarray(0,4).toString('hex');
    if(signature!=='504b0304')return res.status(400).json({message:'The uploaded file is not a valid .xlsx workbook.'});
    const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(file.buffer);
    if(!workbook.worksheets.length)return res.status(400).json({message:'The uploaded file is not a valid Excel workbook.'});
    cleanupExpired();if(uploads.size+pendingUploads>=20||storedBytes+file.buffer.length>MAX_STORED_BYTES)return res.status(429).json({message:'Temporary import storage is at capacity. Try again later.'});
    pendingUploads++;slotReserved=true;storedBytes+=file.buffer.length;reservation=file.buffer.length;
    const parsed=await service.parseAndValidate(file.buffer);const counts=parsed.counts||{};const id=token();const entry={id,buffer:file.buffer,userId:req.user?.id??req.user?.userId,createdAt:Date.now(),startedAt,filename:safeFilename(file.originalname),processing:false,result:null};uploads.set(id,entry);pendingUploads--;slotReserved=false;reservation=0;
    const validationCounts=validationRowCounts(parsed);await auditImport(req,entry,'BULK_PRODUCT_IMPORT_VALIDATED',{...validationCounts,valid_products:counts.valid||0,duration_ms:Date.now()-startedAt,result:(counts.invalid||parsed.problems?.length)?'VALIDATION_FAILED':'VALIDATED'});
    return res.json({message:'Workbook validated.',importId:id,...service.summary(parsed)});
  }catch(error){if(slotReserved)pendingUploads--;if(reservation)storedBytes-=reservation;await auditImport(req,{filename:safeFilename(req.file?.originalname)},'BULK_PRODUCT_IMPORT_VALIDATION_FAILED',{result:'FAILURE',duration_ms:Date.now()-startedAt,error_summary:'Workbook validation failed'});return res.status(400).json({message:error.message||'Unable to validate workbook.'});}
};
const downloadTemplate=async(req,res)=>{try{const buffer=await service.template();res.set('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');res.set('Content-Disposition','attachment; filename="south-west-product-import-template.xlsx"');res.send(Buffer.from(buffer));}catch(error){res.status(500).json({message:'Unable to generate template.'});}};
const errorReport=async(req,res)=>{try{cleanupExpired();const entry=uploads.get(req.params.id);if(!entry||entry.userId!==(req.user?.id??req.user?.userId))return res.status(404).json({message:'Validation result expired or not found.'});const buffer=await service.report(entry.buffer);res.set('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');res.set('Content-Disposition','attachment; filename="product-import-errors.xlsx"');res.send(Buffer.from(buffer));}catch(error){res.status(400).json({message:'Unable to generate error report.'});}};
const confirm=async(req,res)=>{const id=req.params.id;let entry;try{if(req.body?.confirm!==true)return res.status(400).json({message:'Explicit import confirmation is required.'});cleanupExpired();entry=uploads.get(id);if(!entry||entry.userId!==(req.user?.id??req.user?.userId))return res.status(404).json({message:'Validation result expired or not found.'});if(entry.processing)return res.status(409).json({message:'This import is already being processed.'});if(entry.result&&!req.body?.retry)return res.json({message:'Import processing complete.',...entry.result});const retryRows=entry.result?.results?.filter(row=>row.status==='Failed').map(row=>row.rowNumber)||null;if(entry.result&&(!req.body?.retry||!retryRows?.length))return res.json({message:'Import processing complete.',...entry.result});entry.processing=true;const current=await service.parseAndValidate(entry.buffer);const selected=retryRows?current.products.filter(p=>retryRows.includes(p.rowNumber)):current.products;if(selected.some(p=>p.errors.length)||current.problems.length){entry.processing=false;await auditImport(req,entry,'BULK_PRODUCT_IMPORT_FAILED',{...validationRowCounts(current),duration_ms:Date.now()-entry.startedAt,result:'FAILURE',error_summary:'Workbook validation failed'});return res.status(422).json({message:'The workbook has errors. Correct them and upload it again before importing.',...service.summary(current)});}
  const results=await service.importProducts(entry.buffer,req.user?.id??req.user?.userId,{ipAddress:req.ip,userAgent:req.get('user-agent'),requestId:req.id,importSummaryOnly:true},retryRows);const combinedResults=retryRows?[...entry.result.results.filter(row=>row.status!=='Failed'),...results.results]:results.results;entry.result={imported:combinedResults.filter(row=>row.status==='Imported').length,failed:combinedResults.filter(row=>row.status!=='Imported').length,results:combinedResults};entry.processing=false;entry.completedAt=Date.now();const counts=rowCounts(combinedResults,current);await auditImport(req,entry,'BULK_PRODUCT_IMPORT',{...counts,duration_ms:entry.completedAt-entry.startedAt,result:counts.failed_rows?(counts.successful_rows?'PARTIAL_SUCCESS':'FAILURE'):'SUCCESS',error_summary:counts.failed_rows?'One or more product rows failed':'None'});res.json({message:'Import processing complete.',...entry.result});
}catch(error){if(entry)entry.processing=false;await auditImport(req,entry,'BULK_PRODUCT_IMPORT_FAILED',{result:'FAILURE',duration_ms:entry?Date.now()-entry.createdAt:null,error_summary:'Import processing failed'});res.status(400).json({message:error.message||'Import could not be completed.'});}};
module.exports={upload,downloadTemplate,errorReport,confirm,MAX_BYTES};
