<script setup>
import { computed, nextTick, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Download, Printer } from 'lucide-vue-next'
import invoiceApi from '@/api/invoiceApi'

const route = useRoute()
const router = useRouter()
const invoice = ref(null)
const loading = ref(true)
const downloading = ref(false)
const errorMessage = ref('')

const formatAmount = value => Number(value || 0).toLocaleString('en-LK', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})

const formatDate = value => {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric'
  })
}

const formatStatus = value => String(value || '-')
  .replaceAll('_', ' ')
  .replace(/\b\w/g, character => character.toUpperCase())

const formatVariant = item => {
  const parts = []
  if (item?.variant) parts.push(item.variant)
  const attributes = item?.variant_attributes
  if (attributes && typeof attributes === 'object') {
    const values = Array.isArray(attributes)
      ? attributes.map(attribute => typeof attribute === 'string'
        ? attribute
        : [attribute.name || attribute.attribute_name, attribute.value]
            .filter(Boolean).join(': '))
      : Object.entries(attributes).map(([key, value]) => {
        if (value === null || value === undefined || value === '') return ''
        return `${key}: ${Array.isArray(value)
          ? value.join(', ')
          : typeof value === 'object' ? JSON.stringify(value) : value}`
      })
    parts.push(...values.filter(Boolean))
  }
  return parts.join(' / ') || '-'
}

const addressLines = computed(() => {
  const address = invoice.value?.delivery_address
  if (!address) return []
  return [
    address.address_line_1,
    address.address_line_2,
    address.district,
    address.area,
    address.postal_code
  ].filter(Boolean)
})

async function loadInvoice() {
  loading.value = true
  errorMessage.value = ''
  try {
    const response = await invoiceApi.getInvoiceById(route.params.id)
    invoice.value = response?.data || null
    if (!invoice.value) errorMessage.value = 'Invoice not found.'
    if (invoice.value && route.query.print === '1') {
      await nextTick()
      window.setTimeout(() => window.print(), 150)
    }
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Failed to load invoice.'
  } finally {
    loading.value = false
  }
}

async function downloadPdf() {
  if (!invoice.value || downloading.value) return
  downloading.value = true
  try {
    const response = await invoiceApi.getInvoicePdf(invoice.value.id, true)
    const url = URL.createObjectURL(response.data)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `South-West-${invoice.value.invoice_number}.pdf`
    anchor.click()
    URL.revokeObjectURL(url)
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Failed to download invoice.'
  } finally {
    downloading.value = false
  }
}

const printInvoice = () => window.print()

onMounted(loadInvoice)
</script>

