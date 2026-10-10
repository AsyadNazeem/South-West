<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import invoiceApi from '../../api/invoiceApi'
import orderApi from '../../api/orderApi'
import customerApi from '../../api/customerApi'

const router = useRouter()

const LIST_ROUTE = '/admin/sales/invoices'

const saving = ref(false)
const loading = ref(false)

const error = ref('')
const success = ref('')

const orders = ref([])
const customers = ref([])

// ==========================================
// Form
// ==========================================

const form = ref({
  invoice_number: '',
  order_id: '',
  customer_id: '',
  invoice_date: '',
  due_date: '',
  status: 'draft',
  subtotal: 0,
  discount_amount: 0,
  tax_amount: 0,
  shipping_amount: 0,
  total_amount: 0,
  paid_amount: 0,
  balance_amount: 0,
  notes: ''
})

// ==========================================
// Generate Invoice Number
// ==========================================

const generateInvoiceNumber = () => {
  const timestamp = Date.now()

  form.value.invoice_number = `INV-${timestamp}`
}

// ==========================================
// Load Orders
// ==========================================

const loadOrders = async () => {
  try {
    const response = await orderApi.getOrders()

    orders.value =
        response?.data?.data ||
        response?.data ||
        []

  } catch (err) {
    console.error('Failed to load orders:', err)

    error.value =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to load orders.'
  }
}

// ==========================================
// Load Customers
// ==========================================

const loadCustomers = async () => {
  try {
    const response = await customerApi.getCustomers()

    customers.value =
        response?.data?.data ||
        response?.data ||
        []

  } catch (err) {
    console.error('Failed to load customers:', err)

    error.value =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to load customers.'
  }
}

// ==========================================
// Order Changed
// ==========================================

const orderChanged = () => {
  const order = orders.value.find(
      order => order.id == form.value.order_id
  )

  if (!order) {
    return
  }

  form.value.customer_id =
      order.customer_id || ''

  form.value.subtotal =
      Number(order.subtotal || 0)

  form.value.discount_amount =
      Number(order.discount_amount || 0)

  form.value.tax_amount =
      Number(order.tax_amount || 0)

  form.value.shipping_amount =
      Number(order.shipping_amount || 0)

  form.value.total_amount =
      Number(order.total_amount || 0)

  form.value.paid_amount = 0

  form.value.balance_amount =
      Number(order.total_amount || 0)
}

// ==========================================
// Customer Name
// ==========================================

const getCustomerName = (customer) => {
  if (!customer) {
    return '-'
  }

  if (customer.name) {
    return customer.name
  }

  const fullName = [
    customer.first_name,
    customer.last_name
  ]
      .filter(Boolean)
      .join(' ')

  return fullName || customer.company_name || customer.email || `Customer #${customer.id}`
}

// ==========================================
// Calculate Balance
// ==========================================

const calculateBalance = () => {
  const total = Number(form.value.total_amount || 0)
  const paid = Number(form.value.paid_amount || 0)

  form.value.balance_amount = Math.max(
      total - paid,
      0
  )
}

// ==========================================
// Calculate Total
// ==========================================

const calculateTotal = () => {
  const subtotal = Number(form.value.subtotal || 0)
  const discount = Number(form.value.discount_amount || 0)
  const tax = Number(form.value.tax_amount || 0)
  const shipping = Number(form.value.shipping_amount || 0)

  form.value.total_amount = Math.max(
      subtotal - discount + tax + shipping,
      0
  )

  calculateBalance()
}

// ==========================================
// Selected Order
// ==========================================

const selectedOrder = computed(() => {
  return orders.value.find(
      order => order.id == form.value.order_id
  )
})

// ==========================================
// Selected Customer
// ==========================================

const selectedCustomer = computed(() => {
  return customers.value.find(
      customer => customer.id == form.value.customer_id
  )
})

// ==========================================
// Submit
// ==========================================

