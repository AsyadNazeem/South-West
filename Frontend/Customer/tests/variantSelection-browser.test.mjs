import assert from 'node:assert/strict'
import test from 'node:test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const origin = 'https://store.test'
const dist = fileURLToPath(new URL('../dist/', import.meta.url))
const product = { id: 166, slug: 'headset-fixture', public_id: '1f9e219d-defe-47d3-a102-02c1ff4c4665', item_name: 'Fixture headset' }
const url = origin + '/product/' + product.slug + '-' + product.public_id
const variants = [182, 206].map((id, index) => ({
  id, variant_name: index ? 'H01 USB' : 'H01 3.5', variant_sku: 'SKU-' + id,
  attributes: JSON.stringify({ Model: 'H01-' + id, 'Connector Type': index ? 'USB' : '3.5MM' }),
  available_quantity: index ? 1 : 5, is_default: !index, selling_price: 4000,
  payment_prices: index ? { cash: 3990, card: 4200, koko: 4815, mintpay: 4765 } :
    { cash: 4000, card: 4100, koko: 4715, mintpay: 4715 }
}))

test('built product selects connector, resets quantity and sends its SKU on all purchase paths', {
  skip: !process.env.CHROME_BIN, timeout: 60000
}, async t => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN })
  t.after(() => browser.close())
  const page = await browser.newPage()
  let visibleVariants = variants
  const writes = []
  const token = 'a'.repeat(64)
  await page.route('**/*', route => {
    const request = route.request()
    const u = new URL(request.url())
    if (u.origin === origin && !u.pathname.startsWith('/api/')) {
      if (u.pathname.startsWith('/product/')) return route.fulfill({ path: path.join(dist, 'app-shell.html') })
      if (u.pathname.startsWith('/assets/')) return route.fulfill({ path: path.join(dist, u.pathname) })
      return route.fulfill({ status: 204 })
    }
    const json = data => route.fulfill({ headers: { 'access-control-allow-origin': '*' }, json: data })
    if (request.method() === 'POST') {
      writes.push([u.pathname, request.postDataJSON()])
      return json({ token, checkout_url: '/checkout/' + token })
    }
    if (u.pathname.endsWith('/variants')) return json({ data: visibleVariants, preferred_attributes: ['Connector Type'] })
    return json({ data: u.searchParams.has('publicId') ? [product] : [] })
  })
  for (const signedIn of [false, true]) {
    await page.goto(url)
    await page.getByRole('button', { name: '3.5MM', exact: true }).waitFor()
    await page.evaluate(signedIn => {
      sessionStorage.clear()
      if (signedIn) sessionStorage.setItem('customerToken', 'fixture')
    }, signedIn)
    await page.getByRole('button', { name: 'Increase quantity' }).click()
    await page.getByRole('button', { name: 'USB', exact: true }).click()
    await page.getByText('SKU-206', { exact: true }).waitFor()
    assert.equal(await page.locator('.quantity-control span').innerText(), '1')
    assert.ok(await page.getByRole('button', { name: 'Increase quantity' }).isDisabled())
    assert.match(await page.locator('.stock-line').innerText(), /1 available/)
    assert.deepEqual(await page.locator('.payment-amount').allTextContents().then(a => a.map(s => Number(s.replace(/[^0-9.]/g, '').replace(/^\./, '')))),
      [4000, 3990, 4200, 4815, 4765])
    for (const [button, suffix] of [
      ['Add to Cart', signedIn ? '/customer-cart/items' : '/guest-checkout/session'],
      ['Add to Cart', signedIn ? '/customer-cart/items' : '/guest-checkout/session/items'],
      ['Buy Now', signedIn ? '/customer-checkout/session' : '/guest-checkout/session']
    ]) {
      const response = page.waitForResponse(r => r.request().method() === 'POST' && new URL(r.url()).pathname.endsWith(suffix))
      await page.getByRole('button', { name: button, exact: true }).click()
      await response
      assert.deepEqual(writes.at(-1)[1], { item_id: 166, variant_id: 206, quantity: 1 })
    }
  }

  visibleVariants = [
    { ...variants[0], attributes: {}, colors: ['Black'], in_stock: false, available_quantity: 0 },
    { ...variants[1], attributes: {}, colors: [], selling_price: 4400 }
  ]
  await page.goto(url)
  await page.getByText('SKU-182', { exact: true }).waitFor()
  assert.ok(await page.getByRole('button', { name: 'Black, unavailable for this option' }).isDisabled())
  assert.ok(await page.locator('.cart-button').isDisabled())
  assert.ok(await page.locator('.buy-button').isDisabled())
  await page.getByRole('button', { name: 'No colour', exact: true }).click()
  await page.getByText('SKU-206', { exact: true }).waitFor()
  assert.ok(await page.locator('.cart-button').isEnabled())
  assert.ok(await page.locator('.buy-button').isEnabled())
  assert.match(await page.locator('.payment-card').filter({ hasText: 'SELLING PRICE' }).innerText(), /4,400/)
  visibleVariants = [variants[0]]
  await page.reload()
  await page.getByText('SKU-182', { exact: true }).waitFor()
  assert.equal(await page.locator('.variant-selector').count(), 0)
})

test('guest checkout review switches both SKU line totals to the selected payment method', {
  skip: !process.env.CHROME_BIN, timeout: 30000
}, async t => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN })
  t.after(() => browser.close())
  const page = await browser.newPage()
  const token = 'b'.repeat(64)
  await page.addInitScript(token => {
    sessionStorage.setItem('guestCheckoutToken', token)
    sessionStorage.setItem('southWestGuestCheckoutAddress:' + token, JSON.stringify({
      recipient_name: 'Fixture', customer_email: 'fixture@example.invalid', phone: '123',
      address_line_1: 'Street', city: 'City', district_id: 1, area_id: 1
    }))
  }, token)
  const items = variants.map(v => ({
    item_id: 166, item_name: product.item_name, variant_id: v.id, variant_name: v.variant_name,
    quantity: 1, unit_price: v.selling_price
  }))
  await page.route('**/*', route => {
    const u = new URL(route.request().url())
    if (u.origin === origin && !u.pathname.startsWith('/api/')) {
      if (u.pathname.startsWith('/checkout')) return route.fulfill({ path: path.join(dist, 'app-shell.html') })
      if (u.pathname.startsWith('/assets/')) return route.fulfill({ path: path.join(dist, u.pathname) })
      return route.fulfill({ status: 204 })
    }
    let data = []
    if (u.pathname.endsWith('/guest-checkout/session')) data = { items }
    if (u.pathname.endsWith('/guest-checkout/quote')) {
      const method = route.request().postDataJSON().payment_method
      const lines = items.map((row, i) => ({ ...row, unit_price: variants[i].payment_prices[method],
        line_total: variants[i].payment_prices[method] }))
      const subtotal = lines.reduce((sum, row) => sum + row.line_total, 0)
      data = { items: lines, subtotal, total_amount: subtotal, shipping_amount: 0 }
    }
    return route.fulfill({ headers: { 'access-control-allow-origin': '*' }, json: { data } })
  })
  await page.goto(origin + '/checkout/' + token)
  for (const [id, amount] of [['card', '4,200'], ['koko', '4,815'], ['mintpay', '4,765']]) {
    await page.locator('label.choice').filter({ has: page.locator('input[value="' + id + '"]') }).click()
    const usb = page.locator('.summary-item').filter({ hasText: 'H01 USB' })
    await usb.locator('.summary-item-total').filter({ hasText: amount }).waitFor()
    assert.equal(await page.locator('.summary-item').count(), 2)
  }
})
