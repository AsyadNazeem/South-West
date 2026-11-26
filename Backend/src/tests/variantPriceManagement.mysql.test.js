'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const mysql = require('mysql2/promise');
const express = require('express');

const socketPath = process.env.VARIANT_PRICE_FIXTURE_SOCKET;
test('authenticated variant price management on disposable MySQL', { skip: !socketPath }, async t => {
    const dbName = 'variant_prices_test_' + randomBytes(8).toString('hex');
    const admin = await mysql.createConnection({ socketPath, user: 'root' });
    await admin.query('CREATE DATABASE ' + dbName);
    const uploads = await fs.mkdtemp(path.join(os.tmpdir(), 'variant-prices-'));
    process.env.UPLOAD_ROOT = uploads;
    process.env.JWT_SECRET = randomBytes(32).toString('hex');
    process.env.NODE_ENV = 'test';
    // Bind every application model to this run's database before importing routes.
    const config = require('../config/sequelize-config').test;
    Object.assign(config, { database: dbName, username: 'root', password: '', logging: false });
    config.dialectOptions = { ...config.dialectOptions, socketPath };
    const db = require('../models');
    t.after(async () => {
        await db.sequelize.close();
        await admin.query('DROP DATABASE ' + dbName);
        await admin.end();
        await fs.rm(uploads, { recursive: true, force: true });
    });
    await db.sequelize.sync();
    const password = randomBytes(18).toString('hex');
    const user = await db.User.create({ email: 'pricing@example.test', password_hash: await require('bcryptjs').hash(password, 4) });
    const role = await db.Role.create({ name: 'Fixture pricing' });
    const permissions = await db.Permission.bulkCreate(['view','update','create'].map(name => ({ name: 'products.' + name, module: 'products' })));
    await user.addRole(role);
    await role.addPermissions(permissions);
    const item = await db.Item.create({ item_code: 'SW-000166', public_id: randomUUID(), slug: 'fixture-headset', item_name: 'R8 H01 3.5mm/USB Wired Gaming Headset' });
    const variant = (item_id, variant_name, variant_sku, extra) => db.ItemVariant.create({ item_id, variant_name, variant_sku, ...extra });
    const analog = await variant(item.id, 'H01 3.5', 'SWV-000166-H0135', { is_default: true, attributes: { 'Connector Type': '3.5MM' } });
    const usb = await variant(item.id, 'H01 USB', 'SWV-000166-H01USB', { attributes: { 'Connector Type': 'USB' } });
    const price = (variant_id, price_type, price, extra) => db.ItemPrice.create({ item_id: item.id, variant_id, price_type, price, ...extra });
    const cost = await price(analog.id, 'cost', 100);
    await price(analog.id, 'selling', 4000);
    const methodPrices = { cash:4000, card:4100, koko:4715, mintpay:4715 };
    for (const [payment_method, price] of Object.entries(methodPrices))
        await db.ItemPaymentPrice.create({ item_id:item.id, variant_id:analog.id, payment_method, price });
    const location = await db.InventoryLocation.create({ code:'FIX', name:'Fixture', location_type:'online' });
    for (const v of [analog, usb]) await db.InventoryStock.create({ item_id:item.id, variant_id:v.id, location_id:location.id, quantity_on_hand:5 });
    await fs.copyFile(path.resolve(__dirname,'../../../Frontend/Admin/public/SWfavicon.png'), path.join(uploads,'headset.png'));
    await db.ItemImage.create({ item_id:item.id, file_name:'headset.png', file_path:'headset.png', is_primary:true });
    const otherItem = await db.Item.create({item_code:'OTHER',item_name:'Single',slug:'single',public_id:randomUUID()});
    const single = await variant(otherItem.id,'Single variant','FIX-SINGLE');
    const app = express();
    app.use(express.json());
    for (const [url, name] of Object.entries({ auth:'auth', items:'item', 'item-prices':'itemPrice', 'item-payment-prices':'itemPaymentPrice', 'store/products':'storeProduct' }))
        app.use('/api/'+url, require('../routes/'+name+'Routes'));
    let build = process.env.PRICE_ADMIN_BEFORE;
    app.use((req,res,next) => {
        if (!build || req.path.startsWith('/api/')) return next();
        return express.static(build)(req,res,() => res.sendFile(path.join(build,'index.html')));
    });
    const server = await new Promise(resolve => {
        const http = app.listen(0, '127.0.0.1', () => resolve(http));
    });
    t.after(() => new Promise(resolve => server.close(resolve)));
    const base = 'http://127.0.0.1:'+server.address().port;
    const endpoint = '/api/item-prices/item/'+item.id+'/management';
    let token;
    async function request(url, method = 'GET', body, status = 200) {
        const response = await fetch(base+url, { method, headers:{ 'content-type':'application/json', ...(token && { authorization:'Bearer '+token }) }, body:JSON.stringify(body) });
        const result = await response.json();
        assert.equal(response.status,status,JSON.stringify(result));
        return result.data;
    }
    await request(endpoint,'GET',undefined,401);
    token = (await request('/api/auth/login','POST',{ email:user.email,password })).token;
    const publicPath = '/api/store/products/'+item.id+'/variants';
    assert.deepEqual((await request(publicPath)).map(v=>v.variant_sku),[analog.variant_sku]);
    let state = await request(endpoint);
    assert.deepEqual(state.variants.map(v=>v.variant_name),['H01 3.5','H01 USB']);
    assert.equal(state.payments.length,4);
    const schedule = (variant_id,type,price,id=null) => ({ kind:'schedule',variant_id,type,price,id,currency:'LKR',is_active:true,effective_from:null,effective_to:null });
    const selling = schedule(usb.id,'selling',4000);
    const update = schedule(analog.id,'cost',101,cost.id);
    const payment = (type,price) => ({kind:'payment',type,price,variant_id:usb.id,id:null,currency:'LKR',is_active:true});
    const save = (changes,status=200,revision=state.revision) => request(endpoint,'PUT',{changes,revision},status);
    await save([update,{...selling,variant_id:999999}],400);
    await save([update,selling,payment('card',0)],400);
    await save([selling,payment('unsupported',100)],400);
    await save([{...selling,currency:'LKR1'}],400);
    await save([{...selling,price:'2.555'}],400);
    await save([{...selling,type:'invented'}],400);
    assert.equal((await cost.reload()).price,'100.00');
    assert.equal((await request(endpoint)).revision,state.revision);
    await role.removePermission(permissions[2]);
    await save([selling],403);
    await role.removePermission(permissions[1]);
    await save([update],403);
    await role.addPermissions(permissions);
    const originalRevision = state.revision;
    if (process.env.PRICE_ADMIN_AFTER) {
        const { chromium } = require('../../../Frontend/Customer/node_modules/playwright-core');
        const browser = await chromium.launch({executablePath:process.env.CHROME_BIN});
        try {
            const page = await browser.newPage({ viewport:{width:1440,height:1000} });
            page.setDefaultTimeout(8000);
            await page.route('**/*',route => route.request().url().startsWith(base+'/') ? route.continue() : route.abort());
            await page.addInitScript(token => {
                localStorage.setItem('token',token);
                localStorage.setItem('admin_last_activity',String(Date.now()));
            },token);
            const edit = base+'/admin/products/item-prices/edit-all/'+item.id;
            const shot = async name => {
                if (process.env.PRICE_SCREENSHOTS) await page.screenshot({ path:path.join(process.env.PRICE_SCREENSHOTS,name+'.png'),fullPage:true });
            };
            if (build) {
                await page.goto(edit);
                await page.getByText(/Price record #\d+ · Variant 2/).waitFor();
                await shot('before');
            }
            build = process.env.PRICE_ADMIN_AFTER;
            await page.goto(edit);
            await page.goto(base+'/admin/products/item-prices/create');
            await page.locator('.multiselect__tags').first().click();
            await page.locator('#item').fill('OTHER');
            await page.getByText('OTHER - Single',{exact:true}).click();
            await page.getByRole('link',{name:'Manage variant prices'}).click();
            await page.getByRole('heading',{name:'Single variant'}).waitFor();
            await page.getByRole('button',{name:'Add Prices',exact:true}).waitFor();
            await page.goto(edit);
            const card = name => page.locator('.price-card').filter({has:page.getByRole('heading',{name,exact:true})});
            const source = card('H01 3.5'), target = card('H01 USB');
            await target.getByRole('button',{name:'Add Prices',exact:true}).waitFor();
            await shot('after');
            await target.getByRole('button',{name:'Add Prices',exact:true}).click();
            await target.getByLabel('Copy prices from').selectOption({index:1});
            assert.equal(await target.getByLabel('Amount',{exact:true}).nth(1).inputValue(),'');
            await target.getByLabel('Card',{exact:true}).fill('4125');
            assert.equal((await request(endpoint)).revision,originalRevision);
            await source.getByLabel('Amount',{exact:true}).first().fill('101');
            await page.getByRole('button',{name:'Save All Prices'}).click();
            await page.getByText('Prices saved.',{exact:true}).waitFor();
            await page.reload();
            await target.getByRole('button',{name:'Add Missing Price'}).waitFor();
            assert.equal(await target.getByLabel('Card',{exact:true}).inputValue(),'4125.00');
            await shot('saved');
            if (process.env.PRICE_CUSTOMER_BUILD) {
                const store = await browser.newPage();
                store.setDefaultTimeout(8000);
                // Serve the compiled SPA locally and forward product reads to
                // the fixture's real store routes, regardless of its build URL.
                await store.route('**/*', async route => {
                    const url = new URL(route.request().url());
                    if (url.pathname.startsWith('/product/'))
                        return route.fulfill({path:path.join(process.env.PRICE_CUSTOMER_BUILD,'app-shell.html')});
                    if (url.pathname.startsWith('/assets/'))
                        return route.fulfill({path:path.join(process.env.PRICE_CUSTOMER_BUILD,url.pathname)});
                    if (url.pathname.includes('/store/products')) {
                        const local = '/api'+url.pathname.slice(url.pathname.indexOf('/store/products'))+url.search;
                        const response = await fetch(base+local);
                        return route.fulfill({status:response.status,contentType:'application/json',
                            headers:{'access-control-allow-origin':'*'},body:await response.text()});
                    }
                    return route.fulfill({status:200,headers:{'access-control-allow-origin':'*'},json:{data:[]}});
                });
                await store.goto(base+'/product/'+item.slug+'-'+item.public_id);
                await store.getByText(analog.variant_sku,{exact:true}).waitFor();
                await store.getByRole('button',{name:'USB',exact:true}).click();
                await store.getByText(usb.variant_sku,{exact:true}).waitFor();
                assert.match(await store.locator('.stock-line').innerText(),/5 available/);
                assert.match(await store.locator('.payment-amount').allInnerTexts().then(rows=>rows.join('')),/4,125/);
                await store.getByRole('button',{name:'3.5MM',exact:true}).click();
                await store.getByText(analog.variant_sku,{exact:true}).waitFor();
            }
        } finally { await browser.close(); }
    } else {
        await save([update,selling,...Object.entries({...methodPrices, card:4125}).map(([type,value])=>payment(type,value))]);
    }
    await save([selling],409,originalRevision);
    state = await request(endpoint);
    assert.equal((await cost.reload()).price,'101.00');
    assert.equal(state.prices.filter(p=>p.variant_id === usb.id).length,1);
    assert.equal(state.payments.length,8);
    const publicRows = await request(publicPath);
    assert.deepEqual(publicRows.map(v=>[v.variant_sku,v.selling_price,v.available_quantity,v.payment_prices.card]),[
        [analog.variant_sku,4000,5,4100],[usb.variant_sku,4000,5,4125]
    ]);
    assert.ok(await db.AuditLog.count({where:{action:'ITEM_PRICE_CREATED'}}));
    await save([schedule(usb.id,'cost',90)]);
    state = await request(endpoint);
    assert.equal(state.prices.length,4);
    const singlePath = '/api/item-prices/item/'+otherItem.id+'/management';
    let singleState = await request(singlePath);
    assert.equal(singleState.variants.length,1);
    assert.equal(singleState.prices.length,0);
    await request(singlePath,'PUT',{revision:singleState.revision,changes:[schedule(single.id,'cost',75)]});
    singleState = await request(singlePath);
    assert.deepEqual(singleState.prices.map(p=>p.price_type),['cost']);
    await request(singlePath,'PUT',{revision:singleState.revision,changes:[schedule(single.id,'selling',100)]});
    singleState = await request(singlePath);
    assert.equal(singleState.prices.length,2);
    assert.equal(singleState.payments.length,0);
    await save([schedule(single.id,'cost',12)],400);
    const third = await variant(item.id,'Inactive','FIX-INACTIVE',{is_active:false});
    await price(null,'retail',99);
    const expired = await price(analog.id,'special',90,{effective_to:new Date('2020-02-01T00:00:00Z')});
    const future = await price(analog.id,'special',95,{effective_from:new Date('2099-02-01T08:15:30Z')});
    const inactive = await price(analog.id,'special',88,{is_active:false});
    state = await request(endpoint);
    assert.equal(state.variants.length,3);
    assert.ok(state.prices.some(p=>p.variant_id===null));
    await save([schedule(third.id,'selling',10)],409);
    await save([schedule(analog.id,'special',11,expired.id)],409);
    await save([schedule(analog.id,'special',11,inactive.id)],409);
    await save([schedule(usb.id,'cost',10)],409);
    const editItem = state.prices.find(p=>p.variant_id===null);
    await save([schedule(null,'retail',98,editItem.id)]);
    assert.equal((await future.reload()).effective_from.toISOString(),'2099-02-01T08:15:30.000Z');
    assert.equal((await expired.reload()).price,'90.00');
    assert.equal((await inactive.reload()).is_active,false);
    state = await request(endpoint);
    const competing = ['96.00','97.00'].map(value => fetch(base+endpoint,{
        method:'PUT',headers:{authorization:'Bearer '+token,'content-type':'application/json'},
        body:JSON.stringify({revision:state.revision,changes:[schedule(null,'retail',value,editItem.id)]})
    }));
    const replies = await Promise.all(competing);
    assert.deepEqual(replies.map(r=>r.status).sort(),[200,409]);
});