const submitInvoice = async () => {
  error.value = ''
  success.value = ''

  // Validation

  if (!form.value.invoice_number.trim()) {
    error.value = 'Invoice number is required.'
    return
  }

  if (!form.value.order_id) {
    error.value = 'Please select an order.'
    return
  }

  if (!form.value.invoice_date) {
    error.value = 'Invoice date is required.'
    return
  }

  if (Number(form.value.total_amount) < 0) {
    error.value = 'Total amount cannot be negative.'
    return
  }

  if (Number(form.value.paid_amount) < 0) {
    error.value = 'Paid amount cannot be negative.'
    return
  }

  if (
      Number(form.value.paid_amount) >
      Number(form.value.total_amount)
  ) {
    error.value = 'Paid amount cannot be greater than the invoice total.'
    return
  }

  saving.value = true

  try {
    const payload = {
      invoice_number:
          form.value.invoice_number.trim(),

      order_id:
      form.value.order_id,

      customer_id:
          form.value.customer_id || null,

      invoice_date:
      form.value.invoice_date,

      due_date:
          form.value.due_date || null,

      status:
      form.value.status,

      subtotal:
          Number(form.value.subtotal || 0),

      discount_amount:
          Number(form.value.discount_amount || 0),

      tax_amount:
          Number(form.value.tax_amount || 0),

      shipping_amount:
          Number(form.value.shipping_amount || 0),

      total_amount:
          Number(form.value.total_amount || 0),

      paid_amount:
          Number(form.value.paid_amount || 0),

      balance_amount:
          Number(form.value.balance_amount || 0),

      notes:
          form.value.notes.trim() || null
    }

    await invoiceApi.createInvoice(payload)

    success.value =
        'Invoice created successfully.'

    setTimeout(() => {
      router.push(LIST_ROUTE)
    }, 700)

  } catch (err) {
    console.error('Create invoice error:', err)

    error.value =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to create invoice.'
  } finally {
    saving.value = false
  }
}

// ==========================================
// Navigation
// ==========================================

const goBack = () => {
  router.push(LIST_ROUTE)
}

// ==========================================
// Initial Load
// ==========================================

const loadData = async () => {
  loading.value = true
  error.value = ''

  try {
    await Promise.all([
      loadOrders(),
      loadCustomers()
    ])
  } catch (err) {
    console.error(
        'Failed to load invoice form data:',
        err
    )

    error.value =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to load required data.'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  generateInvoiceNumber()

  form.value.invoice_date =
      new Date().toISOString().slice(0, 10)

  loadData()
})
</script>

