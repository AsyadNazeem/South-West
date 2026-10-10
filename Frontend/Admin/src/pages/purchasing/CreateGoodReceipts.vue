<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  getGoodsReceiptById,
  createGoodsReceipt,
  updateGoodsReceipt
} from '../../api/goodsReceiptApi.js'
import { getPurchaseOrders } from '../../api/purchaseOrderApi.js'
import { getInventoryLocations } from '../../api/inventoryLocationApi.js'
import { hasPermission } from '../../auth/authorization.js'

const route = useRoute()
const router = useRouter()

// List page of the goods receipts section in your router
const LIST_ROUTE = '/admin/purchasing/goods-receipts'

const loading = ref(false)
const saving = ref(false)
const error = ref('')
const success = ref('')

const purchaseOrders = ref([])
const locations = ref([])

const form = ref({
  receipt_number: '',
  purchase_order_id: '',
  location_id: '',
  receipt_date: '',
  supplier_delivery_note: '',
  status: 'draft',
  notes: ''
})

const receiptId = computed(() => route.params.id || null)
const isEdit = computed(() => Boolean(receiptId.value))

const pageTitle = computed(() =>
    isEdit.value ? 'Edit Goods Receipt' : 'Create Goods Receipt'
)

const submitText = computed(() =>
    saving.value
        ? 'Saving...'
        : isEdit.value
            ? 'Update Goods Receipt'
            : 'Create Goods Receipt'
)

const canCreate = computed(() => hasPermission('products.create'))
const canUpdate = computed(() => hasPermission('products.update'))

const canSubmit = computed(() =>
    isEdit.value ? canUpdate.value : canCreate.value
)

const loadPurchaseOrders = async () => {
  try {
    const response = await getPurchaseOrders({
      status: 'approved'
    })

    purchaseOrders.value = response?.data?.data || response?.data || []
  } catch (err) {
    console.error('Failed to load purchase orders:', err)
  }
}

const loadLocations = async () => {
  try {
    const response = await getInventoryLocations({
      is_active: true
    })

    locations.value = response?.data?.data || response?.data || []
  } catch (err) {
    console.error('Failed to load locations:', err)
  }
}

const loadGoodsReceipt = async () => {
  if (!receiptId.value) return

  loading.value = true
  error.value = ''

  try {
    const response = await getGoodsReceiptById(receiptId.value)

    const receipt =
        response?.data?.data ||
        response?.data

    if (!receipt) {
      throw new Error('Goods receipt not found')
    }

    form.value = {
      receipt_number: receipt.receipt_number || '',
      purchase_order_id: receipt.purchase_order_id || '',
      location_id: receipt.location_id || '',
      receipt_date: receipt.receipt_date || '',
      supplier_delivery_note:
          receipt.supplier_delivery_note || '',
      status: receipt.status || 'draft',
      notes: receipt.notes || ''
    }
  } catch (err) {
    console.error('Failed to load goods receipt:', err)

    error.value =
        err?.response?.data?.message ||
        err.message ||
        'Failed to load goods receipt'
  } finally {
    loading.value = false
  }
}

const submitForm = async () => {
  error.value = ''
  success.value = ''

  if (!canSubmit.value) {
    error.value = 'You do not have permission to perform this action.'
    return
  }

  if (!form.value.purchase_order_id) {
    error.value = 'Purchase order is required.'
    return
  }

  if (!form.value.location_id) {
    error.value = 'Inventory location is required.'
    return
  }

  if (!form.value.receipt_date) {
    error.value = 'Receipt date is required.'
    return
  }

  saving.value = true

  try {
    const payload = {
      receipt_number: form.value.receipt_number || undefined,
      purchase_order_id: Number(form.value.purchase_order_id),
      location_id: Number(form.value.location_id),
      receipt_date: form.value.receipt_date,
      supplier_delivery_note: form.value.supplier_delivery_note || null,
      status: form.value.status,
      notes: form.value.notes || null
    }

    if (isEdit.value) {
      await updateGoodsReceipt(receiptId.value, payload)

      success.value = 'Goods receipt updated successfully.'
    } else {
      const response = await createGoodsReceipt(payload)

      success.value = 'Goods receipt created successfully.'

      const created =
          response?.data?.data ||
          response?.data

      const createdId =
          created?.id ||
          created?.goodsReceipt?.id

      if (createdId) {
        setTimeout(() => {
          router.push(`${LIST_ROUTE}/${createdId}`)
        }, 700)

        return
      }
    }

    setTimeout(() => {
      router.push(LIST_ROUTE)
    }, 700)
  } catch (err) {
    console.error('Save goods receipt error:', err)

    error.value =
        err?.response?.data?.message ||
        err.message ||
        'Failed to save goods receipt'
  } finally {
    saving.value = false
  }
}

