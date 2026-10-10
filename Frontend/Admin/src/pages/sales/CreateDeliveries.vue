<template>
  <div class="page-container">

    <!-- Header -->
    <div class="page-header">
      <div>
        <h1>Create Delivery</h1>
        <p>Create a new delivery for an order.</p>
      </div>

      <button class="back-button" @click="goBack">
        ← Back to Deliveries
      </button>
    </div>

    <!-- Form -->
    <form class="form-card" @submit.prevent="submitDelivery">

      <!-- Delivery Information -->
      <div class="section">
        <h2>Delivery Information</h2>

        <div class="form-grid">

          <div class="form-group">
            <label>Delivery Reference <span>*</span></label>
            <input
                v-model="form.delivery_reference"
                type="text"
                placeholder="DEL-0001"
                required
            />
          </div>

          <div class="form-group">
            <label>Order <span>*</span></label>

            <select
                v-model="form.order_id"
                required
            >
              <option value="">Select Order</option>

              <option
                  v-for="order in orders"
                  :key="order.id"
                  :value="order.id"
              >
                {{ getOrderNumber(order) }}
              </option>
            </select>
          </div>

          <div class="form-group">
            <label>Delivery Method <span>*</span></label>

            <select
                v-model="form.delivery_method"
                required
            >
              <option value="standard">Standard</option>
              <option value="express">Express</option>
              <option value="pickup">Pickup</option>
              <option value="courier">Courier</option>
            </select>
          </div>

          <div class="form-group">
            <label>Delivery Status <span>*</span></label>

            <select
                v-model="form.delivery_status"
                required
            >
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="ready_for_dispatch">
                Ready for Dispatch
              </option>
              <option value="dispatched">Dispatched</option>
              <option value="in_transit">In Transit</option>
              <option value="out_for_delivery">
                Out for Delivery
              </option>
              <option value="delivered">Delivered</option>
              <option value="failed">Failed</option>
              <option value="cancelled">Cancelled</option>
              <option value="returned">Returned</option>
            </select>
          </div>

          <div class="form-group">
            <label>Delivery Charge</label>

            <input
                v-model.number="form.delivery_charge"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
            />
          </div>

        </div>
      </div>

      <!-- Recipient Information -->
      <div class="section">
        <h2>Recipient Information</h2>

        <div class="form-grid">

          <div class="form-group">
            <label>Recipient Name <span>*</span></label>

            <input
                v-model="form.recipient_name"
                type="text"
                placeholder="Enter recipient name"
                required
            />
          </div>

          <div class="form-group">
            <label>Recipient Phone</label>

            <input
                v-model="form.recipient_phone"
                type="text"
                placeholder="Enter phone number"
            />
          </div>

        </div>
      </div>

      <!-- Delivery Address -->
      <div class="section">
        <h2>Delivery Address</h2>

        <div class="form-grid">

          <div class="form-group full-width">
            <label>Address Line 1 <span>*</span></label>

            <input
                v-model="form.address_line_1"
                type="text"
                placeholder="House / Building / Street"
                required
            />
          </div>

          <div class="form-group full-width">
            <label>Address Line 2</label>

            <input
                v-model="form.address_line_2"
                type="text"
                placeholder="Apartment, unit, landmark, etc."
            />
          </div>

          <div class="form-group">
            <label>City <span>*</span></label>

            <input
                v-model="form.city"
                type="text"
                placeholder="Enter city"
                required
            />
          </div>

          <div class="form-group">
            <label>State / Province</label>

            <input
                v-model="form.state"
                type="text"
                placeholder="Enter state or province"
            />
          </div>

          <div class="form-group">
            <label>Postal Code</label>

            <input
                v-model="form.postal_code"
                type="text"
                placeholder="Enter postal code"
            />
          </div>

          <div class="form-group">
            <label>Country <span>*</span></label>

            <input
                v-model="form.country"
                type="text"
                placeholder="Enter country"
                required
            />
          </div>

        </div>
      </div>

      <!-- Courier Information -->
      <div class="section">
        <h2>Courier & Tracking</h2>

        <div class="form-grid">

          <div class="form-group">
            <label>Tracking Number</label>

            <input
                v-model="form.tracking_number"
                type="text"
                placeholder="Enter tracking number"
            />
          </div>

          <div class="form-group">
            <label>Courier Name</label>

            <input
                v-model="form.courier_name"
                type="text"
                placeholder="Enter courier name"
            />
          </div>

          <div class="form-group">
            <label>Expected Delivery Date</label>

            <input
                v-model="form.expected_delivery_date"
                type="date"
            />
          </div>

          <div class="form-group">
            <label>Dispatched Date</label>

            <input
                v-model="form.dispatched_at"
                type="date"
            />
          </div>

          <div class="form-group">
            <label>Delivered Date</label>

            <input
                v-model="form.delivered_at"
                type="date"
            />
          </div>

        </div>
      </div>

      <!-- Notes -->
      <div class="section">
        <h2>Notes</h2>

        <div class="form-group">
          <label>Delivery Notes</label>

          <textarea
              v-model="form.notes"
              rows="4"
              placeholder="Enter any delivery notes..."
          ></textarea>
        </div>
      </div>

      <!-- Error -->
      <div
          v-if="errorMessage"
          class="error-message"
      >
        {{ errorMessage }}
      </div>

      <!-- Actions -->
      <div class="form-actions">

        <button
            type="button"
            class="cancel-button"
            @click="goBack"
            :disabled="loading"
        >
          Cancel
        </button>

        <button
            type="submit"
            class="save-button"
            :disabled="loading"
        >
          {{ loading ? 'Creating...' : 'Create Delivery' }}
        </button>

      </div>

    </form>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

