import assert from 'node:assert/strict'
import test from 'node:test'
import { selectDefaultVariant } from '../src/utils/productOffer.js'
import { productSchema } from '../src/utils/structuredData.js'

const path = '/product/lamp-123e4567-e89b-12d3-a456-426614174000'
const canonical = `https://southwest.lk${path}`
const image = 'https://cdn.southwest.lk/products/lamp.webp'

const product = {
  item_name: 'Test Lamp',
  item_code: 'LAMP-001',
  brand: 'Test Brand',
  price: 2500,
  available_quantity: 10
}

test('boolean default variant takes priority over available stock', () => {
  const variants = [
    { id: 1, available_quantity: 10 },
    { id: 2, is_default: true, available_quantity: 0 }
  ]

  assert.equal(selectDefaultVariant(variants).id, 2)
})

test('numeric default flag is supported', () => {
  const variants = [
    { id: 1, available_quantity: 10 },
    { id: 2, is_default: 1, available_quantity: 0 }
  ]

  assert.equal(selectDefaultVariant(variants).id, 2)
})

test('inactive default variants are excluded', () => {
  const variants = [
    { id: 1, is_default: true, is_active: false },
    { id: 2, available_quantity: 5 }
  ]

  assert.equal(selectDefaultVariant(variants).id, 2)
})

test('first in-stock variant is selected without an explicit default', () => {
  const variants = [
    { id: 1, available_quantity: 0 },
    { id: 2, available_quantity: 5 },
    { id: 3, available_quantity: 10 }
  ]

  assert.equal(selectDefaultVariant(variants).id, 2)
})

test('explicit out-of-stock flag prevents stock-based selection', () => {
  const variants = [
    { id: 1, in_stock: false, available_quantity: 5 },
    { id: 2, available_quantity: 2 }
  ]

  assert.equal(selectDefaultVariant(variants).id, 2)
})

test('first active variant is retained when all are out of stock', () => {
  const variants = [
    { id: 1, is_active: false },
    { id: 2, available_quantity: 0 },
    { id: 3, available_quantity: 0 }
  ]

  assert.equal(selectDefaultVariant(variants).id, 2)
})

test('missing or empty variant lists return null', () => {
  for (const variants of [null, undefined, [], {}]) {
    assert.equal(selectDefaultVariant(variants), null)
  }

  assert.equal(
    selectDefaultVariant([{ id: 1, is_active: false }]),
    null
  )
})

test('variant selection does not modify the input list', () => {
  const variants = Object.freeze([
    Object.freeze({ id: 1, available_quantity: 0 }),
    Object.freeze({ id: 2, available_quantity: 5 })
  ])

  assert.equal(selectDefaultVariant(variants).id, 2)
  assert.equal(variants[0].id, 1)
})

test('Product schema uses the selected variant selling price', () => {
  const variant = {
    selling_price: 3000,
    available_quantity: 5
  }

  const schema = productSchema(product, path, image, variant)

  assert.equal(schema.offers.price, '3000.00')
  assert.equal(schema.offers.priceCurrency, 'LKR')
  assert.equal(schema.offers.availability, 'https://schema.org/InStock')
  assert.equal(schema.sku, 'LAMP-001')
  assert.equal(schema.offers.url, canonical)
})

test('Product schema skips invalid numeric price fields', () => {
  const variant = {
    selling_price: 'invalid',
    price: '3200',
    available_quantity: 5
  }

  const schema = productSchema(product, path, image, variant)

  assert.equal(schema.offers.price, '3200.00')
})

test('Product schema rejects a zero selected variant price', () => {
  const variant = {
    selling_price: 0,
    available_quantity: 5
  }

  assert.equal(
    productSchema(product, path, image, variant),
    null
  )
})

test('zero stock is represented as OutOfStock', () => {
  const schema = productSchema(product, path, image, {
    selling_price: 3000,
    available_quantity: 0
  })

  assert.equal(
    schema.offers.availability,
    'https://schema.org/OutOfStock'
  )
})

test('explicit false stock flag overrides positive quantity', () => {
  const schema = productSchema(product, path, image, {
    selling_price: 3000,
    available_quantity: 5,
    in_stock: false
  })

  assert.equal(
    schema.offers.availability,
    'https://schema.org/OutOfStock'
  )
})

test('boolean true without numeric quantity does not claim availability', () => {
  const schema = productSchema(product, path, image, {
    selling_price: 3000,
    in_stock: true
  })

  assert.equal(
    Object.hasOwn(schema.offers, 'availability'),
    false
  )
})

test('unknown variant stock does not inherit product stock', () => {
  const schema = productSchema(product, path, image, {
    selling_price: 3000
  })

  assert.equal(
    Object.hasOwn(schema.offers, 'availability'),
    false
  )
})

test('absolute and relative canonical inputs produce identical schemas', () => {
  const variant = {
    selling_price: 3000,
    available_quantity: 5
  }

  assert.deepEqual(
    productSchema(product, canonical, image, variant),
    productSchema(product, path, image, variant)
  )
})

test('credential-bearing product image URLs are rejected', () => {
  assert.equal(
    productSchema(
      product,
      path,
      'https://user:password@cdn.southwest.lk/lamp.webp'
    ),
    null
  )
})

test('product-level pricing works without a selected variant', () => {
  const schema = productSchema(product, path, image)

  assert.equal(schema.offers.price, '2500.00')
  assert.equal(schema.offers.priceCurrency, 'LKR')
})