const goBack = () => {
  router.push(LIST_ROUTE)
}

onMounted(async () => {
  await Promise.all([
    loadPurchaseOrders(),
    loadLocations(),
    loadGoodsReceipt()
  ])
})
</script>

<template>
  <div class="receipt-form-page">

    <!-- Header -->
    <div class="form-header">
      <div>
        <h1>{{ pageTitle }}</h1>

        <p>
          {{
            isEdit
                ? 'Update the goods receipt information.'
                : 'Create a new goods receipt from a purchase order.'
          }}
        </p>
      </div>

      <button
          type="button"
          class="btn-secondary"
          @click="goBack"
          :disabled="saving"
      >
        Cancel
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
        class="loading-message"
    >
      Loading goods receipt...
    </div>

    <!-- Form -->
    <form
        v-else
        class="receipt-form"
        @submit.prevent="submitForm"
    >

      <!-- Receipt Information -->
      <section class="form-section">

        <div class="section-header">
          <h2>Receipt Information</h2>

          <p>
            Enter the basic goods receipt details.
          </p>
        </div>

        <div class="form-grid">

          <!-- Receipt Number -->
          <div class="form-group">

            <label for="receipt_number">
              Receipt Number
            </label>

            <input
                id="receipt_number"
                v-model="form.receipt_number"
                type="text"
                placeholder="Auto generated if left empty"
                :disabled="saving"
            />

            <small>
              Leave empty if the system generates the receipt number.
            </small>

          </div>

          <!-- Receipt Date -->
          <div class="form-group">

            <label for="receipt_date">
              Receipt Date
              <span>*</span>
            </label>

            <input
                id="receipt_date"
                v-model="form.receipt_date"
                type="date"
                required
                :disabled="saving"
            />

          </div>

          <!-- Purchase Order -->
          <div class="form-group">

            <label for="purchase_order_id">
              Purchase Order
              <span>*</span>
            </label>

            <select
                id="purchase_order_id"
                v-model="form.purchase_order_id"
                required
                :disabled="saving"
            >
              <option value="" disabled>
                Select purchase order
              </option>

              <option
                  v-for="po in purchaseOrders"
                  :key="po.id"
                  :value="po.id"
              >
                {{ po.po_number || po.order_number || `PO-${po.id}` }}
              </option>
            </select>

          </div>

          <!-- Location -->
          <div class="form-group">

            <label for="location_id">
              Receiving Location
              <span>*</span>
            </label>

            <select
                id="location_id"
                v-model="form.location_id"
                required
                :disabled="saving"
            >
              <option value="" disabled>
                Select inventory location
              </option>

              <option
                  v-for="location in locations"
                  :key="location.id"
                  :value="location.id"
              >
                {{ location.code }} - {{ location.name }}
              </option>
            </select>

          </div>

          <!-- Supplier Delivery Note -->
          <div class="form-group">

            <label for="supplier_delivery_note">
              Supplier Delivery Note
            </label>

            <input
                id="supplier_delivery_note"
                v-model="form.supplier_delivery_note"
                type="text"
                placeholder="Enter supplier delivery note"
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

              <option value="received">
                Received
              </option>

              <option value="cancelled">
                Cancelled
              </option>
            </select>

            <small>
              Normally a new receipt should remain as Draft until it is received.
            </small>

          </div>

        </div>

      </section>

      <!-- Notes -->
      <section class="form-section">

        <div class="section-header">
          <h2>Notes</h2>

          <p>
            Add any additional information about this receipt.
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
              placeholder="Enter notes..."
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
            v-if="canSubmit"
            type="submit"
            class="btn-primary"
            :disabled="saving"
        >
          {{ submitText }}
        </button>

      </div>

    </form>

  </div>
</template>

<style scoped>
.receipt-form-page {
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

.receipt-form {
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

/* =========================
   Labels / Inputs
   ========================= */

.form-group label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

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

.loading-message {
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
