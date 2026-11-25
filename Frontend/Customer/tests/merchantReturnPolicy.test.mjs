import test from 'node:test'
import assert from 'node:assert/strict'

import {
  merchantReturnPolicySchema,
  organizationSchema,
  websiteSchema,
} from '../src/utils/structuredData.js'

const expectedPolicy = {
  '@type': 'MerchantReturnPolicy',
  applicableCountry: 'LK',
  returnPolicyCategory:
    'https://schema.org/MerchantReturnNotPermitted',
  merchantReturnLink: 'https://southwest.lk/returns',
}

test('merchant return policy matches approved business policy', () => {
  assert.deepEqual(
    merchantReturnPolicySchema(),
    expectedPolicy
  )
})

test('Organization includes the shared merchant return policy', () => {
  assert.deepEqual(organizationSchema(), {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'South West',
    url: 'https://southwest.lk',
    logo: 'https://southwest.lk/SWLogo.webp',
    hasMerchantReturnPolicy: expectedPolicy,
  })
})

test('no unverified return periods, methods or fees are published', () => {
  const policy = merchantReturnPolicySchema()

  for (const property of [
    'merchantReturnDays',
    'returnMethod',
    'returnFees',
    'returnShippingFeesAmount',
    'refundType',
    'restockingFee',
  ]) {
    assert.equal(
      Object.hasOwn(policy, property),
      false,
      property
    )
  }
})

test('return policy objects are independent', () => {
  const first = merchantReturnPolicySchema()
  first.applicableCountry = 'INVALID'

  assert.deepEqual(
    merchantReturnPolicySchema(),
    expectedPolicy
  )
})

test('existing WebSite schema remains unchanged', () => {
  assert.deepEqual(websiteSchema(), {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'South West',
    url: 'https://southwest.lk',
  })
})
