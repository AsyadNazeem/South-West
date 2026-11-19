import test from 'node:test'
import assert from 'node:assert/strict'

import {
  isDefinitiveProductAbsence,
  isProductRouteIndexable,
  shouldPreserveStaticProductMeta,
} from '../src/utils/productSeo.js'

const productPath = '/product/example-12345678-1234-1234-1234-123456789abc'

test('preserves matching statically generated product metadata during hydration', () => {
  assert.equal(shouldPreserveStaticProductMeta({
    routeName: 'product-details',
    routePath: productPath,
    hasQuery: false,
    canonicalHref: `https://southwest.lk${productPath}`,
    ogType: 'product',
    robotsContent: 'index, follow',
  }), true)
})

test('does not preserve a matching canonical from a different origin', () => {
  assert.equal(shouldPreserveStaticProductMeta({
    routeName: 'product-details',
    routePath: productPath,
    hasQuery: false,
    canonicalHref: `https://example.com${productPath}`,
    ogType: 'product',
    robotsContent: 'index, follow',
  }), false)
})

test('does not preserve metadata from a previous product during client navigation', () => {
  assert.equal(shouldPreserveStaticProductMeta({
    routeName: 'product-details',
    routePath: productPath,
    hasQuery: false,
    canonicalHref: 'https://southwest.lk/product/previous-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    ogType: 'product',
    robotsContent: 'index, follow',
  }), false)
})

test('does not preserve the generic SPA shell metadata for a product URL', () => {
  assert.equal(shouldPreserveStaticProductMeta({
    routeName: 'product-details',
    routePath: productPath,
    hasQuery: false,
    canonicalHref: 'https://southwest.lk/',
    ogType: 'website',
    robotsContent: 'index, follow',
  }), false)
})

test('retains the existing noindex handling for product URLs with query parameters', () => {
  assert.equal(shouldPreserveStaticProductMeta({
    routeName: 'product-details',
    routePath: productPath,
    hasQuery: true,
    canonicalHref: `https://southwest.lk${productPath}`,
    ogType: 'product',
    robotsContent: 'index, follow',
  }), false)
})

test('does not preserve a noindex state when navigating from a queried product URL', () => {
  assert.equal(shouldPreserveStaticProductMeta({
    routeName: 'product-details',
    routePath: productPath,
    hasQuery: false,
    canonicalHref: `https://southwest.lk${productPath}`,
    ogType: 'product',
    robotsContent: 'noindex, nofollow',
  }), false)
})

test('never changes metadata handling for non-product routes', () => {
  assert.equal(shouldPreserveStaticProductMeta({
    routeName: 'home',
    routePath: '/',
    hasQuery: false,
    canonicalHref: 'https://southwest.lk/',
    ogType: 'product',
    robotsContent: 'index, follow',
  }), false)
})

test('query-free product lifecycle remains indexable through success and transient failures', () => {
  const query = {}

  // Initial router metadata on client-side navigation.
  assert.equal(isProductRouteIndexable(query), true)

  // Successful product loading uses the same route decision.
  assert.equal(isProductRouteIndexable(query), true)

  // Network errors, timeouts, forbidden responses, rate limits and 5xx errors
  // are not authoritative evidence that the product is absent.
  for (const responseStatus of [undefined, 0, 403, 408, 429, 500, 503]) {
    assert.equal(isDefinitiveProductAbsence({ responseStatus }), false)
    assert.equal(isProductRouteIndexable(query), true)
  }
})

test('query-bearing product lifecycle remains noindex after successful loading', () => {
  for (const query of [
    { utm_source: 'google' },
    { ref: 'campaign', color: 'black' },
  ]) {
    // Both router initialization and the successful product metadata update
    // consume this decision, so the latter cannot undo the former.
    assert.equal(isProductRouteIndexable(query), false)
    assert.equal(isProductRouteIndexable(query), false)
  }
})

test('product-to-product navigation replaces stale metadata with the new clean URL state', () => {
  const nextProductPath = '/product/next-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'

  assert.equal(shouldPreserveStaticProductMeta({
    routeName: 'product-details',
    routePath: nextProductPath,
    hasQuery: false,
    canonicalHref: `https://southwest.lk${productPath}`,
    ogType: 'product',
    robotsContent: 'index, follow',
  }), false)
  assert.equal(isProductRouteIndexable({}), true)
})

test('only malformed, missing, or explicitly 404 products are definitive absences', () => {
  assert.equal(isDefinitiveProductAbsence({ hasPublicId: false }), true)
  assert.equal(isDefinitiveProductAbsence({ productFound: false }), true)
  assert.equal(isDefinitiveProductAbsence({ responseStatus: 404 }), true)
  assert.equal(isDefinitiveProductAbsence({ responseStatus: 403 }), false)
  assert.equal(isDefinitiveProductAbsence({ responseStatus: 500 }), false)
})
