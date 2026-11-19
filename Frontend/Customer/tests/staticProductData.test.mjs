import test from 'node:test'
import assert from 'node:assert/strict'

import { readStaticProductData } from '../src/utils/staticProductData.js'

const publicId = '123e4567-e89b-12d3-a456-426614174000'

function documentWith(value) {
  return {
    getElementById: id => id === 'southwest-product-data'
      ? { textContent: value }
      : null,
  }
}

test('reads a matching generated public product snapshot', () => {
  const snapshot = JSON.stringify({
    product: { id: 27, public_id: publicId, item_name: 'Public lamp' },
    variants: [
      { id: 1, is_active: true },
      { id: 2, is_active: false },
    ],
  })

  assert.deepEqual(readStaticProductData(publicId, documentWith(snapshot)), {
    id: 27,
    public_id: publicId,
    item_name: 'Public lamp',
    variants: [{ id: 1, is_active: true }],
  })
})

test('rejects stale, malformed, or absent product snapshots', () => {
  assert.equal(readStaticProductData('different-id', documentWith(JSON.stringify({
    product: { public_id: publicId },
  }))), null)
  assert.equal(readStaticProductData(publicId, documentWith('{invalid')), null)
  assert.equal(readStaticProductData(publicId, { getElementById: () => null }), null)
})
