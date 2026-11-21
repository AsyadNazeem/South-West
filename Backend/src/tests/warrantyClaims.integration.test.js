'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

// Only a newly allocated schema on an explicitly selected local Unix socket is used.
test('warranty purchase, submissions, permissions, archives and notification retries', {
    skip: !process.env.WARRANTY_TEST_SOCKET, timeout: 90000
}, async t => {
    const mysql = require('mysql2/promise');
    const { DataTypes } = require('sequelize');
    const socketPath = process.env.WARRANTY_TEST_SOCKET;
    const schema = 'sw_warranty_test_' + randomUUID().replaceAll('-','');
    const root = await mysql.createConnection({ socketPath, user: 'root' });
    await root.query('CREATE DATABASE ' + schema);
    t.after(async () => { await root.query('DROP DATABASE ' + schema); await root.end(); });
    const config = require('../config/sequelize-config');
    config.test = { dialect: 'mysql', username: 'root', database: schema, dialectOptions: { socketPath },
        timezone: '+00:00', logging: false };
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = randomUUID();
    process.env.CUSTOMER_JWT_SECRET = randomUUID();
    const db = require('../models');
    const storage = await fs.mkdtemp(path.join(os.tmpdir(),'sw-claim-test-'));
    process.env.WARRANTY_STORAGE = storage;
    t.after(async () => { await db.sequelize.close(); await fs.rm(storage,{ recursive:true, force:true }); });
    const q = db.sequelize.getQueryInterface();
    // The pre-existing module tables use production column types. Unrelated catalog dependencies are omitted.
    for (const name of ['Customer','User','Role','Permission','RolePermission','UserRole','CustomerSession','UserSession',
        'Order','OrderAddress','Item','OrderItem','Warranty','Invoice','AdminNotification','AuditLog']) {
        const model = db[name];
        const attrs = Object.fromEntries(Object.entries(model.rawAttributes).map(([key,value]) => {
            const { references, onUpdate, onDelete, ...attr } = value;
            return [key,attr];
        }));
        await q.createTable(model.tableName, attrs);
    }
    const migration = require('../migrations/20261121100000-create-warranty-claims');
    await migration.up(q,DataTypes);
    await migration.up(q,DataTypes);
    const recipients = require('../migrations/20261121120000-warranty-mail-recipients');
    await recipients.up(q,DataTypes);
    await recipients.up(q,DataTypes);
    const role = await db.Role.create({ name:'Admin' });
    const view = await db.Role.create({ name:'Fixture viewer' });
    await require('../migrations/20261121101000-grant-warranty-permissions').up(q);
    const permission = await db.Permission.findOne({ where:{name:'warranty_claims.view'} });
    await view.addPermission(permission);
    await role.addPermission(await db.Permission.create({name:'audit_logs.view',module:'audit_logs'}));
    const expires_at = new Date(Date.now()+3600000);
    const hash = s => createHash('sha256').update(s).digest('hex');
    async function staff(role) {
        const u = await db.User.create({email:randomUUID()+'@example.invalid'});
        if (role) await u.addRole(role);
        const token = require('../utils/jwt').generateToken({userId:u.id});
        await db.UserSession.create({user_id:u.id,refresh_token_hash:hash(token),expires_at});
        return token;
    }
    async function customer(code) {
        const c = await db.Customer.create({customer_code:code,first_name:code,last_name:'Tester',email:code+'@example.invalid', email_verified_at:new Date()});
        const sessionId = randomUUID();
        const token = require('jsonwebtoken').sign({customerId:c.id,sessionId,type:'customer'},process.env.CUSTOMER_JWT_SECRET,
            { issuer:'south-west-api', audience:'south-west-customers',expiresIn:'1h' });
        await db.CustomerSession.create({ customer_id:c.id,session_uuid:sessionId,token_hash:hash(token),expires_at });
        return {c,token};
    }
    const admin = await staff(role), viewer = await staff(view), ordinary = await staff();
    const {c,token} = await customer('Owner'), other = await customer('Other');
    const order = await db.Order.create({ customer_id:c.id,order_number:'TEST-1',order_type:'online',order_date:new Date(),status:'delivered',payment_status:'paid' });
    await db.Invoice.create({ customer_id:c.id,order_id:order.id,invoice_number:'INV-1',invoice_date:new Date(),status:'paid' });
    for (const n of [1,2]) {
        const product = await db.Item.create({item_code:'TEST-'+n,public_id:randomUUID(),slug:'test-'+n,item_name:'Test '+n});
        await db.OrderItem.create({order_id:order.id,item_id:product.id,quantity:1,unit_price:1,line_total:1});
    }
    const express = require('express'), app = express();
    const routes = require('../routes/warrantyClaimRoutes');
    app.use(express.json()); app.use('/my',routes.customer); app.use('/admin',routes.admin);
    app.use('/audit-logs',require('../routes/auditLogRoutes'));
    const server = await new Promise(resolve => { const s = app.listen(0,'127.0.0.1',()=>resolve(s)); });
    t.after(() => new Promise(resolve=>server.close(resolve)));
    const base = 'http://127.0.0.1:'+server.address().port;
    async function call(url,bearer,data,headers={}) {
        if (bearer) headers.Authorization = 'Bearer '+bearer;
        let body = data;
        if (data && !(data instanceof FormData)) { headers['Content-Type']='application/json'; body=JSON.stringify(data); }
        return fetch(base+url,{method:data?'POST':'GET',headers,body});
    }
    const png = await require('sharp')({create:{width:16,height:12,channels:3,background:'white'}}).png().toBuffer();
    const key = randomUUID();
    function form(line='2',answer=false) {
        const f = new FormData();
        const values = answer ? {explanation:'More photos'} : {number:'INV-1',order_item_id:line,phone:'0771234567',reason:'Photo shows defect'};
        for (const [k,v] of Object.entries(values)) f.append(k,v);
        f.append('photos',new Blob([png],{type:'application/octet-stream'}),'untrusted.png');
        return f;
    }
    const send = (f,k=key) => call('/my',token,f,{'Idempotency-Key':k});
    async function expect(response,status) {
        const r = await response;
        if (r.status !== status) assert.fail(r.status+' '+await r.text()+' (expected '+status+')');
        return r;
    }
    await expect(call('/my'),401);
    await expect(call('/admin',ordinary),403);
    for (const number of ['INV-1','TEST-1']) {
        await expect(call('/my/purchase?number='+number,other.token),404);
        const p = await (await expect(call('/my/purchase?number='+number,token),200)).json();
        assert.equal(p.products.length,2);
    }
    await expect(call('/my/purchase?number='+encodeURIComponent("x'"),token),400);
    await expect(send(form('999')),400);
    const first = await (await expect(send(form()),201)).json();
    assert.deepEqual(await (await expect(send(form()),201)).json(),first);
    await expect(send(form(),randomUUID()),409);
    const my = '/my/'+first.id, a = '/admin/'+first.id;
    await expect(call(my,other.token),404);
    assert.equal((await (await call('/my',other.token)).json()).count,0);
    await expect(call(a+'/status',viewer,{status:'Under Review'}),403);
    await expect(call(a+'/archive',viewer),403);
    await expect(call(a+'/status',admin,{status:'Approved'}),409);
    await expect(call(a+'/status',admin,{status:'Under Review',internal_note:'staff-only'}),204);
    await expect(call(a+'/note',admin,{internal_note:'Do not log this private note'}),204);
    await expect(call(a+'/request',admin,{reason:'Show serial',instructions:'Use daylight'}),204);
    await expect(call(a+'/request',admin,{reason:'Repeat'}),409);
    const detail = await (await call(my,token)).json();
    assert.ok(!JSON.stringify(detail).includes('staff-only'));
    await expect(call(my+'/files/'+detail.evidence[0].id,other.token),404);
    await expect(call(a+'/files/'+detail.evidence[0].id,viewer),403);
    const image = Buffer.from(await (await expect(call(my+'/files/'+detail.evidence[0].id,token),200)).arrayBuffer());
    assert.equal((await require('sharp')(image).metadata()).format,'webp');
    await expect(call(a+'/files/'+detail.evidence[0].id,admin),200);
    await expect(call(a+'/files/'+detail.evidence[0].id+'?preview=1',admin),200);
    const response = my+'/requests/'+detail.requests[0].id;
    await expect(call(response,other.token,form('2',true)),404);
    const replies = await Promise.all([1,2].map(()=>call(response,token,form('2',true))));
    assert.deepEqual(replies.map(r=>r.status).sort(),[201,409]);
    assert.equal(await db.AdminNotification.count(),2);
    const [reviewer] = await (await expect(call('/admin/staff',admin),200)).json();
    for (let i=0;i<2;i++) await expect(call(a+'/assign',admin,{assigned_staff_id:reviewer.id}),204);
    const alerts = await db.AdminNotification.findAll({order:[['id','ASC']]});
    assert.deepEqual(alerts.map(n=>n.type),['warranty_submitted','warranty_evidence','warranty_assignment']);
    assert.ok(alerts.every(n=>String(n.user_id)===String(reviewer.id) && String(n.reference_id)===String(first.id)));
    const archive = await expect(call(a+'/archive',admin),200);
    const entries = (await require('unzipper').Open.buffer(Buffer.from(await archive.arrayBuffer()))).files;
    assert.equal(entries.length,3);
    assert.ok(entries.every(e=>/^(manifest\.json|(initial|request-\d+)\/[a-f\d-]+\.webp)$/.test(e.path)));
    await expect(call(a+'/status',admin,{status:'Approved'}),204);
    await expect(call(a+'/status',admin,{status:'Approved'}),409);
    for (const status of ['Processing','Resolved','Closed']) await expect(call(a+'/status',admin,{status}),204);
    assert.equal(await db.WarrantyMail.count(),9);
    const staffDetail = await (await expect(call(a,admin),200)).json();
    assert.equal(staffDetail.customerMail.length,8);
    assert.equal(staffDetail.customerMail[0].state,'pending');
    assert.ok(!('customerMail' in detail));
    assert.equal((await fs.readdir(storage)).length,2);
    const email = require('../services/emailService');
    let attempts = 0;
    email.sendWarrantyUpdate = async () => { attempts++; if (attempts===1) throw Error('fixture failure'); };
    let adminDeliveries = 0;
    email.sendAdminWarrantyClaim = async (user, submitted, history, photos, videos) => {
        assert.equal(user.email,reviewer.email);
        assert.equal(submitted.reference,first.reference);
        assert.equal(history.new_status,'Submitted');
        assert.deepEqual([photos,videos],[1,0]);
        adminDeliveries++;
    };
    const { drain } = require('../../scripts/warranty-mail');
    await drain();
    assert.equal(await db.WarrantyMail.count({where:{state:'sent'}}),8);
    await db.WarrantyMail.update({available_at:new Date(0)},{where:{state:'pending'}});
    await drain(); await drain();
    assert.equal(attempts,9);
    assert.equal(adminDeliveries,1);
    await t.test('existing audit endpoint filters warranty actions and enforces its own permission', async () => {
        await expect(call('/audit-logs?module=warranty_claims',viewer),403);
        const audit = await (await expect(call('/audit-logs?module=warranty_claims&entity_type=warranty_claim&limit=100',admin),200)).json();
        const events = name => audit.data.filter(row => row.action === 'WARRANTY_CLAIM_' + name);
        const counts = {SUBMITTED:1,VIEWED:1,STATUS_CHANGED:3,APPROVED:1,CLOSED:1,INTERNAL_NOTE_ADDED:1,
            EVIDENCE_REQUESTED:1,EVIDENCE_SUBMITTED:1,REVIEWER_CHANGED:1,EVIDENCE_DOWNLOADED:1,EVIDENCE_PREVIEWED:1,ZIP_DOWNLOADED:1,
            EMAIL_SENT:9,EMAIL_FAILED:1};
        assert.equal(audit.pagination.total,Object.values(counts).reduce((a,b)=>a+b,0));
        for (const [action,n] of Object.entries(counts)) assert.equal(events(action).length,n,action);
        for (const row of audit.data) {
            assert.equal(row.entity_id,String(first.id));
            assert.equal(row.new_values.claim_reference,first.reference);
            assert.ok(Number.isFinite(Date.parse(row.created_at)));
            if (row.action.includes('_EMAIL_')) {
                assert.equal(row.new_values.actor_type,'system');
                assert.equal(row.user_id,null);
            } else if (['WARRANTY_CLAIM_SUBMITTED','WARRANTY_CLAIM_EVIDENCE_SUBMITTED'].includes(row.action)) {
                assert.equal(row.new_values.actor_type,'customer');
                assert.equal(String(row.new_values.actor_id),String(c.id));
                assert.equal(row.user_id,null);
            } else {
                assert.equal(row.new_values.actor_type,'staff');
                assert.equal(String(row.user_id),String(reviewer.id));
            }
        }
        assert.equal(events('APPROVED')[0].old_values.status,'Evidence Submitted');
        assert.equal(events('APPROVED')[0].new_values.status,'Approved');
        assert.equal(events('CLOSED')[0].old_values.status,'Resolved');
        assert.equal(events('REVIEWER_CHANGED')[0].old_values.assigned_staff_id,null);
        assert.equal(String(events('REVIEWER_CHANGED')[0].new_values.assigned_staff_id),String(reviewer.id));
        assert.equal(events('ZIP_DOWNLOADED')[0].new_values.file_count,2);
        assert.equal(events('EMAIL_FAILED')[0].new_values.queue_state,'pending');
        const byAction = await (await call('/audit-logs?action=WARRANTY_CLAIM_APPROVED',admin)).json();
        assert.equal(byAction.pagination.total,1);
        const serialized = JSON.stringify(audit.data);
        for (const redacted of ['Do not log this private note','staff-only','Photo shows defect','untrusted.png',token,storage])
            assert.ok(!serialized.includes(redacted));
    });
    await t.test('failed audit insert rolls back the associated claim note', async () => {
        const count = await db.WarrantyHistory.count();
        db.AuditLog.addHook('beforeCreate','fixtureAuditFailure',()=>{ throw Error('fixture audit failure'); });
        try { await expect(call(a+'/note',admin,{internal_note:'rollback fixture'}),500); }
        finally { db.AuditLog.removeHook('beforeCreate','fixtureAuditFailure'); }
        assert.equal(await db.WarrantyHistory.count(),count);
    });
    // Verify revocation between enqueue and dispatch, including accounts with overlapping roles.
    const reviewerUser = await db.User.findByPk(reviewer.id);
    await reviewerUser.addRole(view);
    const second = await (await expect(send(form('1'),randomUUID()),201)).json();
    await expect(call('/admin/'+second.id+'/status',admin,{status:'Under Review'}),204);
    await expect(call('/admin/'+second.id+'/status',admin,{status:'Rejected',message:'Outside warranty coverage'}),204);
    await reviewerUser.removeRole(role);
    await c.update({email_verified_at:null});
    await drain();
    assert.equal(adminDeliveries,1);
    assert.equal(attempts,9);
    assert.equal(await db.WarrantyMail.count({where:{last_error:'REVIEWER_UNAUTHORIZED',state:'failed'}}),1);
    assert.equal(await db.WarrantyMail.count({where:{last_error:'NO_VERIFIED_EMAIL',state:'pending'}}),3);
    for (let i=0;i<16;i++) await send(form());
    await expect(send(form(),randomUUID()),429);
    assert.equal(await db.WarrantyClaim.count(),2);
    const rejected = await db.AuditLog.findOne({where:{entity_id:String(second.id),action:'WARRANTY_CLAIM_REJECTED'}});
    assert.equal(rejected.old_values.status,'Under Review');
    assert.equal(rejected.new_values.status,'Rejected');
    assert.equal(await db.AuditLog.count({where:{entity_id:String(second.id),action:'WARRANTY_CLAIM_EMAIL_FAILED'}}),4);
});
