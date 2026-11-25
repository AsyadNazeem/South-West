import test from 'node:test'
import assert from 'node:assert/strict'

import {
  productMetadata,
  productTitle,
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

test('product identity uses the current catalog slug and retains active out-of-stock items', async () => {
  const { productPathFor, productPublicId } = await import('../src/utils/productSeo.js')
  const id = '11111111-2222-3333-4444-555555555555'
  assert.equal(productPublicId('outdated-name-' + id), id)
  assert.equal(productPathFor({ slug: 'current-name', public_id: id, in_stock: false }), '/product/current-name-' + id)
  assert.equal(productPathFor({ slug: '../invalid', public_id: id }), '')
  assert.equal(productPublicId('no-public-id'), '')
})

test('shared product head preserves identity and uses decoded, complete catalog facts', () => {
  const product = {
    item_name: 'R&D R&D Écran 27″',
    brand: 'R&D',
    public_id: '12345678-1234-1234-1234-123456789abc',
    slug: 'ecran-27',
    description: '<script>Bad text.</script><p>Interface: USB&#x2d;C &amp; HDMI</p><li>Material: Caf&eacute;&nbsp;alloy</li><p>Best price guaranteed.</p>',
    images: [{ url: '/other.jpg' }, { is_primary: true, url: '/display.jpg' }],
  }
  const meta = productMetadata(product)
  assert.equal(meta.title, 'R&D Écran 27″ | South West Sri Lanka')
  assert.equal(meta.description, 'R&D Écran 27″. Interface: USB-C & HDMI. Material: Café alloy.')
  assert.equal(meta.canonicalUrl, 'https://southwest.lk/product/ecran-27-' + product.public_id)
  // Query and mutable variant/stock fields do not identify a new product head.
  assert.deepEqual(productMetadata({ ...product, variants: [{}, {}], in_stock: false }), meta)
  assert.equal(meta.type, 'product')
  assert.equal(meta.image, 'https://southwest.lk/display.jpg')
  assert.equal(productMetadata({ ...product, image: 'https://cdn.example/item.jpg' }).image, 'https://cdn.example/item.jpg')
})

test('incomplete records keep meaningful names and safe fallbacks', () => {
  const name = 'Extra-long product family '.repeat(8).trim() + ' XZ-120'
  const meta = productMetadata({ name, image: 'javascript:void(0)' })
  assert.equal(meta.title, name + ' | South West')
  assert.ok(meta.description.includes('XZ-120'))
  assert.equal(meta.image, 'https://southwest.lk/SWShareImage.png')
  assert.equal(meta.canonicalUrl, null)
  assert.equal(productMetadata().description, 'Explore Product at South West Sri Lanka.')
  const base = { brand: 'Lexar', description: '<p>Read Speed: Up to 520MB/s</p>' }
  const small = productMetadata({ ...base, name: 'NS100 128GB' })
  const large = productMetadata({ ...base, name: 'NS100 256GB' })
  assert.notEqual(small.description, large.description)
  assert.ok(small.title.startsWith('Lexar NS100 128GB'))
})

test('whole catalog sentences and labeled values exclude volatile or unverified claims', () => {
  const product = { name: 'Atlas T2', description: '<p>The Atlas T2 is an adjustable tripod for cameras. Available now.</p>' }
  assert.equal(productMetadata(product).description, 'The Atlas T2 is an adjustable tripod for cameras.')
  const features = '<li>Remote Control - Bluetooth hands-free shutter</li><li>Compatibility: depending on model</li><li>Price: LKR 4500</li>'
  assert.equal(productMetadata({ ...product, description: features }).description, 'Atlas T2. Remote Control - Bluetooth hands-free shutter.')
})


test('adaptive branding retains full suffix for short titles', () => {
  assert.equal(
    productTitle('R8 1610 Wired Mouse'),
    'R8 1610 Wired Mouse | South West Sri Lanka'
  )
})

test('adaptive branding retains full suffix at exactly 60 characters', () => {
  const name = 'A'.repeat(
    60 - ' | South West Sri Lanka'.length
  )
  assert.equal(
    productTitle(name),
    name + ' | South West Sri Lanka'
  )
  assert.equal(productTitle(name).length, 60)
})

test('adaptive branding shortens suffix above 60 characters', () => {
  const name = 'A'.repeat(
    61 - ' | South West Sri Lanka'.length
  )
  assert.equal(
    productTitle(name),
    name + ' | South West'
  )
})

test('adaptive branding never truncates long product identities', () => {
  const name = 'A'.repeat(100) + ' XZ-120'
  assert.equal(
    productTitle(name),
    name + ' | South West'
  )
})

test('adaptive branding handles missing product names', () => {
  assert.equal(
    productTitle(''),
    'Product | South West Sri Lanka'
  )
})

test('adaptive branding does not duplicate an existing product brand', () => {
  const meta = productMetadata({
    item_name: 'Kingston 16GB Desktop RAM',
    brand_name: 'Kingston'
  })

  assert.equal(
    meta.title,
    'Kingston 16GB Desktop RAM | South West Sri Lanka'
  )
})

test('adaptive branding adds missing product brands', () => {
  const meta = productMetadata({
    item_name: 'NS100 256GB SATA SSD',
    brand_name: 'Lexar'
  })

  assert.equal(
    meta.title,
    'Lexar NS100 256GB SATA SSD | South West Sri Lanka'
  )
})

test('adaptive branding preserves canonical URLs', () => {
  const meta = productMetadata({
    item_name: 'Example Product '.repeat(6).trim(),
    slug: 'example-product',
    public_id: '123e4567-e89b-12d3-a456-426614174000'
  })

  assert.equal(
    meta.canonicalUrl,
    'https://southwest.lk/product/example-product-123e4567-e89b-12d3-a456-426614174000'
  )

  assert.ok(meta.title.endsWith(' | South West'))
})

test('adaptive branding preserves primary social images', () => {
  const meta = productMetadata({
    item_name: 'Example Product '.repeat(6).trim(),
    image: 'https://api.southwest.lk/uploads/example.jpg'
  })

  assert.equal(
    meta.image,
    'https://api.southwest.lk/uploads/example.jpg'
  )

  assert.ok(meta.title.endsWith(' | South West'))
})


test('description excludes explicit unsupported therapeutic outcomes', () => {
  const meta = productMetadata({
    name: 'Example Massage Device',
    description: '<p>Applications: Relieves pain and improves blood circulation</p><p>Speed Adjustment: 6 levels</p>'
  })

  assert.equal(
    meta.description,
    'Example Massage Device. Speed Adjustment: 6 levels.'
  )
})

test('description fallback excludes unsupported therapeutic sentences', () => {
  const meta = productMetadata({
    name: 'Example Device',
    description: '<p>The Example Device cures muscle pain.</p>'
  })

  assert.equal(
    meta.description,
    'Explore Example Device at South West Sri Lanka.'
  )
})

test('description preserves catalog fact ordering and useful physical dimensions', () => {
  const meta = productMetadata({
    name: 'Example Laptop Sleeve',
    description: '<p>Dimensions: 35.5 x 25.5 x 2.5cm</p><p>Compatibility: 14-inch laptops</p><p>Material: Polyester</p>'
  })

  assert.equal(
    meta.description,
    'Example Laptop Sleeve. Dimensions: 35.5 x 25.5 x 2.5cm. Compatibility: 14-inch laptops. Material: Polyester.'
  )
})

test('description deduplicates equivalent catalog facts', () => {
  const meta = productMetadata({
    name: 'Example Adapter',
    description: '<p>Interface: USB-C</p><p>Interface: USB-C.</p><p>Interface: usb-c</p>'
  })

  assert.equal(
    meta.description,
    'Example Adapter. Interface: USB-C.'
  )
})

test('description fallback avoids unnecessary branding overflow', () => {
  const name = 'A'.repeat(145) + ' XZ-120'
  const meta = productMetadata({ name })

  assert.equal(meta.description, name + '.')
  assert.ok(meta.description.length <= 160)
})

test('description preserves exceptionally long product identities', () => {
  const name = 'A'.repeat(180) + ' XZ-120'
  const meta = productMetadata({ name })

  assert.equal(meta.description, name + '.')
  assert.ok(meta.description.includes('XZ-120'))
})

test('description preserves connector direction and technical qualifiers', () => {
  const meta = productMetadata({
    name: 'Example Converter',
    description: '<p>Input Interface: USB 3.0 Type-A</p><p>Output Interface: HDMI Female</p><p>Cable Length: 0.2 Metres</p>'
  })

  assert.equal(
    meta.description,
    'Example Converter. Input Interface: USB 3.0 Type-A. Output Interface: HDMI Female. Cable Length: 0.2 Metres.'
  )
})
