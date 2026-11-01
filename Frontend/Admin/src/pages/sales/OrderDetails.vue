<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import orderApi from '../../api/orderApi'

const route = useRoute()
const router = useRouter()

const order = ref(null)
const loading = ref(true)
const errorMessage = ref('')
const savingStatus = ref(false)
const statusMessage = ref('')
const statusError = ref('')
const statusDialogOpen = ref(false)

const modalStatus = ref('')
const statusReason = ref('')
const courierName = ref('')
const trackingNumber = ref('')
const expectedDeliveryDate = ref('')

const statuses = [
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Order Confirmed' },
  { value: 'processing', label: 'Order Ready to Deliver' },
  { value: 'partially_shipped', label: 'Partially Shipped' },
  { value: 'shipped', label: 'Order Handed Over to Courier' },
  { value: 'delivered', label: 'Order Completed' },
  { value: 'cancelled', label: 'Order Cancelled' },
  { value: 'returned', label: 'Order Returned' }
]

const transitionMap = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  partially_shipped: ['shipped', 'cancelled'],
  shipped: ['delivered', 'returned'],
  delivered: ['returned'],
  cancelled: [],
  returned: []
}

const availableStatuses = computed(() => {
  if (!order.value) return []

  const allowed = transitionMap[order.value.status] || []

  return statuses.filter(status =>
    allowed.includes(status.value)
  )
})

const customerName = computed(() => {
  const customer = order.value?.customer

  if (!customer) {
    return order.value?.customer_name || 'Guest Customer'
  }

  return [
    customer.first_name,
    customer.last_name
  ].filter(Boolean).join(' ') || 'Guest Customer'
})

const addresses = computed(() => order.value?.addresses || [])

const billingAddress = computed(() =>
  addresses.value.find(address =>
    String(address.address_type).toLowerCase() === 'billing'
  )
)

const shippingAddress = computed(() =>
  addresses.value.find(address =>
    String(address.address_type).toLowerCase() === 'shipping'
  )
)

const items = computed(() => order.value?.items || [])
const payments = computed(() => order.value?.payments || [])
const deliveries = computed(() => order.value?.deliveries || [])
const promotions = computed(() => order.value?.promotions || [])
const invoices = computed(() => order.value?.invoices || [])

const formatAmount = (amount) =>
  Number(amount || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })

const formatDate = (value, includeTime = false) => {
  if (!value) return '-'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return String(value)

  return date.toLocaleString('en-GB', includeTime
    ? {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }
    : {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      }
  )
}

const formatLabel = (value) => {
  if (!value) return '-'

  return String(value)
    .replaceAll('_', ' ')
    .replace(/\b\w/g, character => character.toUpperCase())
}

const formatAddress = (address) => {
  if (!address) return []

  return [
    address.recipient_name,
    address.phone,
    address.address_line_1,
    address.address_line_2,
    address.city,
    address.state,
    address.postal_code,
    address.country
  ].filter(Boolean)
}

const variantDescription = (variant) => {
  if (!variant) return ''

  const attributes = variant.attributes

  if (attributes && typeof attributes === 'object') {
    if (Array.isArray(attributes)) {
      return attributes.map(attribute => {
        if (typeof attribute === 'string') return attribute

        return [
          attribute.name || attribute.attribute_name,
          attribute.value
        ].filter(Boolean).join(': ')
      }).filter(Boolean).join(' / ')
    }

    return Object.entries(attributes)
      .map(([key, value]) => {
        if (value === null || value === undefined || value === '') {
          return ''
        }

        return `${formatLabel(key)}: ${Array.isArray(value)
          ? value.join(', ')
          : typeof value === 'object'
            ? JSON.stringify(value)
            : value}`
      })
      .filter(Boolean)
      .join(' / ')
  }

  if (typeof attributes === 'string') {
    try {
      const parsed = JSON.parse(attributes)
      if (parsed && typeof parsed === 'object') {
        return Object.entries(parsed)
          .map(([key, value]) => `${formatLabel(key)}: ${value}`)
          .join(' / ')
      }
    } catch {
      return attributes
    }
  }

  return variant.variant_name || ''
}

const itemName = (item) =>
  item.item?.item_name ||
  item.item_name ||
  item.product_name ||
  `Product #${item.item_id || '-'}`

