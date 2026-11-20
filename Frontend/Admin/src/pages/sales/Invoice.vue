<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Download, Eye, Printer, RefreshCw, Search } from 'lucide-vue-next'
import invoiceApi from '@/api/invoiceApi'
import AppPagination from '@/components/common/AppPagination.vue'
import { createRequestSequence } from '@/composables/useServerPagination.js'

const router = useRouter()
const sequence = createRequestSequence()
const invoices = ref([])
const loading = ref(false)
const downloadingId = ref(null)
const errorMessage = ref('')
const search = ref('')
const orderNumber = ref('')
const status = ref('')
const paymentMethod = ref('')
const page = ref(1)
const pageSize = ref(25)
const pagination = ref({ total: 0, totalPages: 1 })
let filterTimer

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

async function loadInvoices() {
  const requestId = sequence.begin()
  loading.value = true
  errorMessage.value = ''
  try {
    const response = await invoiceApi.getInvoices({
      page: page.value,
      pageSize: pageSize.value,
      search: search.value.trim() || undefined,
      orderNumber: orderNumber.value.trim() || undefined,
      status: status.value || undefined,
      paymentMethod: paymentMethod.value || undefined
    })
    if (!sequence.isCurrent(requestId)) return
    invoices.value = response?.data || []
    pagination.value = response?.pagination || {
      total: invoices.value.length,
      totalPages: 1
    }
  } catch (error) {
    if (!sequence.isCurrent(requestId)) return
    errorMessage.value = error.response?.data?.message || 'Failed to load invoices.'
  } finally {
    if (sequence.isCurrent(requestId)) loading.value = false
  }
}

function queueFilter() {
  window.clearTimeout(filterTimer)
  sequence.invalidate()
  filterTimer = window.setTimeout(() => {
    page.value = 1
    loadInvoices()
  }, 250)
}

watch([search, orderNumber, status, paymentMethod], queueFilter)

const viewInvoice = id => router.push(`/admin/sales/invoices/${id}`)

function printInvoice(id) {
  const href = router.resolve({
    path: `/admin/sales/invoices/${id}`,
    query: { print: '1' }
  }).href
  window.open(href, '_blank', 'noopener,noreferrer')
}

async function downloadInvoice(invoice) {
  if (downloadingId.value) return
  downloadingId.value = invoice.id
  errorMessage.value = ''
  try {
    const response = await invoiceApi.getInvoicePdf(invoice.id, true)
    const url = URL.createObjectURL(response.data)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `South-West-${invoice.invoice_number}.pdf`
    anchor.click()
    URL.revokeObjectURL(url)
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Failed to download invoice.'
  } finally {
    downloadingId.value = null
  }
}

const changePage = value => {
  page.value = value
  loadInvoices()
}

const changePageSize = value => {
  pageSize.value = value
  page.value = 1
  loadInvoices()
}

onMounted(loadInvoices)
onBeforeUnmount(() => {
  sequence.invalidate()
  window.clearTimeout(filterTimer)
})
</script>

