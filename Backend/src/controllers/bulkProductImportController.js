'use strict';
const ExcelJS=require('exceljs');
const service=require('../services/bulkProductImportService');
const MAX_BYTES=10*1024*1024;
// Process-local temporary storage: uploads are user-bound, expire after 30 minutes,
// and are capped to bound memory. Production deployments must keep import routes
// on one worker (or replace this store with a shared ephemeral store).
const uploads=new Map();
const MAX_STORED_BYTES=100*1024*1024;
let storedBytes=0,pendingUploads=0;
const token=()=>require('crypto').randomBytes(24).toString('hex');
function cleanupExpired(){const cutoff=Date.now()-30*60*1000;for(const [key,value] of uploads){if(value.createdAt<cutoff&&!value.processing){storedBytes-=value.buffer.length;uploads.delete(key);}}}
const cleanupTimer=setInterval(cleanupExpired,5*60*1000);cleanupTimer.unref?.();
const upload=async(req,res)=>{
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
    const parsed=await service.parseAndValidate(file.buffer);const id=token();uploads.set(id,{buffer:file.buffer,userId:req.user?.id??req.user?.userId,createdAt:Date.now(),processing:false,result:null});pendingUploads--;slotReserved=false;reservation=0;
    return res.json({message:'Workbook validated.',importId:id,...service.summary(parsed)});
  }catch(error){if(slotReserved)pendingUploads--;if(reservation)storedBytes-=reservation;return res.status(400).json({message:error.message||'Unable to validate workbook.'});}
};
const downloadTemplate=async(req,res)=>{try{const buffer=await service.template();res.set('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');res.set('Content-Disposition','attachment; filename="south-west-product-import-template.xlsx"');res.send(Buffer.from(buffer));}catch(error){res.status(500).json({message:'Unable to generate template.'});}};
const errorReport=async(req,res)=>{try{cleanupExpired();const entry=uploads.get(req.params.id);if(!entry||entry.userId!==(req.user?.id??req.user?.userId))return res.status(404).json({message:'Validation result expired or not found.'});const buffer=await service.report(entry.buffer);res.set('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');res.set('Content-Disposition','attachment; filename="product-import-errors.xlsx"');res.send(Buffer.from(buffer));}catch(error){res.status(400).json({message:'Unable to generate error report.'});}};
const confirm=async(req,res)=>{const id=req.params.id;try{if(req.body?.confirm!==true)return res.status(400).json({message:'Explicit import confirmation is required.'});cleanupExpired();const entry=uploads.get(id);if(!entry||entry.userId!==(req.user?.id??req.user?.userId))return res.status(404).json({message:'Validation result expired or not found.'});if(entry.processing)return res.status(409).json({message:'This import is already being processed.'});if(entry.result&&!req.body?.retry)return res.json({message:'Import processing complete.',...entry.result});const retryRows=entry.result?.results?.filter(row=>row.status==='Failed').map(row=>row.rowNumber)||null;if(entry.result&&(!req.body?.retry||!retryRows?.length))return res.json({message:'Import processing complete.',...entry.result});entry.processing=true;const current=await service.parseAndValidate(entry.buffer);const selected=retryRows?current.products.filter(p=>retryRows.includes(p.rowNumber)):current.products;if(selected.some(p=>p.errors.length)||current.problems.length){entry.processing=false;return res.status(422).json({message:'The workbook has errors. Correct them and upload it again before importing.',...service.summary(current)});}
  const results=await service.importProducts(entry.buffer,req.user?.id??req.user?.userId,{ipAddress:req.ip,userAgent:req.get('user-agent'),requestId:req.id},retryRows);entry.result=retryRows?{imported:entry.result.imported+results.imported,failed:results.failed,results:[...entry.result.results.filter(row=>row.status!=='Failed'),...results.results]}:results;entry.processing=false;entry.completedAt=Date.now();res.json({message:'Import processing complete.',...entry.result});
}catch(error){const entry=uploads.get(id);if(entry)entry.processing=false;res.status(400).json({message:error.message||'Import could not be completed.'});}};
module.exports={upload,downloadTemplate,errorReport,confirm,MAX_BYTES};