<template>
  <div class="invoice-form-page">

    <!-- Header -->

    <div class="form-header">
      <div>
        <h1>Create Invoice</h1>

        <p>
          Create an invoice for an order.
        </p>
      </div>

      <button
          type="button"
          class="btn-secondary"
          @click="goBack"
          :disabled="saving"
      >
        Back to Invoices
      </button>
    </div>

    <!-- Error -->

    <div
        v-if="error"
        class="error-message"
    >
      {{ error }}
    </div>

    <!-- Success -->

    <div
        v-if="success"
        class="success-message"
    >
      {{ success }}
    </div>

    <!-- Loading -->

    <div
        v-if="loading"
        class="loading-state"
    >
      Loading invoice data...
    </div>

    <!-- Form -->

    <form
        v-else
        class="invoice-form"
        @submit.prevent="submitInvoice"
    >

      <!-- Invoice Information -->

      <section class="form-section">

        <div class="section-header">
          <h2>Invoice Information</h2>

          <p>
            Enter the basic invoice details.
          </p>
        </div>

        <div class="form-grid">

          <!-- Invoice Number -->

          <div class="form-group">

            <label for="invoice_number">
              Invoice Number
              <span>*</span>
            </label>

            <div class="input-with-button">

              <input
                  id="invoice_number"
                  v-model="form.invoice_number"
                  type="text"
                  placeholder="e.g. INV-10001"
                  required
                  :disabled="saving"
              />

              <button
                  type="button"
                  class="generate-button"
                  @click="generateInvoiceNumber"
                  :disabled="saving"
              >
                Generate
              </button>

            </div>

            <small>
              Must be unique.
            </small>

          </div>

          <!-- Invoice Date -->

          <div class="form-group">

            <label for="invoice_date">
              Invoice Date
              <span>*</span>
            </label>

            <input
                id="invoice_date"
                v-model="form.invoice_date"
                type="date"
                required
                :disabled="saving"
            />

          </div>

          <!-- Order -->

          <div class="form-group">

            <label for="order_id">
              Order
              <span>*</span>
            </label>

            <select
                id="order_id"
                v-model="form.order_id"
                required
                :disabled="saving"
                @change="orderChanged"
            >

              <option value="">
                Select Order
              </option>

              <option
                  v-for="order in orders"
                  :key="order.id"
                  :value="order.id"
              >
                {{ order.order_number }}
                -
                Rs.
                {{
                  Number(
                      order.total_amount || 0
                  ).toLocaleString(
                      'en-LK',
                      {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      }
                  )
                }}
              </option>

            </select>

          </div>

          <!-- Customer -->

          <div class="form-group">

            <label for="customer_id">
              Customer
            </label>

            <select
                id="customer_id"
                v-model="form.customer_id"
                :disabled="saving"
            >

              <option value="">
                Select Customer
              </option>

              <option
                  v-for="customer in customers"
                  :key="customer.id"
                  :value="customer.id"
              >
                {{ getCustomerName(customer) }}
              </option>

            </select>

          </div>

          <!-- Due Date -->

          <div class="form-group">

            <label for="due_date">
              Due Date
            </label>

            <input
                id="due_date"
                v-model="form.due_date"
                type="date"
                :disabled="saving"
            />

          </div>

          <!-- Status -->

          <div class="form-group">

            <label for="status">
              Status
            </label>

            <select
                id="status"
                v-model="form.status"
                :disabled="saving"
            >

              <option value="draft">
                Draft
              </option>

              <option value="issued">
                Issued
              </option>

              <option value="partially_paid">
                Partially Paid
              </option>

              <option value="paid">
                Paid
              </option>

              <option value="overdue">
                Overdue
              </option>

              <option value="cancelled">
                Cancelled
              </option>

              <option value="refunded">
                Refunded
              </option>

            </select>

          </div>

        </div>

      </section>

      <!-- Amount Information -->

      <section class="form-section">

        <div class="section-header">
          <h2>Amount Information</h2>

          <p>
            Review and adjust the invoice amounts.
          </p>
        </div>

        <div class="form-grid">

          <!-- Subtotal -->

          <div class="form-group">

            <label for="subtotal">
              Subtotal
            </label>

            <input
                id="subtotal"
                v-model.number="form.subtotal"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                :disabled="saving"
                @input="calculateTotal"
            />

          </div>

          <!-- Discount -->

          <div class="form-group">

            <label for="discount_amount">
              Discount
            </label>

            <input
                id="discount_amount"
                v-model.number="form.discount_amount"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                :disabled="saving"
                @input="calculateTotal"
            />

          </div>

          <!-- Tax -->

          <div class="form-group">

            <label for="tax_amount">
              Tax
            </label>

            <input
                id="tax_amount"
                v-model.number="form.tax_amount"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                :disabled="saving"
                @input="calculateTotal"
            />

          </div>

          <!-- Shipping -->

          <div class="form-group">

            <label for="shipping_amount">
              Shipping
            </label>

            <input
                id="shipping_amount"
                v-model.number="form.shipping_amount"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                :disabled="saving"
                @input="calculateTotal"
            />

          </div>

          <!-- Total -->

          <div class="form-group">

            <label for="total_amount">
              Total Amount
            </label>

            <input
                id="total_amount"
                v-model.number="form.total_amount"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                :disabled="saving"
                @input="calculateBalance"
            />

          </div>

          <!-- Paid -->

          <div class="form-group">

            <label for="paid_amount">
              Paid Amount
            </label>

            <input
                id="paid_amount"
                v-model.number="form.paid_amount"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                :disabled="saving"
                @input="calculateBalance"
            />

          </div>

          <!-- Balance -->

          <div class="form-group">

            <label for="balance_amount">
              Balance Amount
            </label>

            <input
                id="balance_amount"
                :value="Number(form.balance_amount || 0).toFixed(2)"
                type="number"
                readonly
            />

          </div>

        </div>

      </section>

      <!-- Selected Order -->

      <section
          v-if="selectedOrder"
          class="form-section"
      >

        <div class="section-header">

          <h2>Selected Order</h2>

          <p>
            Review the selected order.
          </p>

        </div>

        <div class="order-summary">

          <div class="summary-row">

                        <span>
                            Order Number
                        </span>

            <strong>
              {{ selectedOrder.order_number }}
            </strong>

          </div>

          <div class="summary-row">

                        <span>
                            Order Date
                        </span>

            <strong>
              {{
                selectedOrder.order_date
                    ? new Date(
                        selectedOrder.order_date
                    ).toLocaleDateString('en-LK')
                    : '-'
              }}
            </strong>

          </div>

          <div class="summary-row">

                        <span>
                            Order Status
                        </span>

            <strong>
              {{
                selectedOrder.status
                    ? selectedOrder.status
                        .replaceAll('_', ' ')
                        .replace(
                            /\b\w/g,
                            char => char.toUpperCase()
                        )
                    : '-'
              }}
            </strong>

          </div>

          <div class="summary-row">

                        <span>
                            Order Total
                        </span>

            <strong>
              Rs.
              {{
                Number(
                    selectedOrder.total_amount || 0
                ).toLocaleString(
                    'en-LK',
                    {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    }
                )
              }}
            </strong>

          </div>

        </div>

      </section>

      <!-- Customer -->

      <section
          v-if="selectedCustomer"
          class="form-section"
      >

        <div class="section-header">

          <h2>Customer</h2>

          <p>
            Customer assigned to this invoice.
          </p>

        </div>

        <div class="customer-summary">

          <strong>
            {{ getCustomerName(selectedCustomer) }}
          </strong>

          <span v-if="selectedCustomer.email">
                        {{ selectedCustomer.email }}
                    </span>

          <span v-if="selectedCustomer.phone">
                        {{ selectedCustomer.phone }}
                    </span>

        </div>

      </section>

      <!-- Notes -->

      <section class="form-section">

        <div class="section-header">

          <h2>Notes</h2>

          <p>
            Add any additional information about this invoice.
          </p>

        </div>

        <div class="form-group">

          <label for="notes">
            Notes
          </label>

          <textarea
              id="notes"
              v-model="form.notes"
              rows="5"
              placeholder="Add invoice notes..."
              :disabled="saving"
          ></textarea>

        </div>

      </section>

      <!-- Actions -->

      <div class="form-actions">

        <button
            type="button"
            class="btn-secondary"
            @click="goBack"
            :disabled="saving"
        >
          Cancel
        </button>

        <button
            type="submit"
            class="btn-primary"
            :disabled="saving"
        >
          {{
            saving
                ? 'Creating Invoice...'
                : 'Create Invoice'
          }}
        </button>

      </div>

    </form>

  </div>
