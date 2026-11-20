import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildFullShippingAddress,
  getOrderAmounts,
  getOrderSummaryRows,
  getShippingDetails
} from './orderDetails.js'

test('shipping details keep saved city and delivery area separate', () => {
  const details = getShippingDetails({
    recipient_name: 'R K Dineru Suneth',
    address_line_1: '91/3 Wepitiya',
    address_line_2: 'Bibiladeniya',
    city: 'Kuliyapitiya',
    state: 'North Western Province',
    postal_code: '60200',
    phone: '0771234567',
    area: { area_name: 'Kuliyapitiya' }
  })

  assert.deepEqual(details, {
    customerName: 'R K Dineru Suneth',
    deliveryAddress: '91/3 Wepitiya, Bibiladeniya',
    city: 'Kuliyapitiya',
    district: '',
    area: 'Kuliyapitiya',
    postalCode: '60200',
    phone: '0771234567'
  })
})

test('missing optional shipping fields stay empty and are omitted from full copy', () => {
  const details = getShippingDetails({
    recipient_name: 'Guest Customer',
    address_line_1: '10 Main Road',
    city: 'Kandy'
  })

  assert.equal(details.area, '')
  assert.equal(details.postalCode, '')
  assert.equal(
    buildFullShippingAddress(details),
    'Guest Customer\n10 Main Road\nKandy'
  )
})

test('full address copy includes each available courier field once', () => {
  assert.equal(buildFullShippingAddress({
    customerName: 'Asha Perera',
    deliveryAddress: '20 Lake Road',
    city: 'Nugegoda',
    area: 'Nugegoda Delivery Area',
    postalCode: '10250',
    phone: '0712345678'
  }), 'Asha Perera\n20 Lake Road\nNugegoda\nNugegoda Delivery Area\nPostal Code: 10250\nPhone: 0712345678')
})

test('amounts expose the original summary and subtract a discount exactly once', () => {
  assert.deepEqual(getOrderAmounts({
    subtotal: '7350.00',
    discount_amount: '980.00',
    tax_amount: '0.00',
    shipping_amount: '450.00',
    total_amount: '6820.00'
  }), {
    subtotal: 7350,
    discount: 980,
    tax: 0,
    shipping: 450,
    actualProductValue: 6370,
    total: 6820,
    hasDiscount: true
  })
})

test('amounts use cent arithmetic and hide discount-only rows at zero', () => {
  assert.equal(getOrderAmounts({
    subtotal: '0.30',
    discount_amount: '0.10',
    shipping_amount: '0.20',
    total_amount: '0.40'
  }).actualProductValue, 0.2)

  assert.deepEqual(getOrderAmounts({}), {
    subtotal: 0,
    discount: 0,
    tax: 0,
    shipping: 0,
    actualProductValue: 0,
    total: 0,
    hasDiscount: false
  })
})

test('summary rows show discount and actual product value only for a positive discount', () => {
  const discounted = getOrderSummaryRows({
    subtotal: '7350.00',
    discount_amount: '980.00',
    tax_amount: '0.00',
    shipping_amount: '450.00',
    total_amount: '6820.00'
  })
  const fullPrice = getOrderSummaryRows({
    subtotal: '7350.00',
    discount_amount: '0.00',
    tax_amount: '0.00',
    shipping_amount: '450.00',
    total_amount: '7800.00'
  })

  assert.deepEqual(discounted.map(row => row.key), [
    'subtotal',
    'discount',
    'tax',
    'shipping',
    'actualProductValue',
    'total'
  ])
  assert.deepEqual(fullPrice.map(row => row.key), [
    'subtotal',
    'tax',
    'shipping',
    'total'
  ])
})
