<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import deliveryApi from '@/api/deliveryApi'
import { hasPermission } from '@/auth/authorization.js'

const route = useRoute()
const router = useRouter()

const delivery = ref(null)
const loading = ref(true)
const saving = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const isEditMode = computed(() => route.name === 'delivery-edit')
const canEdit = computed(() => hasPermission('deliveries.update'))

const statuses = [
  'pending',
  'processing',
  'ready_for_dispatch',
  'dispatched',
  'in_transit',
  'out_for_delivery',
  'delivered',
  'failed',
  'cancelled',
  'returned'
]

const methods = [
  { value: 'standard', label: 'Standard' },
  { value: 'express', label: 'Express' },
  { value: 'pickup', label: 'Pickup' }
]

const form = reactive({
  delivery_method: '',
  delivery_status: '',
  recipient_name: '',
  recipient_phone: '',
  address_line_1: '',
  address_line_2: '',
  city: '',
  state: '',
  postal_code: '',
  country: '',
  delivery_charge: '',
  tracking_number: '',
  courier_name: '',
  expected_delivery_date: '',
  notes: ''
})

const history = computed(() => {
  const records = delivery.value?.statusHistory || []
  return [...records].sort((a, b) =>
    new Date(b.created_at || 0) - new Date(a.created_at || 0)
  )
})

const formatLabel = value => {
  if (!value) return '-'
  return String(value).replaceAll('_', ' ')
    .replace(/\b\w/g, char => char.toUpperCase())
}

const formatDate = value => {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleDateString('en-LK', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      })
}

const formatDateTime = value => {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleString('en-LK', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
}

const formatAmount = value => Number(value || 0).toLocaleString('en-LK', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})

const dateInputValue = value => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10)
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-')
}

const populateForm = record => {
  for (const key of Object.keys(form)) {
    if (key === 'expected_delivery_date') {
      form[key] = dateInputValue(record?.[key])
    } else {
      form[key] = record?.[key] ?? ''
    }
  }
}

const loadDelivery = async () => {
  loading.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const response = await deliveryApi.getDeliveryById(route.params.id)
    const record = response?.data?.data || response?.data

    if (!record?.id) {
      throw new Error('The delivery record could not be found.')
    }

    delivery.value = record
    populateForm(record)
  } catch (error) {
    console.error('Failed to load delivery:', error)
    errorMessage.value =
      error?.response?.data?.message ||
      error?.message ||
      'Failed to load delivery details.'
  } finally {
    loading.value = false
  }
}

const saveDelivery = async () => {
  errorMessage.value = ''
  successMessage.value = ''

  if (!canEdit.value) {
    errorMessage.value = 'You do not have permission to update deliveries.'
    return
  }

  if (!form.recipient_name.trim()) {
    errorMessage.value = 'Recipient name is required.'
    return
  }

  if (form.delivery_status === 'dispatched' &&
      (!form.tracking_number.trim() || !form.courier_name.trim())) {
    errorMessage.value = 'Courier name and tracking number are required for dispatch.'
    return
  }

  saving.value = true

  try {
    const payload = {
      delivery_method: form.delivery_method,
      delivery_status: form.delivery_status,
      recipient_name: form.recipient_name.trim(),
      recipient_phone: form.recipient_phone.trim(),
      address_line_1: form.address_line_1.trim(),
      address_line_2: form.address_line_2.trim(),
      city: form.city.trim(),
      state: form.state.trim(),
      postal_code: form.postal_code.trim(),
      country: form.country.trim(),
      delivery_charge: form.delivery_charge,
      tracking_number: form.tracking_number.trim(),
      courier_name: form.courier_name.trim(),
      expected_delivery_date: form.expected_delivery_date || null,
      notes: form.notes.trim()
    }

    const response = await deliveryApi.updateDelivery(
      delivery.value.id,
      payload
    )

    const updated = response?.data?.data || response?.data

    if (updated?.id) {
      delivery.value = { ...delivery.value, ...updated }
      populateForm(delivery.value)
    } else {
      await loadDelivery()
    }

    successMessage.value = response?.message || 'Delivery updated successfully.'
  } catch (error) {
    console.error('Failed to update delivery:', error)
    errorMessage.value =
      error?.response?.data?.message ||
      error?.message ||
      'Failed to update delivery.'
  } finally {
    saving.value = false
  }
}