</template>

<style scoped>
.invoice-form-page {
  width: 100%;
  max-width: 1100px;
  margin: 0 auto;
  font-family: var(--font-family);
}

/* =========================
   Header
   ========================= */

.form-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-lg);
  margin-bottom: var(--spacing-2xl);
}

.form-header h1 {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
}

.form-header p {
  margin-top: 5px;
  font-size: var(--font-size-md);
  color: var(--color-text-secondary);
}

/* =========================
   Form / Sections
   ========================= */

.invoice-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xl);
}

.form-section {
  padding: var(--spacing-2xl);
  background: var(--color-surface);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.section-header {
  margin-bottom: var(--spacing-xl);
}

.section-header h2 {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
}

.section-header p {
  margin-top: 5px;
  font-size: var(--font-size-md);
  color: var(--color-text-secondary);
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--spacing-xl);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.form-group.full-width {
  grid-column: 1 / -1;
}

/* =========================
   Labels / Inputs
   ========================= */

.form-group label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

/* Required star */
.form-group label span {
  color: var(--color-danger);
}

.form-group input,
.form-group select {
  width: 100%;
  box-sizing: border-box;
  height: 40px;
  padding: 0 var(--spacing-lg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  color: var(--color-text-primary);
  font-family: inherit;
  font-size: var(--font-size-md);
  outline: none;
  transition: border-color var(--transition-fast),
  box-shadow var(--transition-fast);
}

.form-group select {
  cursor: pointer;
}

.form-group textarea {
  width: 100%;
  box-sizing: border-box;
  padding: var(--spacing-md) var(--spacing-lg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  color: var(--color-text-primary);
  font-family: inherit;
  font-size: var(--font-size-md);
  line-height: 1.5;
  resize: vertical;
  outline: none;
  transition: border-color var(--transition-fast),
  box-shadow var(--transition-fast);
}

.form-group input::placeholder,
.form-group textarea::placeholder {
  color: var(--color-text-muted);
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-light);
}

.form-group input[readonly] {
  background: var(--color-hover-bg);
  color: var(--color-text-secondary);
  cursor: default;
}

.form-group input:disabled,
.form-group select:disabled,
.form-group textarea:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.form-group small {
  font-size: var(--font-size-xs);
  line-height: 1.5;
  color: var(--color-text-muted);
}

/* =========================
   Input With Button
   ========================= */

.input-with-button {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.input-with-button input {
  flex: 1;
  min-width: 0;
}

.generate-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 40px;
  padding: 0 var(--spacing-lg);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  font-family: inherit;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  white-space: nowrap;
  cursor: pointer;
  transition: background var(--transition-fast),
  color var(--transition-fast),
  border-color var(--transition-fast);
}

.generate-button:hover:not(:disabled) {
  background: var(--color-primary-light);
  border-color: var(--color-primary-light);
  color: var(--color-primary);
}

.generate-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* =========================
   Order Summary
   ========================= */

.order-summary {
  overflow: hidden;
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  background: var(--color-hover-bg);
}

.summary-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-lg);
  padding: var(--spacing-md) var(--spacing-lg);
  border-bottom: 1px solid var(--color-border-light);
}

