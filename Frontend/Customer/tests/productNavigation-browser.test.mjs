import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

test('new and renamed products resolve by UUID on navigation and refresh', {
  skip: !process.env.CHROME_BIN || !process.env.PLAYWRIGHT_MODULE,
  timeout: 45000,
}, async t => {
  const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE)
  const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN })
  t.after(() => browser.close())
  const page = await browser.newPage()
  const origin = 'https://store.test'
  const id = 'eeeeeeee-1111-2222-3333-444444444444'
  const path = '/product/new-name-' + id
  const item = { slug: 'new-name', public_id: id, id: 42, item_name: 'Fixture product', in_stock: false }
  let mode = 'available'
  await page.route('**/*', route => {
    const url = new URL(route.request().url())
    if (url.origin === origin) {
      const file = url.pathname.startsWith('/product/') ? 'app-shell.html' : url.pathname.slice(1)
      return route.fulfill({ path: fileURLToPath(new URL('../dist/' + file, import.meta.url)) })
    }
    const headers = { 'access-control-allow-origin': '*' }
    if (url.pathname.endsWith('/store/products') && url.searchParams.get('publicId') === id) {
      if (mode === 'offline') return route.fulfill({ status: 503, headers, json: { message: 'Temporary catalog failure' } })
      return route.fulfill({ headers, json: { success: true, data: mode === 'available' ? [item] : [] } })
    }
    return route.fulfill({ headers, json: { data: [] } })
  })
  const query = '?ref=campaign&color=blue'
  await page.goto(origin + '/product/old-name-' + id + query + '#details')
  await page.waitForURL(origin + path + query + '#details')
  for (let pass = 0; pass < 2; pass++) {
    if (pass) await page.reload()
    await page.getByRole('heading', { name: item.item_name }).waitFor()
    assert.deepEqual(await page.locator('link[rel=canonical]').evaluateAll(nodes => nodes.map(node => node.href)), ['https://southwest.lk' + path])
    assert.equal(await page.locator('meta[property="og:url"]').getAttribute('content'), 'https://southwest.lk' + path)
  }
  mode = 'missing'
  await page.goto(origin + path)
  await page.getByText('This product could not be found or is no longer available.').waitFor()
  assert.match(await page.locator('meta[name=robots]').getAttribute('content'), /noindex/)
  mode = 'offline'
  await page.reload()
  await page.getByText('Temporary catalog failure').waitFor()
  assert.doesNotMatch(await page.locator('meta[name=robots]').getAttribute('content'), /noindex/)
})