import deliveryApi from '../../api/deliveryApi'
import orderApi from '../../api/orderApi'

const router = useRouter()

const loading = ref(false)
const errorMessage = ref('')
const orders = ref([])

const form = ref({
  delivery_reference: '',
  order_id: '',
  delivery_method: 'standard',
  delivery_status: 'pending',

  recipient_name: '',
  recipient_phone: '',

  address_line_1: '',
  address_line_2: '',
  city: '',
  state: '',
  postal_code: '',
  country: 'Sri Lanka',

  delivery_charge: 0,

  tracking_number: '',
  courier_name: '',

  expected_delivery_date: '',
  dispatched_at: '',
  delivered_at: '',

  notes: ''
})

const loadOrders = async () => {
  try {
    const response = await orderApi.getOrders()

    orders.value = response?.data || response || []
  } catch (error) {
    console.error('Failed to load orders:', error)
    errorMessage.value = 'Failed to load orders.'
  }
}

const getOrderNumber = (order) => {
  return order.order_number || `Order #${order.id}`
}

const submitDelivery = async () => {
  errorMessage.value = ''
  loading.value = true

  try {
    const payload = {
      delivery_reference: form.value.delivery_reference,
      order_id: form.value.order_id,
      delivery_method: form.value.delivery_method,
      delivery_status: form.value.delivery_status,

      recipient_name: form.value.recipient_name,
      recipient_phone: form.value.recipient_phone,

      address_line_1: form.value.address_line_1,
      address_line_2: form.value.address_line_2,
      city: form.value.city,
      state: form.value.state,
      postal_code: form.value.postal_code,
      country: form.value.country,

      delivery_charge: form.value.delivery_charge || 0,

      tracking_number: form.value.tracking_number,
      courier_name: form.value.courier_name,

      expected_delivery_date:
          form.value.expected_delivery_date || null,

      dispatched_at:
          form.value.dispatched_at || null,

      delivered_at:
          form.value.delivered_at || null,

      notes: form.value.notes
    }

    await deliveryApi.createDelivery(payload)

    router.push('/admin/sales/deliveries')

  } catch (error) {
    console.error('Failed to create delivery:', error)

    errorMessage.value =
        error?.response?.data?.message ||
        'Failed to create delivery. Please try again.'
  } finally {
    loading.value = false
  }
}

const goBack = () => {
  router.push('/admin/sales/deliveries')
}

onMounted(() => {
  loadOrders()
})
</script>

<style scoped>
.page-container {
  width: 100%;
  max-width: 1100px;
  margin: 0 auto;
  font-family: var(--font-family);
}

/* =========================
   Header
   ========================= */

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-lg);
  margin-bottom: var(--spacing-2xl);
}

.page-header h1 {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
}

.page-header p {
  margin-top: 5px;
  font-size: var(--font-size-md);
  color: var(--color-text-secondary);
}

.back-button,
.cancel-button,
.save-button {
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

.back-button,
.cancel-button {
  border: 1px solid var(--color-border-light);
  background: var(--color-surface);
  color: var(--color-text-secondary);
}

.back-button:hover:not(:disabled),
.cancel-button:hover:not(:disabled) {
  background: var(--color-hover-bg);
  color: var(--color-text-primary);
}

.save-button {
  border: none;
  background: var(--color-primary);
  color: var(--color-text-light);
}

.save-button:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.cancel-button:disabled,
.save-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* =========================
   Form Card / Sections
   ========================= */

.form-card {
  padding: var(--spacing-2xl);
  background: var(--color-surface);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.section {
  padding-bottom: var(--spacing-2xl);
  margin-bottom: var(--spacing-2xl);
  border-bottom: 1px solid var(--color-border-light);
}

.section:last-of-type {
  padding-bottom: 0;
  margin-bottom: 0;
  border-bottom: none;
}

.section h2 {
  margin-bottom: var(--spacing-xl);
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
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

.full-width {
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
  margin-left: 2px;
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

/* =========================
   States
   ========================= */

.error-message {
  margin-top: var(--spacing-xl);
  padding: var(--spacing-md) var(--spacing-lg);
  border: 1px solid var(--color-danger-light);
  border-radius: var(--radius-lg);
  background: var(--color-danger-bg);
  color: var(--color-danger);
  font-size: var(--font-size-sm);
}

/* =========================
   Actions
   ========================= */

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-md);
  margin-top: var(--spacing-2xl);
  padding-top: var(--spacing-xl);
  border-top: 1px solid var(--color-border-light);
}

/* =========================
   Responsive
   ========================= */

@media (max-width: 768px) {
  .page-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .form-card {
    padding: var(--spacing-xl);
  }

  .form-grid {
    grid-template-columns: 1fr;
  }

  .full-width {
    grid-column: 1 / -1;
  }

  .form-actions {
    flex-direction: column-reverse;
  }

  .back-button,
  .cancel-button,
  .save-button {
    width: 100%;
  }
}
</style>