.summary-row:last-child {
  border-bottom: none;
}

.summary-row span {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.summary-row strong {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  text-align: right;
}

/* =========================
   Customer Summary
   ========================= */

.customer-summary {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  padding: var(--spacing-lg);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  background: var(--color-hover-bg);
}

.customer-summary strong {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.customer-summary span {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

/* =========================
   States
   ========================= */

.error-message,
.success-message {
  margin-bottom: var(--spacing-lg);
  padding: var(--spacing-md) var(--spacing-lg);
  border: 1px solid;
  border-radius: var(--radius-lg);
  font-size: var(--font-size-sm);
}

.error-message {
  border-color: var(--color-danger-light);
  background: var(--color-danger-bg);
  color: var(--color-danger);
}

.success-message {
  border-color: var(--color-success-light);
  background: var(--color-success-bg);
  color: var(--color-success);
}

.loading-state {
  padding: 50px var(--spacing-xl);
  text-align: center;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

/* =========================
   Actions / Buttons
   ========================= */

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-md);
}

.btn-primary,
.btn-secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 40px;
  padding: 0 var(--spacing-xl);
  border-radius: var(--radius-lg);
  font-family: inherit;
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  white-space: nowrap;
  cursor: pointer;
  transition: background var(--transition-fast),
  color var(--transition-fast),
  border-color var(--transition-fast);
}

.btn-primary {
  border: none;
  background: var(--color-primary);
  color: var(--color-text-light);
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.btn-secondary {
  border: 1px solid var(--color-border-light);
  background: var(--color-surface);
  color: var(--color-text-secondary);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--color-hover-bg);
  color: var(--color-text-primary);
}

.btn-primary:disabled,
.btn-secondary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* =========================
   Responsive
   ========================= */

@media (max-width: 768px) {
  .form-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }

  .form-group.full-width {
    grid-column: 1 / -1;
  }

  .form-section {
    padding: var(--spacing-xl);
  }

  .form-actions {
    flex-direction: column-reverse;
  }

  .btn-primary,
  .btn-secondary {
    width: 100%;
  }
}
</style>
