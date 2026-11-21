// Run after the Customer build. Requests are intercepted, including every backend write.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {createRequire} from 'node:module'

const dist=fileURLToPath(new URL('../dist/',import.meta.url))
const require=createRequire(import.meta.url)
test('account routes at six widths and customer workflows', {
  skip:!process.env.CHROME_BIN || !process.env.PLAYWRIGHT_MODULE,timeout:180000
},async t=>{
  const {chromium}=require(process.env.PLAYWRIGHT_MODULE)
  const browser=await chromium.launch({executablePath:process.env.CHROME_BIN})
  t.after(()=>browser.close())
  const page=await browser.newPage()
  page.setDefaultTimeout(5000)
  page.setDefaultNavigationTimeout(15000)
  const origin='https://account.test', errors=[], writes=[]
  page.on('pageerror',e=>errors.push(e.message))
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text())})
  const customer={id:1,first_name:'Sam',last_name:'Perera',email:'sam@example.invalid',phone:'0771234567',customer_code:'SW-100'}
  const item={id:1,public_id:'d15c0609-fbf9-4742-8131-db64afc97d56',slug:'headphones',item_name:'Studio headphones',price:4800}
  const order={id:1,order_number:'SWO-10017',order_date:'2026-11-18',status:'processing',payment_status:'paid',items:[{id:1,item,quantity:1,line_total:4800,unit_price:4800}],total_amount:4800,subtotal:4800,deliveries:[],payments:[],addresses:[{address_type:'shipping',recipient_name:'Sam Perera',address_line_1:'12 Sample Lane',city:'Colombo'}]}
  const claim={id:1,reference:'WC-51888c0a-6ab3-469f-a646-c33c0f94efaa',order_number:order.order_number,product:item.item_name,created_at:order.order_date,customer_name:'Sam Perera',reason:'Left channel stopped working',phone:customer.phone,status:'More Evidence Required'}
  const notification={id:1,title:'Order confirmed',message:'Your order has been confirmed.',created_at:order.order_date,reference_type:'order',reference_id:1}
  const addresses=[{id:1,recipient_name:'Sam Perera',phone:customer.phone,address_line_1:'10 Garden Road',city:'Colombo',district_id:1,area_id:1,country:'Sri Lanka',is_default:true}]
  let answered=false,wishlist=[{id:1,item}]
  await page.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url()),method=req.method()
    if(req.resourceType()==='document')return route.fulfill({path:path.join(dist,'index.html'),contentType:'text/html'})
    if(['xhr','fetch','preflight'].includes(req.resourceType()) || method==='OPTIONS'){
      const api=url.pathname.replace(/^\/api(?=\/)/,'')
      const headers={'access-control-allow-origin':origin,'access-control-allow-methods':'GET, OPTIONS, POST, PATCH, DELETE','access-control-allow-headers':'authorization, content-type, idempotency-key'}
      if(method==='OPTIONS')return route.fulfill({status:204,headers})
      if(method!=='GET')writes.push(method+' '+api)
      let data={data:[]}
      if(api==='/customer-auth/me')data={customer}
      if(api==='/customer-orders')data={data:[order]}
      if(api==='/customer-orders/1')data={data:order}
      if(api==='/store/products')data={data:[item]}
      if(api==='/customer/addresses'){
        if(method==='POST')addresses.push({...req.postDataJSON(),id:2})
        data={data:addresses}
      }
      if(api.startsWith('/customer/addresses/')){
        const i=addresses.findIndex(a=>a.id===Number(api.split('/').pop()))
        if(method==='DELETE')addresses.splice(i,1)
        else Object.assign(addresses[i],req.postDataJSON())
      }
      if(api==='/delivery-districts')data={data:[{id:1,district_name:'Colombo'}]}
      if(api==='/delivery-areas')data={data:[{id:1,area_name:'Central',city:'Colombo'}]}
      if(api==='/my/notifications')data={data:[notification]}
      if(api.endsWith('/1/read'))notification.is_read=true
      if(api==='/customer-wishlist')data={data:wishlist}
      if(api.startsWith('/customer-wishlist/items/'))wishlist=[]
      if(api==='/customer-reviews/my')data={data:[{id:1,item,created_at:order.order_date,rating:4,status:'approved',review_text:'Comfortable headphones.'}]}
      if(api==='/my/warranty-claims')data=method==='GET'?{rows:[claim],count:1}:{id:1,reference:claim.reference}
      if(api==='/my/warranty-claims/1')data={claim,requests:[{id:7,status:answered?'answered':'open',reason:'Show the label',created_at:order.order_date}],history:[],evidence:[]}
      if(api==='/my/warranty-claims/purchase')data={customer_name:'Sam Perera',phone:customer.phone,products:[{order_item_id:1,product:item.item_name,allowed:true,label:'Eligible'}]}
      if(api.endsWith('/requests/7')){answered=true;claim.status='Evidence Submitted';data={id:1,reference:claim.reference}}
      return route.fulfill({headers,json:data})
    }
    if(url.origin===origin){
      const asset=path.resolve(dist,'.'+url.pathname)
      if(asset.startsWith(path.resolve(dist)+path.sep)){
        try {await fs.access(asset);return route.fulfill({path:asset})}catch{}
      }
    }
    return route.fulfill({status:204})
  })
  async function visit(suffix,title){
    await page.goto(origin+'/account'+suffix,{waitUntil:'domcontentloaded'})
    await page.locator('.content h1').filter({hasText:title}).waitFor()
  }
  const btn=name=>page.locator('.content').getByRole('button',{name,exact:true})
  await page.goto(origin+'/account/orders')
  await page.waitForURL('**/login?redirect=**')
  await page.evaluate(()=>sessionStorage.setItem('customerToken','fixture'))
  const pages=[['','Welcome back'],['/orders?orderId=1','My orders'],['/warranty-claims','Warranty claims'],
    ['/warranty-claims/new','Submit warranty claim'],['/warranty-claims/1','Warranty claim details'],['/personal-information','My profile'],
    ['/addresses','Saved addresses'],['/change-password','Account security'],['/notifications','Notifications'],['/wishlist','Wishlist'],
    ['/reviews','My reviews'],['/returns','Returns & cancellations']]
  for(const width of [320,375,430,768,1024,1440]){
    await page.setViewportSize({width,height:900})
    for(const [suffix,title] of pages){
      await visit(suffix,title)
      if(!suffix)await page.getByRole('link',{name:'Notifications Order confirmed'}).waitFor()
      if(suffix.startsWith('/orders'))await page.locator('.details-col .items').getByText('Studio headphones').waitFor()
      if(suffix.endsWith('claims/1'))await page.locator('#claim-response textarea').waitFor().catch(async error=>{
        throw Error(error.message+' '+await page.locator('main.account').innerText()+' '+errors.join(' | '))
      })
      const overflow=await page.locator('.content').evaluate(el=>Math.max(el.scrollWidth-el.clientWidth,el.getBoundingClientRect().right-innerWidth))
      assert.ok(overflow<=2,`${width}px ${suffix} overflow ${overflow}px`)
      if(process.env.ACCOUNT_SCREENSHOTS && [375,1440].includes(width) && ['','/orders?orderId=1','/warranty-claims/1'].includes(suffix))
        await page.screenshot({path:path.join(process.env.ACCOUNT_SCREENSHOTS,width+'-'+(suffix.replace(/[^a-z]/g,'')||'overview')+'.png')})
    }
    assert.equal(await page.locator('.menu-trigger').isVisible(),width<=850)
  }
  await page.setViewportSize({width:375,height:850})
  await page.locator('.menu-trigger').click()
  await page.locator('#account-links').getByRole('link',{name:'My orders'}).click()
  await page.locator('.details-col .items').getByText('Studio headphones').waitFor()
  await page.getByText('12 Sample Lane, Colombo').waitFor()
  await page.getByRole('searchbox',{name:'Search orders by order number'}).fill('absent')
  await page.getByText('No matching orders').waitFor()
  await visit('/notifications','Notifications')
  await btn('Mark as read').click()
  await page.locator('.content').getByRole('button', {name: /View order/}).click()
  await page.waitForURL('**/account/orders?orderId=1')
  await page.locator('.details-col .items').getByText('Studio headphones').waitFor()
  await visit('/addresses','Saved addresses')
  await btn('Edit').click()
  await page.locator('#ab-line1').fill('20 Garden Road')
  await btn('Save changes').click()
  await page.getByText('Your address has been updated.').waitFor()
  await page.getByText(/20 Garden Road/).waitFor()
  await btn('+ Add address').click()
  await page.locator('#ab-name').fill('Second address')
  await page.locator('#ab-phone').fill(customer.phone)
  await page.locator('#ab-district').click()
  await page.getByRole('option').first().click()
  await page.locator('#ab-area').click()
  await page.getByRole('option').first().click()
  await page.locator('#ab-line1').fill('15 Example Road')
  await page.locator('#ab-city').fill('Colombo')
  await btn('Save address').click()
  await page.getByText('Your new address has been saved.').waitFor()
  const secondAddress = page.getByRole('listitem').filter({hasText:'15 Example Road'})
  await secondAddress.getByRole('button',{name:'Delete',exact:true}).click()
  await btn('Yes, delete').click()
  await page.getByText('Address deleted.',{exact:true}).waitFor()
  await page.getByText(/20 Garden Road/).waitFor()
  assert.equal(await secondAddress.count(),0)
  await visit('/warranty-claims/new','Submit warranty claim')
  await page.locator('.lookup input').fill(order.order_number)
  await btn('Verify purchase').click()
  await page.locator('.claim-form select').selectOption('1')
  await page.locator('.claim-form textarea').fill('Sound cuts out')
  const file={name:'fixture.png',mimeType:'image/png',buffer:await fs.readFile(path.join(dist,'Favicon.png'))}
  await page.locator('input[type=file]').setInputFiles(file)
  await btn('Submit claim').click()
  await page.getByText('Claim submitted · '+claim.reference).waitFor()
  await page.locator('#claim-response textarea').fill('Photo of the label')
  await page.locator('input[type=file]').setInputFiles(file)
  await btn('Send additional evidence').click()
  await page.getByText('Additional evidence received · '+claim.reference).waitFor()
  await visit('/wishlist','Wishlist')
  await btn('Add to cart').first().click()
  await page.getByText('Studio headphones was added to your cart.').waitFor()
  await visit('/change-password','Account security')
  await btn('Send verification code').click()
  await btn('Show passwords').click()
  assert.equal(await page.locator('#new-password').getAttribute('type'),'text')
  await page.locator('#verification-code').fill('123456')
  await page.locator('#new-password').fill('FixturePassword9')
  await page.locator('#confirm-password').fill('FixturePassword9')
  await btn('Change password').click()
  await page.getByRole('heading',{name:'Password changed successfully'}).waitFor()
  for(const call of ['POST /customer/addresses','PATCH /customer/addresses/1','DELETE /customer/addresses/2','POST /my/warranty-claims','POST /my/warranty-claims/1/requests/7','POST /customer-cart/items','POST /customer-auth/password-change/request-code','POST /customer-auth/password-change/confirm'])assert.ok(writes.includes(call),call)
  assert.deepEqual(errors,[])
})