const itemCode = (item) =>
  item.item?.item_code ||
  item.item_code ||
  item.variant?.variant_sku ||
  '-'

const resetStatusDialog = () => {
  statusDialogOpen.value = false
  modalStatus.value = ''
  statusReason.value = ''
  courierName.value = ''
  trackingNumber.value = ''
  expectedDeliveryDate.value = ''
  statusError.value = ''
}

const openStatusDialog = () => {
  if (!modalStatus.value || !order.value) return

  statusError.value = ''
  statusDialogOpen.value = true
}

const confirmOrderStatus = async () => {
  if (!order.value || !modalStatus.value) return

  statusError.value = ''

  const payload = {
    status: modalStatus.value
  }

  if (['cancelled', 'returned'].includes(modalStatus.value)) {
    if (!statusReason.value.trim()) {
      statusError.value = 'Enter a reason before continuing.'
      return
    }

    payload.reason = statusReason.value.trim()
  }

  if (modalStatus.value === 'shipped') {
    if (!courierName.value.trim() || !trackingNumber.value.trim()) {
      statusError.value = 'Courier name and tracking number are required.'
      return
    }

    payload.courier_name = courierName.value.trim()
    payload.tracking_number = trackingNumber.value.trim()

    if (expectedDeliveryDate.value) {
      payload.expected_delivery_date = expectedDeliveryDate.value
    }
  }

  savingStatus.value = true

  try {
    const response = await orderApi.updateOrderStatus(
      order.value.id,
      payload
    )

    const emailStatus = response?.email_status

    statusMessage.value = emailStatus === 'failed'
      ? 'Order updated, but the customer email failed.'
      : emailStatus === 'skipped_missing_customer_email'
        ? 'Order updated, but the customer has no email address.'
        : 'Order status updated successfully.'

    resetStatusDialog()
    await loadOrder()
  } catch (error) {
    statusError.value =
      error.response?.data?.message ||
      'Failed to update order status.'
  } finally {
    savingStatus.value = false
  }
}

const loadOrder = async () => {
  loading.value = true
  errorMessage.value = ''
  statusMessage.value = ''

  try {
    const response = await orderApi.getOrderById(route.params.id)

    order.value = response?.data || null

    if (!order.value) {
      errorMessage.value = 'Order details could not be found.'
    }
  } catch (error) {
    console.error('Failed to load order:', error)

    errorMessage.value =
      error.response?.data?.message ||
      'Failed to load order details.'
  } finally {
    loading.value = false
  }
}

const goBack = () => router.push('/admin/sales/orders')

watch(() => route.params.id, loadOrder)

