// Exercise the actual Vue components in Chrome with fixture-only Axios responses.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs/promises'
import http from 'node:http'
import { promisify } from 'node:util'
import { execFile } from 'node:child_process'

const chrome = process.env.CHROME_BIN
const frontend = fileURLToPath(new URL('../..', import.meta.url))
for (const app of ['Admin','Customer']) test(app + ' warranty browser workflow',{ skip: !chrome, timeout:60000 },async t => {
  const root = path.join(frontend,app)
  const resolve = createRequire(path.join(root,'package.json')).resolve
  const { build } = await import(pathToFileURL(resolve('vite')))
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(),'sw-warranty-browser-'))
  t.after(()=>fs.rm(tmp,{recursive:true,force:true}))
  const customer = app === 'Customer'
  const entry = `
    import {createApp,nextTick,h} from 'vue'
    import {createRouter,createMemoryHistory,RouterView} from 'vue-router'
    import Page from '@/pages/${customer ? 'account':'sales'}/WarrantyClaims.vue'
    ${customer ? '' : "import Feed from '@/pages/administration/AdminNotificationsFeed.vue'"}
    import api from '@/${customer ? 'services/api':'api/axios'}'
    ${customer ? '' : "import {authorizationState} from '@/auth/authorization'; authorizationState.user={permissions:['warranty_claims.view']}"}
    const home='${customer ? '/account/warranty-claims':'/admin/sales/warranty-claims'}'
    const claim={id:1,reference:'WC-FIXTURE',product:'Fixture camera',reason:'<b id="fixture-markup">Broken</b>',customer_name:'Fixture buyer',status:'Submitted',created_at:new Date()}
    const badges = {
      Submitted:'neutral', 'Under Review':'warning', 'More Evidence Required':'neutral',
      'Evidence Submitted':'info', Approved:'success', Rejected:'danger', Processing:'neutral',
      Resolved:'success', Closed:'neutral'
    }
    let submitted=false, markedRead=false, requested=false
    api.defaults.adapter=async config=>{
      let data
      if(config.url.endsWith('/purchase')) data={customer_name:'Fixture buyer',phone:'0771234567',
        products:[{order_item_id:'7',product:'Fixture camera',label:'Review',allowed:true}]}
      else if(config.url.endsWith('/admin/mine')) data={data:[{id:12,title:'New warranty claim',reference_type:'warranty_claim',reference_id:1,is_read:false}]}
      else if(config.url.endsWith('/12/read')) {markedRead=true;data={}}
      else if(config.url.endsWith('/1/status')) {claim.status=JSON.parse(config.data).status; data={}}
      else if(config.url.endsWith('/1/request')) {requested=true;claim.status='More Evidence Required';data={}}
      else if(config.method==='post'){
        if (!(config.data instanceof FormData) || config.data.get('order_item_id')!=='7' || !config.data.has('photos')) throw Error('Wrong multipart submission')
        submitted=true; data=claim
      } else if(config.url.endsWith('/1')) data={claim,history:[{event:'Submitted',new_status:'Submitted',created_at:new Date()}],requests:requested?[{id:1,status:'open',reason:'Show the label'}]:[],evidence:[],transitions:['Under Review'],customerMail:[{state:'pending',attempts:0}]}
      else {
        const statuses = ${customer ? "['Submitted']" : 'Object.keys(badges)'}
        const rows = statuses.map((status,index)=>({...claim,id:index+1,status}))
        data={rows,count:rows.length,statuses}
      }
      return {data,status:200,headers:{},config}
    }
    const router=createRouter({history:createMemoryHistory(),routes:[{path:home+'/:claim?',component:Page}, ${customer ? '' : "{path:'/feed',component:Feed}"}]})
    const tick=async()=>{await new Promise(r=>setTimeout(r,20));await nextTick()}
    const $=s=>{const el=document.querySelector(s);if(!el)throw Error('Missing '+s);return el}
    const input=(el,value,event='input')=>{el.value=value;el.dispatchEvent(new Event(event,{bubbles:true}))}
    const check=(ok,message)=>{if(!ok)throw Error(message)}
    async function run(){
      await router.push(home)
      createApp({render:()=>h(RouterView)}).use(router).mount('#app')
      await tick()
      check(document.body.innerText.includes('Fixture camera'),'Missing purchase in list')
      ${customer ? `
        await router.push(home+'/new');await tick()
        input($('form input'),'ORDER1'); $('form').requestSubmit();await tick()
        check($('input[readonly]').value==='Fixture buyer','Unverified name')
        input($('select'),'7','change');input($('textarea'),'Broken fixture')
        const dt=new DataTransfer();dt.items.add(new File(['fixture'],'evidence.png',{type:'image/png'}))
        const picker=$('input[type=file]');picker.files=dt.files;picker.dispatchEvent(new Event('change'))
        await tick();check(!!$('figure img'),'Missing preview')
        document.querySelectorAll('form')[1].requestSubmit();await tick()
        check(submitted && document.body.innerText.includes('Claim submitted · WC-FIXTURE'),'Missing submission confirmation')
      ` : `
        const rendered = Array.from(document.querySelectorAll('tbody .badge'))
        check(rendered.length === Object.keys(badges).length,'Missing claim status rows')
        for (const [i,[status,style]] of Object.entries(badges).entries()) {
          check(rendered[i].textContent === status && rendered[i].classList.contains(style),'Incorrect badge for '+status)
        }
        check(document.documentElement.scrollWidth<=window.innerWidth,'Mobile list overflows viewport')
        await router.push('/feed');await tick()
        $('article.unread').click();await tick()
        check(markedRead && router.currentRoute.value.path===home+'/1','Notification did not open claim and mark read')
        check(!document.body.innerText.includes('Download evidence ZIP'),'Viewer can download')
        check(!document.body.innerText.includes('Update status'),'Viewer can update')
        authorizationState.user.permissions.push('warranty_claims.update_status');await tick()
        Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Update status').click()
        await tick();check($('dialog').open,'Status dialog did not open')
        check($('dialog select').options[0].value==='Under Review','Invalid workflow options')
        input($('dialog select'),'Under Review','change')
        $('dialog form').requestSubmit();await tick()
        check(document.body.innerText.includes('Confirm status change') && claim.status==='Submitted','Missing confirmation')
        $('dialog form').requestSubmit();await tick()
        check(claim.status==='Under Review' && document.body.innerText.includes('Status change saved.'),'Status save failed')
        check(document.body.innerText.includes('Queued for delivery'),'Missing customer delivery state')
        authorizationState.user.permissions.push('warranty_claims.request_evidence');await tick()
        Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Request more evidence').click()
        await tick()
        input($('dialog textarea'),'Show the label')
        $('dialog form').requestSubmit();await tick()
        check(requested && document.body.innerText.includes('Show the label'),'Evidence request missing from detail')
        check(document.documentElement.scrollWidth<=window.innerWidth,'Mobile detail overflows viewport')
      `}
      check(!document.getElementById('fixture-markup') && document.body.innerText.includes('<b id="fixture-markup">'),'Claim text rendered as markup')
      document.body.dataset.result='passed'
    }
    run().catch(e=>{document.body.dataset.result=e.message})
  `
  const out = await build({ root,define:{'process.env.NODE_ENV':JSON.stringify('production')},logLevel:'error',plugins:[{name:'fixture',
    resolveId(id){if(id===path.join(root,'warranty-fixture.js'))return path.join(root,'warranty-fixture.js')},
    load(id){if(id===path.join(root,'warranty-fixture.js'))return entry}
  }],build:{write:false,lib:{entry:path.join(root,'warranty-fixture.js'),formats:['es']},minify:false}})
  const code = (Array.isArray(out)?out[0]:out).output.find(x=>x.type==='chunk'&&x.isEntry).code
  const css = (Array.isArray(out)?out[0]:out).output.filter(x=>x.type==='asset'&&x.fileName.endsWith('.css')).map(x=>x.source).join('\n')
  const server = http.createServer((req,res)=>{
    if(req.url==='/test.js') res.writeHead(200,{'Content-Type':'text/javascript'}).end(code)
    else if(req.url==='/test.css') res.writeHead(200,{'Content-Type':'text/css'}).end(css)
    else res.writeHead(200,{'Content-Type':'text/html'}).end('<meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/test.css"><div id="app"></div><script type="module" src="/test.js"></script>')
  })
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
  t.after(()=>new Promise(resolve=>server.close(resolve)))
  const {stdout}=await promisify(execFile)(chrome,['--headless','--window-size=420,800','--disable-gpu','--disable-background-networking',
    '--no-first-run','--user-data-dir='+tmp,'--dump-dom','--virtual-time-budget=8000','http://127.0.0.1:'+server.address().port],
    {timeout:35000,maxBuffer:2**20})
  assert.match(stdout,/data-result="passed"/)
})
