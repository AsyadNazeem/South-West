import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = relativePath => fs.readFileSync(new URL(relativePath, import.meta.url), 'utf8')

const viewer = read('./InvoiceDetails.vue')
const list = read('./Invoice.vue')
const orderDetails = read('./OrderDetails.vue')
const router = read('../../router/index.js')

test('invoice viewer route is restricted by the existing invoice permission', () => {
  assert.match(router, /path: 'sales\/invoices\/:id'[\s\S]*permission: 'invoices\.view'/)
})

test('invoice list provides lifecycle filters and all required admin actions', () => {
  assert.match(list, /v-model="status"/)
  assert.match(list, /v-model="paymentMethod"/)
  assert.match(list, /v-model="orderNumber"/)
  assert.match(list, /View Invoice/)
  assert.match(list, /Print Invoice/)
  assert.match(list, /Download PDF/)
  assert.match(list, /Search by invoice, name or phone/)
  assert.match(list, /class="form-control search-input"/)
  assert.match(list, /class="action-button"/)
  assert.match(list, /form-control:focus/)
  assert.match(list, /var\(--color-primary\)/)
  assert.match(list, /var\(--color-primary-light\)/)
  assert.doesNotMatch(list, /#193c32|#245344|#2f6a58|#285b4b|#eaf3ef/)
})

test('viewer shows draft state, payment reconciliation, district and area without city', () => {
  assert.match(viewer, /draft-watermark/)
  assert.match(viewer, /Payment Method/)
  assert.match(viewer, /formatVariant\(item\)/)
  assert.match(viewer, /Amount Paid/)
  assert.match(viewer, /Outstanding Balance/)
  assert.match(viewer, /address\.address_line_1/)
  assert.match(viewer, /address\.district/)
  assert.match(viewer, /address\.area/)
  assert.doesNotMatch(viewer, /address\.city/)
})

test('viewer preserves order totals and prints as A4 without clipping overflow', () => {
  assert.match(viewer, /Actual Product Value/)
  assert.match(viewer, /Delivery Charge/)
  assert.match(viewer, /Final Total/)
  assert.match(viewer, /@page \{ size: A4; margin: 0; \}/)
  assert.match(viewer, /overflow: visible/)
  assert.match(viewer, /display: table-header-group/)
})

test('order details links existing invoice records to the viewer', () => {
  assert.match(orderDetails, /hasPermission\('invoices\.view'\)/)
  assert.match(orderDetails, /View Invoice/)
  assert.match(orderDetails, /\/admin\/sales\/invoices\/\$\{id\}/)
  assert.doesNotMatch(orderDetails, /Invoice\.create|createInvoice/)
})
