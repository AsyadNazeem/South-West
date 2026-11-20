import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = name => fs.readFileSync(new URL(`./${name}.vue`, import.meta.url), 'utf8')
const pages = {
  Orders: read('Orders'),
  Payments: read('Payment'),
  Invoices: read('Invoice'),
  Deliveries: read('Deliveries')
}

test('all four Sales searches advertise phone-number support', () => {
  for (const [name, source] of Object.entries(pages)) {
    assert.match(source, /placeholder="[^"]*phone[^"]*"/i, name)
  }
})

test('all Sales search changes reset pagination before loading results', () => {
  for (const [name, source] of Object.entries({
    Orders: pages.Orders,
    Payments: pages.Payments,
    Deliveries: pages.Deliveries
  })) {
    assert.match(source, /watch\(search[\s\S]*page\.value = 1/, name)
  }
  assert.match(pages.Invoices, /queueFilter[\s\S]*page\.value = 1[\s\S]*loadInvoices/)
})

test('Orders, Payments, Invoices, and Deliveries debounce their search requests', () => {
  assert.match(pages.Orders, /setTimeout\(loadOrders, 300\)/)
  assert.match(pages.Payments, /setTimeout\(loadPayments, 300\)/)
  assert.match(pages.Invoices, /setTimeout\([\s\S]*loadInvoices\(\)[\s\S]*250/)
  assert.match(pages.Deliveries, /setTimeout\(loadDeliveries, 300\)/)
})

test('paginated Payment and Delivery results are not filtered again in the browser', () => {
  assert.match(pages.Payments, /filteredPayments = computed\(\(\) => payments\.value\)/)
  assert.match(pages.Deliveries, /filteredDeliveries = computed\(\(\) => deliveries\.value\)/)
})
