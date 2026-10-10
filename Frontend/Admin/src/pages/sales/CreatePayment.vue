<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import paymentApi from '../../api/paymentApi'
import orderApi from '../../api/orderApi'

const router = useRouter()

const LIST_ROUTE = '/admin/sales/payments'

const saving = ref(false)
const loading = ref(false)

const error = ref('')
const success = ref('')

const orders = ref([])

// ==========================================
// Form
// ==========================================

const form = ref({
  payment_reference: '',
  order_id: '',
  payment_method: '',
  payment_status: 'unpaid',
  amount: 0,
  transaction_reference: '',
  payment_date: '',
  notes: ''
})

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
// Generate Payment Reference
// ==========================================

const generatePaymentReference = () => {
  const timestamp = Date.now()

  form.value.payment_reference =
      `PAY-${timestamp}`
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

  // If the order has a remaining balance,
  // use that as the suggested payment amount.
  const totalAmount = Number(
      order.total_amount || 0
  )

  form.value.amount = totalAmount
}

// ==========================================
// Submit
// ==========================================

const submitPayment = async () => {
  error.value = ''
  success.value = ''

  // Validation
  if (!form.value.payment_reference.trim()) {
    error.value = 'Payment reference is required.'
    return
  }

  if (!form.value.order_id) {
    error.value = 'Please select an order.'
    return
  }

  if (!form.value.payment_method) {
    error.value = 'Please select a payment method.'
    return
  }

  if (
      form.value.amount === '' ||
      form.value.amount === null ||
      Number(form.value.amount) <= 0
  ) {
    error.value = 'Payment amount must be greater than 0.'
    return
  }

  saving.value = true

  try {
    const payload = {
      payment_reference:
          form.value.payment_reference.trim(),

      order_id: form.value.order_id,

      payment_method:
      form.value.payment_method,

      payment_status:
      form.value.payment_status,

      amount:
          Number(form.value.amount),

      transaction_reference:
          form.value.transaction_reference.trim() ||
          null,

      payment_date:
          form.value.payment_date ||
          null,

      notes:
          form.value.notes.trim() ||
          null
    }

    await paymentApi.createPayment(payload)

    success.value = 'Payment created successfully.'

    setTimeout(() => {
      router.push(LIST_ROUTE)
    }, 700)

  } catch (err) {
    console.error('Create payment error:', err)

    error.value =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to create payment.'

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
    await loadOrders()
  } catch (err) {
    console.error('Failed to load payment form data:', err)

    error.value =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to load required data.'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  generatePaymentReference()
  loadData()
})
</script>

<template>
  <div class="payment-form-page">

    <!-- Header -->
    <div class="form-header">
      <div>
        <h1>Create Payment</h1>

        <p>
          Record a payment received for an order.
        </p>
      </div>

      <button
          type="button"
          class="btn-secondary"
          @click="goBack"
          :disabled="saving"
      >
        Back to Payments
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
      Loading orders...
    </div>

    <!-- Form -->
    <form
        v-else
        class="payment-form"
        @submit.prevent="submitPayment"
    >

      <!-- Payment Information -->
      <section class="form-section">

        <div class="section-header">
          <h2>Payment Information</h2>

          <p>
            Enter the details of the payment.
          </p>
        </div>

        <div class="form-grid">

          <!-- Payment Reference -->
          <div class="form-group">

            <label for="payment_reference">
              Payment Reference
              <span>*</span>
            </label>

            <div class="input-with-button">

              <input
                  id="payment_reference"
                  v-model="form.payment_reference"
                  type="text"
                  placeholder="e.g. PAY-10001"
                  required
                  :disabled="saving"
              />

              <button
                  type="button"
                  class="generate-button"
                  @click="generatePaymentReference"
                  :disabled="saving"
              >
                Generate
              </button>

            </div>

            <small>
              Must be unique.
            </small>

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

          <!-- Payment Method -->
          <div class="form-group">

            <label for="payment_method">
              Payment Method
              <span>*</span>
            </label>

            <select
                id="payment_method"
                v-model="form.payment_method"
                required
                :disabled="saving"
            >
              <option value="">
                Select Payment Method
              </option>

              <option value="cash">
                Cash
              </option>

              <option value="card">
                Card
              </option>

              <option value="bank_transfer">
                Bank Transfer
              </option>

              <option value="online">
                Online
              </option>

              <option value="wallet">
                Wallet
              </option>

              <option value="cheque">
                Cheque
              </option>

              <option value="other">
                Other
              </option>
            </select>

          </div>

          <!-- Payment Status -->
          <div class="form-group">

            <label for="payment_status">
              Payment Status
              <span>*</span>
            </label>

            <select
                id="payment_status"
                v-model="form.payment_status"
                required
                :disabled="saving"
            >
              <option value="unpaid">
                Unpaid
              </option>

              <option value="partially_paid">
                Partially Paid
              </option>

              <option value="paid">
                Paid
              </option>

              <option value="refunded">
                Refunded
              </option>

              <option value="partially_refunded">
                Partially Refunded
              </option>
            </select>

          </div>

          <!-- Amount -->
          <div class="form-group">

            <label for="amount">
              Amount
              <span>*</span>
            </label>

            <input
                id="amount"
                v-model.number="form.amount"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                required
                :disabled="saving"
            />

          </div>

          <!-- Payment Date -->
          <div class="form-group">

            <label for="payment_date">
              Payment Date
            </label>

            <input
                id="payment_date"
                v-model="form.payment_date"
                type="datetime-local"
                :disabled="saving"
            />

          </div>

          <!-- Transaction Reference -->
          <div class="form-group full-width">

            <label for="transaction_reference">
              Transaction Reference
            </label>

            <input
                id="transaction_reference"
                v-model="form.transaction_reference"
                type="text"
                placeholder="Bank/card/online transaction reference"
                :disabled="saving"
            />

          </div>

        </div>

      </section>

      <!-- Selected Order -->
      <section
          v-if="form.order_id"
          class="form-section"
      >

        <div class="section-header">
          <h2>Selected Order</h2>

          <p>
            Review the order before recording the payment.
          </p>
        </div>

        <div
            v-for="order in orders.filter(
                        order => order.id == form.order_id
                    )"
            :key="order.id"
            class="order-summary"
        >

          <div class="summary-row">
            <span>Order Number</span>

            <strong>
              {{ order.order_number }}
            </strong>
          </div>

          <div class="summary-row">
            <span>Order Date</span>

            <strong>
              {{
                order.order_date
                    ? new Date(
                        order.order_date
                    ).toLocaleDateString('en-LK')
                    : '-'
              }}
            </strong>
          </div>

          <div class="summary-row">
            <span>Order Status</span>

            <strong>
              {{
                order.status
                    ? order.status
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
            <span>Order Total</span>

            <strong>
              Rs.
              {{
                Number(
                    order.total_amount || 0
                ).toLocaleString('en-LK', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })
              }}
            </strong>
          </div>

        </div>

      </section>

      <!-- Notes -->
      <section class="form-section">

        <div class="section-header">
          <h2>Notes</h2>

          <p>
            Add any additional information about this payment.
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
              placeholder="Add payment notes..."
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
                ? 'Creating Payment...'
                : 'Create Payment'
          }}
        </button>

      </div>

    </form>

  </div>
</template>

<style scoped>
.payment-form-page {
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

.payment-form {
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