onMounted(loadOrder)
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <div>
        <button type="button" class="back-link" @click="goBack">
          <span aria-hidden="true">←</span> Back to Orders
        </button>

        <h1>Order Details</h1>
        <p>Review the order, customer information, payment and delivery.</p>
      </div>

      <div v-if="order" class="header-order">
        <span class="order-reference">{{ order.order_number }}</span>
        <span class="status-badge" :class="`status-${order.status}`">
          {{ formatLabel(order.status) }}
        </span>
      </div>
    </div>

    <div v-if="loading" class="state-card">
      Loading order details...
    </div>

    <div v-else-if="errorMessage" class="state-card error-state">
      <strong>Unable to load order</strong>
      <p>{{ errorMessage }}</p>
      <button class="primary-button" @click="loadOrder">Try Again</button>
    </div>

    <template v-else-if="order">
      <div v-if="statusMessage" class="success-message">
        {{ statusMessage }}
      </div>

      <div class="order-overview">
        <div class="overview-card">
          <span class="overview-label">Order Total</span>
          <strong>Rs. {{ formatAmount(order.total_amount) }}</strong>
          <small>{{ order.items?.length || 0 }} product lines</small>
        </div>

        <div class="overview-card">
          <span class="overview-label">Order Date</span>
          <strong>{{ formatDate(order.order_date, true) }}</strong>
          <small>{{ order.order_number }}</small>
        </div>

        <div class="overview-card">
          <span class="overview-label">Payment Status</span>
          <strong>{{ formatLabel(order.payment_status) }}</strong>
          <small>{{ formatLabel(order.order_type) }} order</small>
        </div>

        <div class="overview-card">
          <span class="overview-label">Fulfilment</span>
          <strong>{{ formatLabel(order.fulfillment_status) }}</strong>
          <small>Current fulfilment status</small>
        </div>
      </div>

      <div class="main-grid">
        <div class="main-column">
          <section class="card">
            <div class="card-header">
              <div>
                <h2>Ordered Products</h2>
                <p>Products and variants included in this order</p>
              </div>
              <span class="count-badge">{{ items.length }} items</span>
            </div>

            <div v-if="!items.length" class="empty-state">
              No order items found.
            </div>

            <div v-else class="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>SKU</th>
                    <th>Quantity</th>
                    <th>Unit Price</th>
                    <th>Discount</th>
                    <th>Line Total</th>
                  </tr>
                </thead>

                <tbody>
                  <tr v-for="(item, index) in items" :key="item.id || index">
                    <td>
                      <strong>{{ itemName(item) }}</strong>
                      <small v-if="variantDescription(item.variant)">
                        {{ variantDescription(item.variant) }}
                      </small>
                      <small v-else-if="item.variant?.variant_name">
                        {{ item.variant.variant_name }}
                      </small>
                    </td>
                    <td>{{ itemCode(item) }}</td>
                    <td>{{ item.quantity }}</td>
                    <td>Rs. {{ formatAmount(item.unit_price) }}</td>
                    <td>Rs. {{ formatAmount(item.discount_amount) }}</td>
                    <td>
                      <strong>Rs. {{ formatAmount(item.line_total) }}</strong>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section class="card">
            <div class="card-header">
              <div>
                <h2>Payment Information</h2>
                <p>Recorded payment transactions</p>
              </div>
              <span class="count-badge">{{ payments.length }} records</span>
            </div>

            <div v-if="!payments.length" class="empty-state">
              No payment records are associated with this order.
            </div>

            <div v-else class="record-list">
              <article
                v-for="payment in payments"
                :key="payment.id"
                class="record-card"
              >
                <div class="record-heading">
                  <strong>Payment #{{ payment.id }}</strong>
                  <span class="status-badge">
                    {{ formatLabel(payment.status || payment.payment_status) }}
                  </span>
                </div>

                <div class="record-grid">
                  <div>
                    <span>Amount</span>
                    <strong>Rs. {{ formatAmount(payment.amount) }}</strong>
                  </div>
                  <div>
                    <span>Method</span>
                    <strong>{{ formatLabel(payment.payment_method || payment.method) }}</strong>
                  </div>
                  <div>
                    <span>Reference</span>
                    <strong>{{ payment.transaction_reference || payment.reference || '-' }}</strong>
                  </div>
                  <div>
                    <span>Date</span>
                    <strong>{{ formatDate(payment.payment_date || payment.paid_at || payment.created_at, true) }}</strong>
                  </div>
                </div>
              </article>
            </div>
          </section>

          <section class="card">
            <div class="card-header">
              <div>
                <h2>Delivery Information</h2>
                <p>Courier and shipment details</p>
              </div>
              <span class="count-badge">{{ deliveries.length }} records</span>
            </div>

            <div v-if="!deliveries.length" class="empty-state">
              No delivery records are associated with this order.
            </div>

            <div v-else class="record-list">
              <article
                v-for="delivery in deliveries"
                :key="delivery.id"
                class="record-card"
              >
                <div class="record-heading">
                  <strong>Delivery #{{ delivery.id }}</strong>
                  <span class="status-badge">
                    {{ formatLabel(delivery.status || delivery.delivery_status) }}
                  </span>
                </div>

                <div class="record-grid">
                  <div>
                    <span>Courier</span>
                    <strong>{{ delivery.courier_name || '-' }}</strong>
                  </div>
                  <div>
                    <span>Tracking Number</span>
                    <strong>{{ delivery.tracking_number || '-' }}</strong>
                  </div>
                  <div>
                    <span>Expected Delivery</span>
                    <strong>{{ formatDate(delivery.expected_delivery_date) }}</strong>
                  </div>
                  <div>
                    <span>Delivered At</span>
                    <strong>{{ formatDate(delivery.delivered_at, true) }}</strong>
                  </div>
                </div>
              </article>
            </div>
          </section>
        </div>

        <aside class="side-column">
          <section class="card">
            <div class="card-header">
              <div>
                <h2>Customer</h2>
                <p>Customer contact information</p>
              </div>
            </div>

            <div class="customer-block">
              <div class="customer-avatar">
                {{ customerName.charAt(0).toUpperCase() }}
              </div>
              <div>
                <strong>{{ customerName }}</strong>
                <span>{{ order.customer?.email || order.customer_email || '-' }}</span>
                <span>{{ order.customer?.phone || order.customer_phone || '-' }}</span>
              </div>
            </div>
          </section>

          <section class="card">
            <div class="card-header">
              <div>
                <h2>Billing Address</h2>
              </div>
            </div>

            <div v-if="billingAddress" class="address-block">
              <p v-for="(line, index) in formatAddress(billingAddress)" :key="index">
                {{ line }}
              </p>
            </div>
            <div v-else class="empty-state compact">
              No billing address recorded.
            </div>
          </section>

          <section class="card">
            <div class="card-header">
              <div>
                <h2>Shipping Address</h2>
              </div>
            </div>

            <div v-if="shippingAddress" class="address-block">
              <p v-for="(line, index) in formatAddress(shippingAddress)" :key="index">
                {{ line }}
              </p>
            </div>
            <div v-else class="empty-state compact">
              No shipping address recorded.
            </div>
          </section>

          <section class="card">
            <div class="card-header">
              <div>
                <h2>Order Summary</h2>
              </div>
            </div>

            <div class="summary-lines">
              <div>
                <span>Subtotal</span>
                <strong>Rs. {{ formatAmount(order.subtotal) }}</strong>
              </div>
              <div>
                <span>Discount</span>
                <strong class="discount-value">
                  - Rs. {{ formatAmount(order.discount_amount) }}
                </strong>
              </div>
              <div>
                <span>Tax</span>
                <strong>Rs. {{ formatAmount(order.tax_amount) }}</strong>
              </div>
              <div>
                <span>Shipping</span>
                <strong>Rs. {{ formatAmount(order.shipping_amount) }}</strong>
              </div>
              <div class="summary-total">
                <span>Total</span>
                <strong>Rs. {{ formatAmount(order.total_amount) }}</strong>
              </div>
            </div>
          </section>

          <section class="card">
            <div class="card-header">
              <div>
                <h2>Update Order Status</h2>
                <p>Change the order's current status</p>
              </div>
            </div>

            <div class="status-update">
              <label for="order-status">Current status</label>
              <div class="current-status">
                {{ formatLabel(order.status) }}
              </div>

              <label for="order-status">New status</label>
              <select id="order-status" v-model="modalStatus">
                <option value="">Select next status</option>
                <option
                  v-for="status in availableStatuses"
                  :key="status.value"
                  :value="status.value"
                >
                  {{ status.label }}
                </option>
              </select>

              <button
                type="button"
                class="primary-button full-width"
                :disabled="!modalStatus || savingStatus"
                @click="openStatusDialog"
              >
                Continue
              </button>

              <p class="helper-text">
                Only permitted status transitions are available.
              </p>
            </div>
          </section>

          <section v-if="invoices.length" class="card">
            <div class="card-header">
              <h2>Invoices</h2>
            </div>
            <div v-for="invoice in invoices" :key="invoice.id" class="invoice-row">
              <strong>{{ invoice.invoice_number || `Invoice #${invoice.id}` }}</strong>
              <span>{{ formatLabel(invoice.status) }}</span>
            </div>
          </section>

          <section v-if="promotions.length" class="card">
            <div class="card-header">
              <h2>Promotions</h2>
            </div>
            <div v-for="promotion in promotions" :key="promotion.id" class="invoice-row">
              <strong>{{ promotion.name || promotion.code || `Promotion #${promotion.id}` }}</strong>
              <span>Rs. {{ formatAmount(promotion.discount_amount) }}</span>
            </div>
          </section>

          <section v-if="order.notes" class="card">
            <div class="card-header">
              <h2>Order Notes</h2>
            </div>
            <p class="notes-text">{{ order.notes }}</p>
          </section>
        </aside>
      </div>
    </template>

    <div
      v-if="statusDialogOpen"
      class="modal-backdrop"
      @click.self="resetStatusDialog"
    >
      <section
        class="status-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="status-modal-title"
      >
        <h2 id="status-modal-title">Confirm Order Status</h2>
        <p>
          Change this order to
          <strong>{{ formatLabel(modalStatus) }}</strong>?
        </p>

        <div
          v-if="['cancelled', 'returned'].includes(modalStatus)"
          class="form-field"
        >
          <label for="status-reason">Reason *</label>
          <textarea
            id="status-reason"
            v-model="statusReason"
            rows="4"
            maxlength="2000"
            placeholder="Enter the reason"
          />
        </div>

        <template v-if="modalStatus === 'shipped'">
          <div class="form-field">
            <label for="courier-name">Courier Name *</label>
            <input
              id="courier-name"
              v-model="courierName"
              type="text"
              maxlength="150"
              placeholder="Enter courier name"
            />
          </div>

          <div class="form-field">
            <label for="tracking-number">Tracking Number *</label>
            <input
              id="tracking-number"
              v-model="trackingNumber"
              type="text"
              maxlength="150"
              placeholder="Enter tracking number"
            />
          </div>

          <div class="form-field">
            <label for="expected-delivery">Expected Delivery Date</label>
            <input
              id="expected-delivery"
              v-model="expectedDeliveryDate"
              type="date"
            />
          </div>
        </template>

        <p v-if="statusError" class="modal-error">{{ statusError }}</p>

        <div class="modal-actions">
          <button
            type="button"
            class="secondary-button"
            :disabled="savingStatus"
            @click="resetStatusDialog"
          >
            Cancel
          </button>
          <button
            type="button"
            class="primary-button"
            :disabled="savingStatus"
            @click="confirmOrderStatus"
          >
            {{ savingStatus ? 'Updating...' : 'Confirm Update' }}
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.page-container {
  width: 100%;
  font-family: var(--font-family);
  color: var(--color-text-primary);
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 20px;
  margin-bottom: 24px;
}