<template>
  <div class="invoice-viewer">
    <div class="invoice-actions no-print">
      <button type="button" class="secondary" @click="router.push('/admin/sales/invoices')">
        <ArrowLeft :size="16" /> Back to Invoices
      </button>
      <div>
        <button type="button" class="secondary" @click="printInvoice">
          <Printer :size="16" /> Print Invoice
        </button>
        <button type="button" class="primary" :disabled="downloading" @click="downloadPdf">
          <Download :size="16" /> {{ downloading ? 'Preparing...' : 'Download PDF' }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="state">Loading invoice...</div>
    <div v-else-if="errorMessage && !invoice" class="state error">{{ errorMessage }}</div>

    <article v-else-if="invoice" class="invoice-sheet">
      <div v-if="!invoice.is_final" class="draft-watermark" aria-hidden="true">DRAFT</div>

      <header class="invoice-header">
       <div class="brand">
  <img src="/SWLogoBlack.webp" alt="South West" />
  <div class="brand-contact">
    <p>{{ invoice.business?.website }}</p>
    <p>{{ invoice.business?.email }}</p>
    <p v-if="invoice.business?.phone">{{ invoice.business.phone }}</p>
  </div>
</div>
        <div class="invoice-identity">
          <h2>{{ invoice.is_final ? 'INVOICE' : 'DRAFT INVOICE' }}</h2>
          <span class="document-status" :class="`status-${invoice.document_status}`">
            {{ formatStatus(invoice.document_status) }}
          </span>
          <dl>
            <div><dt>Invoice Number</dt><dd>{{ invoice.invoice_number }}</dd></div>
            <div><dt>Invoice Date</dt><dd>{{ formatDate(invoice.invoice_date) }}</dd></div>
            <div><dt>Order Number</dt><dd>{{ invoice.order.order_number }}</dd></div>
            <div><dt>Order Date</dt><dd>{{ formatDate(invoice.order.order_date) }}</dd></div>
          </dl>
        </div>
      </header>

      <section class="party-grid">
        <div>
          <h3>Customer</h3>
          <strong>{{ invoice.customer.name }}</strong>
          <p>{{ invoice.customer.phone || '-' }}</p>
          <p v-if="invoice.customer.email">{{ invoice.customer.email }}</p>
        </div>
        <div>
          <h3>Delivery Address</h3>
          <p v-for="(line, index) in addressLines" :key="`${index}-${line}`">{{ line }}</p>
          <p v-if="!addressLines.length">-</p>
        </div>
      </section>

      <section class="products">
        <table>
          <thead>
            <tr>
              <th>Product</th><th>SKU</th><th>Variant</th><th>Qty</th>
              <th>Unit Price</th><th>Discount</th><th>Line Total</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in invoice.items" :key="item.id">
              <td>{{ item.name }}</td>
              <td>{{ item.sku || '-' }}</td>
              <td>{{ formatVariant(item) }}</td>
              <td>{{ item.quantity }}</td>
              <td>Rs. {{ formatAmount(item.unit_price) }}</td>
              <td>Rs. {{ formatAmount(item.discount_amount) }}</td>
              <td>Rs. {{ formatAmount(item.line_total) }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="invoice-bottom">
        <div class="payment-card">
          <h3>Payment Information</h3>
          <dl>
            <div><dt>Payment Method</dt><dd>{{ invoice.payment.payment_method_label }}</dd></div>
            <div><dt>Payment Status</dt><dd>{{ formatStatus(invoice.payment.payment_status) }}</dd></div>
            <div v-if="invoice.payment.payment_reference"><dt>Payment Reference</dt><dd>{{ invoice.payment.payment_reference }}</dd></div>
            <div v-if="invoice.payment.payment_date"><dt>Payment Date</dt><dd>{{ formatDate(invoice.payment.payment_date) }}</dd></div>
            <div><dt>Amount Paid</dt><dd>Rs. {{ formatAmount(invoice.payment.amount_paid) }}</dd></div>
            <div v-if="invoice.payment.outstanding_balance > 0"><dt>Outstanding Balance</dt><dd>Rs. {{ formatAmount(invoice.payment.outstanding_balance) }}</dd></div>
          </dl>
        </div>

        <div class="totals-card">
          <div><span>Subtotal</span><strong>Rs. {{ formatAmount(invoice.totals.subtotal) }}</strong></div>
          <div v-if="invoice.totals.has_discount" class="discount"><span>Discount</span><strong>- Rs. {{ formatAmount(invoice.totals.discount) }}</strong></div>
          <div v-if="invoice.totals.has_discount"><span>Actual Product Value</span><strong>Rs. {{ formatAmount(invoice.totals.actual_product_value) }}</strong></div>
          <div><span>Tax</span><strong>Rs. {{ formatAmount(invoice.totals.tax) }}</strong></div>
          <div><span>Delivery Charge</span><strong>Rs. {{ formatAmount(invoice.totals.delivery_charge) }}</strong></div>
          <div class="grand-total"><span>Final Total</span><strong>Rs. {{ formatAmount(invoice.totals.total) }}</strong></div>
        </div>
      </section>
    </article>
  </div>
</template>

<style scoped>
.invoice-viewer { color: #17251f; }
.invoice-actions { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 18px; }
.invoice-actions > div { display: flex; gap: 8px; }
.invoice-actions button { display: inline-flex; align-items: center; gap: 7px; min-height: 40px; padding: 0 14px; border-radius: 8px; font: inherit; font-weight: 600; cursor: pointer; }
.secondary { border: 1px solid #d8e0dc; background: #fff; color: #193c32; }
.primary { border: 1px solid #193c32; background: #193c32; color: #fff; }
.state { padding: 60px 20px; text-align: center; background: #fff; border: 1px solid #e2e8e5; border-radius: 12px; }
.error { color: #b91c1c; }
.invoice-sheet { position: relative; box-sizing: border-box; width: min(100%, 210mm); min-height: 297mm; margin: 0 auto; padding: 17mm; overflow: hidden; background: #fff; box-shadow: 0 8px 30px rgba(15, 23, 42, .1); }
.draft-watermark { position: absolute; top: 43%; left: 50%; z-index: 0; transform: translate(-50%, -50%) rotate(-32deg); color: rgba(148, 163, 154, .13); font-size: 92px; font-weight: 800; letter-spacing: .12em; pointer-events: none; }
.invoice-sheet > *:not(.draft-watermark) { position: relative; z-index: 1; }
.invoice-header { display: flex; justify-content: space-between; gap: 30px; padding-bottom: 18px; border-bottom: 2px solid #193c32; }
.brand { display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
.brand img { width: 120px; max-height: 70px; object-fit: contain; object-position: left; }
.brand-contact p { margin: 2px 0; color: #5f6f67; font-size: 11px; }
.invoice-identity { min-width: 285px; text-align: right; }
.invoice-identity h2 { margin: 0 0 7px; font-size: 25px; letter-spacing: .06em; }
.document-status { display: inline-flex; margin-bottom: 10px; padding: 4px 9px; border-radius: 999px; font-size: 10px; font-weight: 700; }
.status-final { background: #dcfce7; color: #166534; }
.status-draft { background: #fef3c7; color: #92400e; }
.status-cancelled, .status-returned, .status-refunded, .status-partially_refunded { background: #fee2e2; color: #991b1b; }
dl { margin: 0; }
dl div { display: flex; justify-content: space-between; gap: 20px; margin: 5px 0; }
dt { color: #6b7b73; font-size: 11px; }
dd { margin: 0; font-size: 11px; font-weight: 600; text-align: right; }
.party-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin: 24px 0; }
.party-grid h3, .payment-card h3 { margin: 0 0 9px; color: #193c32; font-size: 12px; text-transform: uppercase; letter-spacing: .05em; }
.party-grid strong, .party-grid p { margin: 3px 0; font-size: 12px; }
.products table { width: 100%; border-collapse: collapse; }
.products th, .products td { padding: 9px 7px; border-bottom: 1px solid #e0e7e3; font-size: 10px; text-align: left; }
.products th { background: #f3f7f5; color: #56675f; text-transform: uppercase; }
.products th:nth-last-child(-n+3), .products td:nth-last-child(-n+3) { text-align: right; white-space: nowrap; }
.invoice-bottom { display: grid; grid-template-columns: 1fr 300px; gap: 34px; margin-top: 28px; align-items: start; }
.payment-card { padding: 15px; border: 1px solid #e0e7e3; border-radius: 8px; }
.totals-card > div { display: flex; justify-content: space-between; gap: 20px; padding: 7px 0; font-size: 11px; }
.totals-card .discount strong { color: #15803d; }
.grand-total { margin-top: 7px; padding-top: 13px !important; border-top: 2px solid #193c32; font-size: 15px !important; }
@media (max-width: 760px) { .invoice-sheet { padding: 20px; min-height: auto; } .invoice-header, .invoice-actions { flex-direction: column; } .invoice-identity { min-width: 0; text-align: left; } .party-grid, .invoice-bottom { grid-template-columns: 1fr; } .products { overflow-x: auto; } }
@media print {
  :global(body) { background: #fff !important; }
  :global(.sidebar), :global(.topbar), :global(header.header), .no-print { display: none !important; }
  :global(.main-section) { margin-left: 0 !important; }
  :global(.page-content) { padding: 0 !important; }
  .invoice-sheet { width: 210mm; min-height: 297mm; margin: 0; overflow: visible; box-shadow: none; }
  .invoice-header, .party-grid, .invoice-bottom, .products tr { break-inside: avoid; }
  .products thead { display: table-header-group; }
  @page { size: A4; margin: 0; }
}
</style>