<template>
  <div class="invoice-page">
    <header class="page-header">
      <div>
        <h1>Invoices</h1>
        <p>View, print, and download customer order invoices.</p>
      </div>
    </header>

    <section class="filters-card" aria-label="Invoice filters">
      <label class="control-group search-control">
        <span class="sr-only">Search invoices</span>
        <Search class="control-icon" :size="18" aria-hidden="true" />
        <input
          v-model="search"
          class="form-control search-input"
          type="search"
          placeholder="Search by invoice, name or phone..."
        />
      </label>
      <label class="control-group search-control">
        <span class="sr-only">Search by order number</span>
        <Search class="control-icon" :size="18" aria-hidden="true" />
        <input
          v-model="orderNumber"
          class="form-control search-input"
          type="search"
          placeholder="Order number..."
        />
      </label>
      <label class="control-group">
        <span class="sr-only">Invoice status</span>
        <select v-model="status" class="form-control" aria-label="Invoice status">
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="final">Final</option>
          <option value="cancelled">Cancelled</option>
          <option value="refunded">Refunded</option>
        </select>
      </label>
      <label class="control-group">
        <span class="sr-only">Payment method</span>
        <select v-model="paymentMethod" class="form-control" aria-label="Payment method">
          <option value="">All payment methods</option>
          <option value="cash">Cash on Delivery</option>
          <option value="card">Card</option>
          <option value="koko">Koko</option>
          <option value="mintpay">Mintpay</option>
          <option value="bank_transfer">Bank Transfer</option>
        </select>
      </label>
      <button type="button" class="refresh-button" :disabled="loading" @click="loadInvoices">
        <RefreshCw :size="17" :class="{ spinning: loading }" aria-hidden="true" />
        Refresh
      </button>
    </section>

    <p v-if="errorMessage" class="message error-message">{{ errorMessage }}</p>

    <section class="table-card">
      <div v-if="loading" class="state">Loading invoices...</div>
      <div v-else-if="!invoices.length" class="state">No invoices found.</div>
      <div v-else class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Invoice Number</th>
              <th>Order Number</th>
              <th>Customer</th>
              <th>Payment Method</th>
              <th>Status</th>
              <th>Order Total</th>
              <th>Invoice Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="invoice in invoices" :key="invoice.id">
              <td><strong>{{ invoice.invoice_number }}</strong></td>
              <td>{{ invoice.order_number || '-' }}</td>
              <td>{{ invoice.customer_name || '-' }}</td>
              <td>{{ invoice.payment_method_label }}</td>
              <td>
                <span class="status-badge" :class="`status-${invoice.document_status}`">
                  {{ formatStatus(invoice.document_status) }}
                </span>
              </td>
              <td class="amount">Rs. {{ formatAmount(invoice.total_amount) }}</td>
              <td>{{ formatDate(invoice.invoice_date) }}</td>
              <td>
                <div class="actions">
                  <button type="button" class="action-button" title="View Invoice" aria-label="View Invoice" @click="viewInvoice(invoice.id)">
                    <Eye :size="16" />
                  </button>
                  <button type="button" class="action-button" title="Print Invoice" aria-label="Print Invoice" @click="printInvoice(invoice.id)">
                    <Printer :size="16" />
                  </button>
                  <button
                    type="button"
                    class="action-button"
                    title="Download PDF"
                    aria-label="Download PDF"
                    :disabled="downloadingId === invoice.id"
                    @click="downloadInvoice(invoice)"
                  >
                    <Download :size="16" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <AppPagination
        :page="page"
        :page-size="pageSize"
        :total="pagination.total"
        :total-pages="pagination.totalPages"
        :loading="loading"
        @update:page="changePage"
        @update:page-size="changePageSize"
      />
    </section>
  </div>
</template>

