'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const ExcelJS=require('exceljs');
const proxyquire=require('proxyquire').noCallThru();

function response(){return {statusCode:200,headers:{},status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;},set(name,value){this.headers[name]=value;return this;},send(value){this.sent=value;return this;}};}
async function workbookBuffer(){const workbook=new ExcelJS.Workbook();workbook.addWorksheet('Products').addRow(['Product Name']);return workbook.xlsx.writeBuffer();}

test('confirmation is user-bound, locked while processing, and idempotent after completion',async()=>{
  let calls=0,release;const pending=new Promise(resolve=>{release=resolve;});
  const service={
    parseAndValidate:async()=>({products:[{errors:[]}],problems:[]}),
    summary:()=>({counts:{products:1,valid:1,invalid:0},rows:[],workbookErrors:[]}),
    importProducts:async()=>{calls++;await pending;return {imported:1,failed:0,results:[{rowNumber:2,name:'Cable',status:'Imported',itemCode:'SW-1'}]}},
    template:async()=>Buffer.from(''),report:async()=>Buffer.from('')
  };
  const controller=proxyquire('../controllers/bulkProductImportController',{'../services/bulkProductImportService':service});
  const uploadRes=response();await controller.upload({file:{buffer:await workbookBuffer(),size:100,originalname:'items.xlsx',mimetype:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'},user:{id:17}},uploadRes);
  const id=uploadRes.body.importId;assert.ok(id);
  const otherUserRes=response();await controller.confirm({params:{id},body:{confirm:true},user:{id:18}},otherUserRes);assert.equal(otherUserRes.statusCode,404);
  const request={params:{id},body:{confirm:true},user:{id:17},ip:'127.0.0.1',get:()=>''};const firstRes=response();const first=controller.confirm(request,firstRes);
  const concurrentRes=response();await controller.confirm(request,concurrentRes);assert.equal(concurrentRes.statusCode,409);
  release();await first;assert.equal(firstRes.body.imported,1);assert.equal(calls,1);
  const repeatedRes=response();await controller.confirm(request,repeatedRes);assert.equal(repeatedRes.body.imported,1);assert.equal(calls,1);
});