const goBack = () => router.push('/admin/sales/deliveries')

const startEditing = () => {
  if (!canEdit.value) return
  router.push(`/admin/sales/deliveries/edit/${route.params.id}`)
}

watch(() => route.params.id, loadDelivery)

onMounted(loadDelivery)
</script>

<template>
  <div class="delivery-details-page">
    <div class="page-heading">
      <div>
        <button class="back-link" type="button" @click="goBack">
          ← Back to Deliveries
        </button>
        <h1>{{ isEditMode ? 'Edit Delivery' : 'Delivery Details' }}</h1>
        <p v-if="delivery">
          {{ delivery.delivery_reference }} · Delivery #{{ delivery.id }}
        </p>
      </div>

      <div class="heading-actions" v-if="delivery">
        <button
          v-if="!isEditMode && canEdit"
          class="primary-button"
          type="button"
          @click="startEditing"
        >
          Edit Delivery
        </button>
        <button
          v-if="isEditMode"
          class="secondary-button"
          type="button"
          @click="goBack"
        >
          Cancel
        </button>
      </div>
    </div>

    <div v-if="loading" class="state-card">Loading delivery details...</div>
    <div v-else-if="errorMessage && !delivery" class="alert error">
      {{ errorMessage }}
    </div>

    <template v-else-if="delivery">
      <div v-if="successMessage" class="alert success">{{ successMessage }}</div>
      <div v-if="errorMessage" class="alert error">{{ errorMessage }}</div>

      <section class="summary-grid">
        <div class="summary-card">
          <span>Delivery Status</span>
          <strong>{{ formatLabel(delivery.delivery_status) }}</strong>
        </div>
        <div class="summary-card">
          <span>Order Number</span>
          <strong>{{ delivery.order?.order_number || `Order #${delivery.order_id}` }}</strong>
        </div>
        <div class="summary-card">
          <span>Delivery Method</span>
          <strong>{{ formatLabel(delivery.delivery_method) }}</strong>
        </div>
        <div class="summary-card">
          <span>Delivery Charge</span>
          <strong>Rs. {{ formatAmount(delivery.delivery_charge) }}</strong>
        </div>
      </section>

      <form v-if="isEditMode" class="content-card" @submit.prevent="saveDelivery">
        <div class="section-heading">
          <div>
            <h2>Delivery Information</h2>
            <p>Update the recipient, delivery address, courier and status.</p>
          </div>
        </div>

        <div class="form-grid">
          <label>
            <span>Order</span>
            <input :value="delivery.order?.order_number || `Order #${delivery.order_id}`" disabled>
          </label>

          <label>
            <span>Delivery Method</span>
            <select v-model="form.delivery_method">
              <option value="">Select method</option>
              <option v-for="method in methods" :key="method.value" :value="method.value">
                {{ method.label }}
              </option>
            </select>
          </label>

          <label>
            <span>Delivery Status *</span>
            <select v-model="form.delivery_status" required>
              <option v-for="status in statuses" :key="status" :value="status">
                {{ formatLabel(status) }}
              </option>
            </select>
          </label>

          <label>
            <span>Recipient Name *</span>
            <input v-model="form.recipient_name" required>
          </label>

          <label>
            <span>Recipient Phone</span>
            <input v-model="form.recipient_phone">
          </label>

          <label>
            <span>Delivery Charge (Rs.)</span>
            <input v-model="form.delivery_charge" type="number" min="0" step="0.01">
          </label>

          <label class="full-width">
            <span>Address Line 1</span>
            <input v-model="form.address_line_1">
          </label>

          <label class="full-width">
            <span>Address Line 2</span>
            <input v-model="form.address_line_2">
          </label>

          <label>
            <span>City</span>
            <input v-model="form.city">
          </label>

          <label>
            <span>State / Province</span>
            <input v-model="form.state">
          </label>

          <label>
            <span>Postal Code</span>
            <input v-model="form.postal_code">
          </label>

          <label>
            <span>Country</span>
            <input v-model="form.country">
          </label>

          <label>
            <span>Courier Name</span>
            <input v-model="form.courier_name">
          </label>

          <label>
            <span>Tracking Number</span>
            <input v-model="form.tracking_number">
          </label>

          <label>
            <span>Expected Delivery Date</span>
            <input v-model="form.expected_delivery_date" type="date">
          </label>

          <label class="full-width">
            <span>Notes</span>
            <textarea v-model="form.notes" rows="4"></textarea>
          </label>
        </div>

        <div class="form-footer">
          <button class="secondary-button" type="button" @click="goBack">
            Cancel
          </button>
          <button class="primary-button" type="submit" :disabled="saving">
            {{ saving ? 'Saving...' : 'Save Changes' }}
          </button>
        </div>
      </form>

      <template v-else>
        <section class="content-card">
          <div class="section-heading">
            <div>
              <h2>Recipient & Delivery Address</h2>
              <p>Information provided for this delivery.</p>
            </div>
          </div>

          <div class="detail-grid">
            <div class="detail-item">
              <span>Recipient</span>
              <strong>{{ delivery.recipient_name || '-' }}</strong>
            </div>
            <div class="detail-item">
              <span>Phone</span>
              <strong>{{ delivery.recipient_phone || '-' }}</strong>
            </div>
            <div class="detail-item">
              <span>Address</span>
              <strong>
                {{
                  [
                    delivery.address_line_1,
                    delivery.address_line_2,
                    delivery.city,
                    delivery.state,
                    delivery.postal_code,
                    delivery.country
                  ].filter(Boolean).join(', ') || '-'
                }}
              </strong>
            </div>
          </div>
        </section>

        <section class="content-card">
          <div class="section-heading">
            <div>
              <h2>Courier & Tracking</h2>
              <p>Dispatch and expected delivery information.</p>
            </div>
          </div>

          <div class="detail-grid">
            <div class="detail-item">
              <span>Courier</span>
              <strong>{{ delivery.courier_name || 'Not assigned' }}</strong>
            </div>
            <div class="detail-item">
              <span>Tracking Number</span>
              <strong>{{ delivery.tracking_number || '-' }}</strong>
            </div>
            <div class="detail-item">
              <span>Expected Delivery</span>
              <strong>{{ formatDate(delivery.expected_delivery_date) }}</strong>
            </div>
            <div class="detail-item">
              <span>Dispatched At</span>
              <strong>{{ formatDateTime(delivery.dispatched_at) }}</strong>
            </div>
            <div class="detail-item">
              <span>Delivered At</span>
              <strong>{{ formatDateTime(delivery.delivered_at) }}</strong>
            </div>
            <div class="detail-item">
              <span>Notes</span>
              <strong>{{ delivery.notes || '-' }}</strong>
            </div>
          </div>
        </section>
      </template>

      <section class="content-card">
        <div class="section-heading">
          <div>
            <h2>Delivery Status History</h2>
            <p>Recorded status changes for this delivery.</p>
          </div>
          <span class="count-badge">{{ history.length }} records</span>
        </div>

        <div v-if="!history.length" class="empty-state">
          No delivery status history is available.
        </div>

        <div v-else class="history-list">
          <div v-for="record in history" :key="record.id" class="history-row">
            <div class="history-marker"></div>
            <div class="history-content">
              <strong>{{ formatLabel(record.status) }}</strong>
              <p v-if="record.notes">{{ record.notes }}</p>
              <span>{{ formatDateTime(record.created_at) }}</span>
            </div>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.delivery-details-page {
  width: 100%;
  max-width: 1500px;
  margin: 0 auto;
  color: var(--color-text-primary, #1e293b);
  font-family: var(--font-family, inherit);
}

.page-heading {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 20px;
  margin-bottom: 24px;
}

.page-heading h1 {
  margin: 12px 0 6px;
  font-size: 26px;
  font-weight: 700;
}

.page-heading p,
.section-heading p {
  margin: 0;
  color: #64748b;
  font-size: 13px;
}

.back-link {
  padding: 0;
  border: 0;
  background: none;
  color: #526783;
  cursor: pointer;
  font-size: 13px;
}

.heading-actions,
.form-footer {
  display: flex;
  align-items: center;
  gap: 10px;
}

.primary-button,
.secondary-button {
  min-height: 40px;
  padding: 0 16px;
  border-radius: 7px;
  font-weight: 600;
  cursor: pointer;
}

.primary-button {
  color: white;
  background: var(--color-primary, #315efb);
  border: 1px solid var(--color-primary, #315efb);
}

.primary-button:disabled {
  opacity: .6;
  cursor: not-allowed;
}

.secondary-button {
  color: #475569;
  background: white;
  border: 1px solid #dbe2ea;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 18px;
}

.summary-card,
.content-card,
.state-card {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 9px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, .04);
}

.summary-card {
  padding: 19px;
}

.summary-card span,
.detail-item span {
  display: block;
  margin-bottom: 8px;
  color: #64748b;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .035em;
}

.summary-card strong {
  font-size: 17px;
}

.content-card {
  margin-bottom: 18px;
  padding: 22px;
}

.section-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 22px;
}

.section-heading h2 {
  margin: 0 0 6px;
  font-size: 17px;
}

.count-badge {
  padding: 5px 10px;
  border-radius: 20px;
  background: #f1f5f9;
  color: #475569;
  font-size: 12px;
}

.detail-grid,
.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 22px 28px;
}