<style scoped>
.invoice-page { width: 100%; color: var(--color-text-primary, #1f2937); }
.page-header { margin-bottom: 22px; }
.page-header h1 { margin: 0 0 6px; color: var(--color-text-primary); font-size: var(--font-size-2xl, 28px); font-weight: 700; }
.page-header p { margin: 0; color: var(--color-text-secondary, #64748b); }
.filters-card, .table-card { background: var(--color-card, #fff); border: 1px solid var(--color-border, #e2e8f0); border-radius: 12px; box-shadow: 0 2px 8px rgba(15, 23, 42, .04); }
.filters-card { display: grid; grid-template-columns: minmax(230px, 1.45fr) minmax(180px, 1fr) repeat(2, minmax(160px, .82fr)) auto; gap: 12px; padding: 16px; margin-bottom: 18px; }
.control-group { position: relative; display: block; min-width: 0; }
.form-control { box-sizing: border-box; width: 100%; min-width: 0; height: 42px; padding: 0 12px; border: 1px solid var(--color-border); border-radius: var(--radius-lg); outline: none; background: var(--color-surface); color: var(--color-text-primary); font: inherit; font-size: var(--font-size-sm); transition: border-color var(--transition-fast), box-shadow var(--transition-fast); }
.form-control:hover { border-color: var(--color-text-muted); }
.form-control:focus { border-color: var(--color-primary); box-shadow: 0 0 0 3px var(--color-primary-light); }
.search-input { padding-left: 39px; }
.control-icon { position: absolute; top: 50%; left: 12px; z-index: 1; transform: translateY(-50%); color: var(--color-text-muted); pointer-events: none; }
select.form-control { padding-right: 34px; cursor: pointer; }
.refresh-button { display: inline-flex; align-items: center; justify-content: center; gap: 7px; height: 42px; padding: 0 16px; border: 1px solid var(--color-primary); border-radius: var(--radius-lg); background: var(--color-primary); color: var(--color-text-light); font: inherit; font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); cursor: pointer; transition: background var(--transition-fast), transform var(--transition-fast); }
.refresh-button:hover:not(:disabled) { background: var(--color-primary-hover); transform: translateY(-1px); }
.refresh-button:focus-visible { outline: 3px solid var(--color-primary-light); outline-offset: 2px; }
.refresh-button:disabled { opacity: .58; cursor: wait; }
.spinning { animation: spin .8s linear infinite; }
.table-card { overflow: hidden; }
.table-wrap { overflow-x: auto; }
table { width: 100%; min-width: 1030px; border-collapse: collapse; }
th, td { padding: 14px 16px; border-bottom: 1px solid #e8eeeb; text-align: left; font-size: 13px; vertical-align: middle; }
th { background: var(--color-hover-bg); color: var(--color-text-secondary); font-size: var(--font-size-xs); font-weight: var(--font-weight-bold); text-transform: uppercase; letter-spacing: .055em; white-space: nowrap; }
tbody tr { transition: background-color .15s ease; }
tbody tr:nth-child(even) { background: #fbfcfe; }
tbody tr:hover { background: var(--color-surface-hover); }
tbody tr:last-child td { border-bottom: 0; }
td strong { color: var(--color-primary); font-weight: var(--font-weight-bold); }
.amount { white-space: nowrap; font-variant-numeric: tabular-nums; font-weight: 650; text-align: right; }
.status-badge { display: inline-flex; align-items: center; min-height: 25px; padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; line-height: 1; }
.status-draft { background: #fef3c7; color: #92400e; }
.status-final { background: #dcfce7; color: #166534; }
.status-cancelled, .status-returned, .status-refunded, .status-partially_refunded { background: #fee2e2; color: #991b1b; }
.actions { display: flex; align-items: center; gap: 7px; }
.action-button { display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; padding: 0; border: 1px solid var(--color-border); border-radius: var(--radius-lg); background: var(--color-surface); color: var(--color-primary); cursor: pointer; transition: border-color var(--transition-fast), background var(--transition-fast), color var(--transition-fast), transform var(--transition-fast); }
.action-button:hover:not(:disabled) { border-color: var(--color-primary); background: var(--color-primary-light); color: var(--color-primary-hover); transform: translateY(-1px); }
.action-button:focus-visible { outline: 3px solid var(--color-primary-light); outline-offset: 2px; }
.action-button:disabled { opacity: .48; cursor: wait; }
.state { padding: 54px 20px; text-align: center; color: var(--color-text-secondary, #64748b); }
.message { padding: 12px 14px; border-radius: 8px; margin: 0 0 16px; }
.error-message { border: 1px solid #fecaca; background: #fef2f2; color: #b91c1c; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
@keyframes spin { to { transform: rotate(360deg); } }
@media (max-width: 1180px) { .filters-card { grid-template-columns: repeat(2, minmax(0, 1fr)); } .refresh-button { justify-self: start; } }
@media (max-width: 640px) { .filters-card { grid-template-columns: 1fr; padding: 13px; } .refresh-button { width: 100%; } th, td { padding: 12px 14px; } }
</style>
