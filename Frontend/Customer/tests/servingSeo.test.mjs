import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { get } from 'node:http'
import { SITE_ORIGIN } from '../src/utils/productSeo.js'

// Run against the customer fixture build served by Apache, with a second
// loopback listener simulating HTTPS metadata set by a trusted front proxy.
const http = process.env.SEO_TEST_HTTP
const https = process.env.SEO_TEST_TLS
function request(origin, path, host = 'southwest.lk') {
  assert.equal(new URL(origin).hostname, '127.0.0.1')
  return new Promise((resolve, reject) => {
    get(origin + path, { agent: false, headers: { Host: host } }, res => {
      let html = ''
      res.setEncoding('utf8')
      res.on('data', chunk => { html += chunk })
      res.on('end', () => resolve({ status: res.statusCode, location: res.headers.location, html }))
      res.on('error', reject)
    }).on('error', reject)
  })
}

test('storefront HTTP status, canonical HTML and normalization across hosts', { skip: !http || !https }, async () => {
  const sitemap = await request(https, '/sitemap.xml')
  assert.equal(sitemap.status, 200)
  const paths = [...sitemap.html.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => {
    const url = new URL(match[1])
    assert.equal(url.origin, SITE_ORIGIN)
    return url.pathname
  })
  const product = paths.find(path => path.startsWith('/product/'))
  assert.ok(product)
  for (const path of paths) {
    const page = await request(https, path)
    assert.equal(page.status, 200, path)
    assert.deepEqual([...page.html.matchAll(/<link rel="canonical" href="([^"]+)"/g)].map(m => m[1]), [SITE_ORIGIN + path])
    assert.ok(page.html.includes('property="og:url" content="' + SITE_ORIGIN + path + '"'))
  }

  const query = '?ref=a%2Fb&token=Aa%2B09'
  const destinations = new Map([['/index.html', '/'], [product + '.html', product],
    [product + '/index.html', product], [product + '/', product],
    [product.replace('/product/', '/PRODUCT/'), product]])
  for (const path of paths.filter(path => path !== '/' && !path.startsWith('/product/'))) {
    for (const alias of [path + '.html', path + '/', path.toUpperCase(), path.toUpperCase() + '.HTML/']) {
      destinations.set(alias, path)
    }
  }
  for (const [origin, host] of [[http, 'southwest.lk'], [http, 'www.southwest.lk'],
    [https, 'www.southwest.lk'], [https, 'southwest.lk']]) {
    for (const [alias, finalPath] of destinations) {
      const redirect = await request(origin, alias + query, host)
      assert.equal(redirect.status, 301, alias)
      assert.equal(redirect.location, SITE_ORIGIN + finalPath + query, alias)
      const final = await request(https, finalPath + query)
      assert.equal(final.status, 200, finalPath)
      assert.equal(final.location, undefined)
    }
  }
  // Exercise the actual declared routes so a new client route without a server
  // mapping fails on refresh. Account children are relative to their parent.
  const source = await readFile(new URL('../src/router/index.js', import.meta.url), 'utf8')
  for (const [, pattern] of source.matchAll(/\bpath: '([^']*)'\s*,\s*(?:name|component):/g)) {
    if (pattern.includes('pathMatch') || pattern.includes('productSlug')) continue
    const path = (pattern.startsWith('/') ? pattern : '/account/' + pattern)
      .replace(/\/:\w+\?/g, '/TestCase123').replace(/\/$/, '') || '/'
    assert.equal((await request(https, path)).status, 200, path)
  }
  for (const path of ['/missing-route', '/product/missing', '/assets/absent.js', '/images/absent.webp']) {
    const res = await request(https, path)
    assert.equal(res.status, 404, path)
    assert.match(res.html, /Page not found/)
  }
  for (const path of ['/account/orders', '/checkout/address/test', '/product/new-11111111-1111-1111-1111-111111111111']) {
    const res = await request(https, path)
    assert.equal(res.status, 200, path)
    assert.doesNotMatch(res.html, /rel="canonical"/)
  }
  assert.equal((await request(http, '/api/store/products', 'api.southwest.lk')).location, undefined)
})