.detail-item strong {
  display: block;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.6;
  overflow-wrap: anywhere;
}

.form-grid label {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-grid label span {
  color: #475569;
  font-size: 12px;
  font-weight: 600;
}

.form-grid input,
.form-grid select,
.form-grid textarea {
  width: 100%;
  min-height: 41px;
  box-sizing: border-box;
  padding: 9px 11px;
  border: 1px solid #dbe2ea;
  border-radius: 6px;
  background: white;
  color: #1e293b;
  font: inherit;
  font-size: 13px;
}

.form-grid input:focus,
.form-grid select:focus,
.form-grid textarea:focus {
  outline: 2px solid rgba(49, 94, 251, .13);
  border-color: var(--color-primary, #315efb);
}

.form-grid input:disabled {
  background: #f8fafc;
  color: #64748b;
}

.full-width {
  grid-column: 1 / -1;
}

.form-footer {
  justify-content: flex-end;
  margin-top: 24px;
  padding-top: 18px;
  border-top: 1px solid #edf0f4;
}

.history-list {
  display: flex;
  flex-direction: column;
}

.history-row {
  display: flex;
  gap: 13px;
  padding: 0 0 20px;
}

.history-row:last-child {
  padding-bottom: 0;
}

.history-marker {
  flex: 0 0 10px;
  width: 10px;
  height: 10px;
  margin-top: 5px;
  border-radius: 50%;
  background: var(--color-primary, #315efb);
}

.history-content strong {
  font-size: 13px;
}

.history-content p {
  margin: 5px 0;
  color: #475569;
  font-size: 13px;
}

.history-content span {
  color: #94a3b8;
  font-size: 11px;
}

.empty-state,
.state-card {
  padding: 24px;
  color: #64748b;
  text-align: center;
  font-size: 13px;
}

.alert {
  margin-bottom: 16px;
  padding: 12px 15px;
  border-radius: 7px;
  font-size: 13px;
}

.alert.error {
  color: #b42318;
  background: #fef3f2;
  border: 1px solid #fecdca;
}

.alert.success {
  color: #067647;
  background: #ecfdf3;
  border: 1px solid #abefc6;
}

@media (max-width: 900px) {
  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 600px) {
  .page-heading {
    align-items: flex-start;
    flex-direction: column;
  }

  .summary-grid,
  .detail-grid,
  .form-grid {
    grid-template-columns: 1fr;
  }

  .full-width {
    grid-column: auto;
  }

  .content-card {
    padding: 16px;
  }
}
</style>
