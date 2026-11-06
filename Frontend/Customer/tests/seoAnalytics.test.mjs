import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const analyticsUrl = new URL('../src/services/analytics.js', import.meta.url)
const structuredUrl = new URL('../src/utils/structuredData.js', import.meta.url)

async function loadAnalyticsModule() {
  const directory = await mkdtemp(join(tmpdir(), 'southwest-analytics-'))
  const source = await readFile(analyticsUrl, 'utf8')
  const testSource = source.replace('import.meta.env?.VITE_GA_MEASUREMENT_ID', "'G-TEST123'")
  const modulePath = join(directory, 'analytics.mjs')
  await writeFile(modulePath, testSource)
  try {
    return await import(`${pathToFileURL(modulePath).href}?test=${Date.now()}`)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

function installBrowserStorage() {
  const values = new Map()
  const storage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
  }
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: storage })
  return { storage, values }
}

function installAnalyticsBrowser() {
  const scripts = []
  globalThis.window = { dataLayer: [] }
  globalThis.document = {
    title: 'Product details | South West',
    querySelector: selector => scripts.find(script => selector.includes(script.src)) || null,
    createElement: () => ({}),
    head: { appendChild: script => scripts.push(script) },
  }
  return scripts
}

test('analytics requires explicit consent, revokes tracking, and injects GA only once', async () => {
  installBrowserStorage()
  const scripts = installAnalyticsBrowser()
  const analytics = await loadAnalyticsModule()

  analytics.trackEvent('before_consent')
  assert.equal(scripts.length, 0)
  analytics.setAnalyticsConsent(true)
  analytics.trackEvent('after_accept')
  assert.equal(scripts.length, 1)

  analytics.setAnalyticsConsent(false)
  analytics.trackEvent('after_reject')
  const events = window.dataLayer.map(call => Array.from(call))
  assert.equal(events.filter(call => call[0] === 'event').length, 1)
  assert.ok(events.some(call => call[0] === 'consent' && call[1] === 'update' && call[2].analytics_storage === 'denied'))

  analytics.setAnalyticsConsent(true)
  analytics.trackEvent('after_reaccept')
  assert.equal(scripts.length, 1)
  assert.equal(window.dataLayer.map(call => Array.from(call)).filter(call => call[0] === 'event').length, 2)
})

test('analytics fails closed when browser storage is unavailable', async () => {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('blocked') } })
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, get() { throw new Error('blocked') } })
  const scripts = installAnalyticsBrowser()
  const analytics = await loadAnalyticsModule()

  assert.doesNotThrow(() => analytics.rememberCampaignParams('?utm_source=launch'))
  analytics.trackEvent('blocked')
  assert.equal(scripts.length, 0)
  assert.equal(window.dataLayer.length, 0)
})

test('analytics uses public product IDs and only keeps safe campaign attribution in page URLs', async () => {
  installBrowserStorage()
  installAnalyticsBrowser()
  const analytics = await loadAnalyticsModule()
  analytics.setAnalyticsConsent(true)

  const item = analytics.analyticsItem({ id: 123, public_id: 'public-uuid', item_name: 'Lamp' })
  assert.equal(item.item_id, 'public-uuid')

  analytics.trackPageView({
    path: '/product/lamp-123e4567-e89b-12d3-a456-426614174000',
    query: { utm_source: 'newsletter', email: 'person@example.com', token: 'secret', utm_campaign: 'person@example.com' },
    meta: {},
  })
  analytics.trackPageView({ path: '/person@example.com', query: {}, meta: {} })
  const pageView = window.dataLayer.map(call => Array.from(call)).find(call => call[0] === 'event' && call[1] === 'page_view')
  assert.match(pageView[2].page_location, /utm_source=newsletter/)
  assert.doesNotMatch(pageView[2].page_location, /email|token|person@example/)
  assert.equal(window.dataLayer.map(call => Array.from(call)).filter(call => call[0] === 'event' && call[1] === 'page_view').length, 1)
})

test('purchase tracking requires consent, deduplicates across reloads, and excludes order identifiers', async () => {
  const { values } = installBrowserStorage()
  installAnalyticsBrowser()
  const analytics = await loadAnalyticsModule()
  const purchase = {
    transaction_id: 'order-123',
    order_id: 123,
    customer_id: 42,
    currency: 'LKR',
    value: 2400,
    items: [{ item_id: 'public-product-id', item_name: 'Product', quantity: 1, price: 2400 }],
  }

  assert.equal(analytics.trackPurchaseOnce('order-123', purchase), false)
  assert.equal(values.size, 0)
  analytics.setAnalyticsConsent(true)
  assert.equal(analytics.trackPurchaseOnce('order-123', purchase), true)
  assert.equal(analytics.trackPurchaseOnce('order-123', purchase), false)

  const purchaseEvent = window.dataLayer.map(call => Array.from(call)).find(call => call[0] === 'event' && call[1] === 'purchase')
  assert.equal(purchaseEvent[2].transaction_id, undefined)
  assert.equal(purchaseEvent[2].order_id, undefined)
  assert.equal(purchaseEvent[2].customer_id, undefined)
  assert.ok([...values.keys()].some(key => key.startsWith('southwestGa4Purchase:')))
})

test('checkout milestone events require consent and are deduplicated for refreshed checkout data', async () => {
  const { values } = installBrowserStorage()
  installAnalyticsBrowser()
  const analytics = await loadAnalyticsModule()
  const payload = { currency: 'LKR', value: 2400, items: [{ item_id: 'public-id', quantity: 1 }] }

  assert.equal(analytics.trackEventOncePerSession('begin_checkout', 'cart-fingerprint', payload), false)
  assert.equal(values.size, 0)
  analytics.setAnalyticsConsent(true)
  assert.equal(analytics.trackEventOncePerSession('begin_checkout', 'cart-fingerprint', payload), true)
  assert.equal(analytics.trackEventOncePerSession('begin_checkout', 'cart-fingerprint', payload), false)
  assert.equal(window.dataLayer.map(call => Array.from(call)).filter(call => call[0] === 'event' && call[1] === 'begin_checkout').length, 1)
})

test('Product schema validates required fields and omits unknown stock availability', async () => {
  const { productSchema, itemListSchema } = await import(structuredUrl.href)
  const image = 'https://cdn.southwest.lk/products/lamp.webp'
  const path = '/product/lamp-123e4567-e89b-12d3-a456-426614174000'
  assert.equal(productSchema({ item_name: 'Lamp', price: 0 }, path, image), null)
  assert.equal(productSchema({ item_name: 'Lamp', price: 10 }, '/product/undefined', image), null)
  assert.equal(productSchema({ item_name: 'Lamp', price: 10 }, path, 'javascript:alert(1)'), null)

  const schema = productSchema({ item_name: 'Lamp', price: 10 }, path, image)
  assert.equal(schema.offers.url, `https://southwest.lk${path}`)
  assert.equal(Object.hasOwn(schema.offers, 'availability'), false)
  assert.equal(schema.image, image)

  const list = itemListSchema([
    { name: 'Lamp', path },
    { name: 'Invalid', path: '/product/undefined' },
  ])
  assert.equal(list.itemListElement.length, 1)
})
