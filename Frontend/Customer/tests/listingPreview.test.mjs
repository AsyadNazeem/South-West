import assert from 'node:assert/strict'
import test from 'node:test'
import { listingContent } from '../src/router/listingContent.js'
import { listingMeta } from '../src/router/listingMeta.js'
import { insertListingPreview } from '../scripts/listingPreview.mjs'
import { escapeHtml } from '../scripts/htmlMeta.mjs'

const template = `<html>
<head><title>Fixture</title></head>
<body><div id="app"></div><script type="module" src="/assets/app.js"></script></body>
</html>`

const headings = {
  '/shop': 'All Products',
  '/offers': 'Special Offers',
  '/categories': 'Shop by Category',
  '/brands': 'Shop by Brand',
}

test('listing content covers exactly the four indexable listing routes', () => {
  assert.deepEqual(
    Object.keys(listingContent).sort(),
    Object.keys(listingMeta).sort()
  )
})

for (const [path, heading] of Object.entries(headings)) {
  test(`${path} contains one initial H1 and matching visible content`, () => {
    const html = insertListingPreview(template, path)
    const content = listingContent[path]

    assert.equal(content.heading, heading)
    assert.equal((html.match(/<h1>/g) || []).length, 1)
    assert.ok(html.includes(`<h1>${escapeHtml(heading)}</h1>`))
    assert.ok(html.includes(escapeHtml(content.description)))
    assert.ok(html.includes(escapeHtml(content.breadcrumb)))
    assert.ok(html.includes('data-static-listing-preview'))
    assert.ok(html.includes('<a href="/">Home</a>'))
    assert.ok(html.includes('<title>Fixture</title>'))
    assert.ok(html.includes('src="/assets/app.js"'))
    assert.ok(!html.includes('application/ld+json'))
    assert.ok(!html.includes('class="product-card"'))
  })
}

test('offers preview preserves its shop navigation link', () => {
  const html = insertListingPreview(template, '/offers')
  assert.ok(html.includes('href="/shop"'))
  assert.ok(html.includes('View all products'))
})

test('unknown routes are rejected', () => {
  assert.throws(() => insertListingPreview(template, '/unknown'))
})

test('missing or duplicate application containers are rejected', () => {
  assert.throws(() => insertListingPreview('<html></html>', '/shop'))
  assert.throws(() => insertListingPreview(template + template, '/shop'))
})

test('an existing preview cannot be inserted twice', () => {
  const html = insertListingPreview(template, '/shop')
  assert.throws(() => insertListingPreview(html, '/shop'))
})