.page-header h1 {
  margin: 10px 0 5px;
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
}

.page-header p,
.card-header p {
  margin: 5px 0 0;
  color: var(--color-text-secondary);
  font-size: 13px;
}

.back-link {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--color-primary);
  cursor: pointer;
  font-weight: 600;
}

.header-order {
  display: flex;
  align-items: center;
  gap: 12px;
}

.order-reference {
  font-weight: 700;
  font-size: 15px;
}

.order-overview {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 15px;
  margin-bottom: 20px;
}

.overview-card,
.card,
.state-card {
  background: var(--color-card, #fff);
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.035);
}

.overview-card {
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.overview-label,
.record-grid span,
.summary-lines span {
  color: var(--color-text-secondary);
  font-size: 12px;
}

.overview-card strong {
  font-size: 19px;
  overflow-wrap: anywhere;
}

.overview-card small {
  color: var(--color-text-secondary);
}

.main-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.8fr) minmax(280px, 0.9fr);
  align-items: start;
  gap: 20px;
}

.main-column,
.side-column {
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-width: 0;
}

.card {
  padding: 20px;
  min-width: 0;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 18px;
}

.card-header h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
}

.count-badge {
  background: var(--color-background, #f3f4f6);
  color: var(--color-text-secondary);
  padding: 5px 9px;
  border-radius: 20px;
  font-size: 12px;
  white-space: nowrap;
}

.table-container {
  width: 100%;
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 13px;
}

th {
  padding: 12px 10px;
  color: var(--color-text-secondary);
  background: var(--color-background, #f8fafc);
  font-weight: 600;
  white-space: nowrap;
}

td {
  padding: 14px 10px;
  border-bottom: 1px solid var(--color-border, #e5e7eb);
  vertical-align: top;
}

td strong,
td small {
  display: block;
}

td small {
  margin-top: 5px;
  color: var(--color-text-secondary);
  max-width: 260px;
  line-height: 1.5;
}

.record-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.record-card {
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 9px;
  padding: 14px;
}

.record-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 14px;
}

.record-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.record-grid div {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
}

.record-grid strong {
  font-size: 13px;
  overflow-wrap: anywhere;
}

.customer-block {
  display: flex;
  align-items: center;
  gap: 13px;
}

.customer-avatar {
  width: 43px;
  height: 43px;
  flex: 0 0 43px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--color-primary-light, #eef2ff);
  color: var(--color-primary);
  font-weight: 700;
  font-size: 18px;
}

.customer-block > div:last-child {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
}

.customer-block strong {
  font-size: 14px;
}

.customer-block span {
  font-size: 12px;
  color: var(--color-text-secondary);
  overflow-wrap: anywhere;
}

.address-block {
  line-height: 1.65;
  font-size: 13px;
}

.address-block p {
  margin: 0;
}

.summary-lines {
  display: flex;
  flex-direction: column;
  gap: 13px;
}

.summary-lines > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 13px;
}

.summary-lines strong {
  text-align: right;
}

.summary-lines .summary-total {
  border-top: 1px solid var(--color-border, #e5e7eb);
  padding-top: 15px;
  margin-top: 3px;
  font-size: 15px;
}

.summary-total strong {
  font-size: 18px;
}

.discount-value {
  color: #15803d;
}

.status-update {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.status-update label,
.form-field label {
  font-size: 12px;
  font-weight: 600;
}

.current-status {
  padding: 10px 12px;
  background: var(--color-background, #f8fafc);
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 7px;
  font-size: 13px;
}

.status-update select,
.form-field input,
.form-field textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: 7px;
  background: var(--color-card, #fff);
  color: var(--color-text-primary);
  font: inherit;
  font-size: 13px;
}

.helper-text {
  color: var(--color-text-secondary);
  font-size: 11px;
  margin: 2px 0 0;
}

.primary-button,
.secondary-button {
  border: 0;
  border-radius: 7px;
  padding: 10px 15px;
  cursor: pointer;
  font-weight: 600;
  font-size: 13px;
}

.primary-button {
  background: var(--color-primary);
  color: #fff;
}

.secondary-button {
  background: var(--color-background, #f3f4f6);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border, #e5e7eb);
}

.primary-button:disabled,
.secondary-button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.full-width {
  width: 100%;
}

.status-badge {
  display: inline-flex;
  padding: 5px 9px;
  border-radius: 20px;
  background: var(--color-background, #f3f4f6);
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.status-pending {
  color: #92400e;
  background: #fef3c7;
}

.status-confirmed,
.status-processing {
  color: #1d4ed8;
  background: #dbeafe;
}

.status-shipped,
.status-partially_shipped {
  color: #6d28d9;
  background: #ede9fe;
}

.status-delivered {
  color: #166534;
  background: #dcfce7;
}

.status-cancelled,
.status-returned {
  color: #b91c1c;
  background: #fee2e2;
}

.invoice-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--color-border, #e5e7eb);
  font-size: 12px;
}

.invoice-row:last-child {
  border-bottom: 0;
}

.invoice-row span {
  color: var(--color-text-secondary);
}

.notes-text {
  white-space: pre-wrap;
  font-size: 13px;
  line-height: 1.6;
}

.empty-state,
.state-card {
  padding: 22px;
  color: var(--color-text-secondary);
  font-size: 13px;
}

.empty-state.compact {
  padding: 0;
}

.state-card {
  margin-bottom: 18px;
}

.state-card p {
  margin: 8px 0 15px;
}

.error-state {
  color: #b91c1c;
}

.success-message {
  padding: 12px 15px;
  margin-bottom: 16px;
  border-radius: 8px;
  background: #dcfce7;
  color: #166534;
  font-size: 13px;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(15, 23, 42, 0.55);
}

.status-modal {
  width: min(100%, 480px);
  max-height: 90vh;
  overflow-y: auto;
  padding: 24px;
  background: var(--color-card, #fff);
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
}

.status-modal h2 {
  margin: 0 0 10px;
  font-size: 19px;
}

.status-modal > p {
  color: var(--color-text-secondary);
  font-size: 13px;
  margin-bottom: 18px;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 7px;
  margin-bottom: 14px;
}

.modal-error {
  color: #b91c1c;
  font-size: 12px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}

@media (max-width: 1050px) {
  .main-grid {
    grid-template-columns: 1fr;
  }

  .side-column {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
  }
}

@media (max-width: 700px) {
  .page-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .header-order {
    flex-wrap: wrap;
  }

  .order-overview {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .side-column {
    display: flex;
  }

  .card {
    padding: 15px;
  }

  .record-grid {
    grid-template-columns: 1fr;
  }
}
</style>
