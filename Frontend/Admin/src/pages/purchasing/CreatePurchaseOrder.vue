<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import {
  getPurchaseOrderById,
  createPurchaseOrder,
  updatePurchaseOrder
} from '../../api/purchaseOrderApi.js'
import supplierApi from '../../api/supplierApi.js'
import itemApi from '../../api/itemApi.js'
import { hasPermission } from '../../auth/authorization.js'

const route = useRoute()
const router = useRouter()

// List page of the purchase orders section in your router
const LIST_ROUTE = '/admin/purchasing/purchase-order'

const loading = ref(false)
const saving = ref(false)
const error = ref('')
const success = ref('')

const suppliers = ref([])
const items = ref([])

// Local date (toISOString would give yesterday's date early in the morning in UTC+5:30)
function getToday() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')

  return `${now.getFullYear()}-${month}-${day}`
}

const form = ref({
  purchase_order_number: '',
  supplier_id: '',
  order_date: getToday(),
  expected_date: '',
  status: 'draft',

  discount_amount: 0,
  tax_amount: 0,
  shipping_amount: 0,

  notes: '',

  items: []
})

const isEdit = computed(() => Boolean(route.params.id))

const pageTitle = computed(() =>
    isEdit.value ? 'Edit Purchase Order' : 'Create Purchase Order'
)

const submitText = computed(() =>
    saving.value
        ? 'Saving...'
        : isEdit.value
            ? 'Update Purchase Order'
            : 'Create Purchase Order'
)

// Change these to match the permission names in your database
const canSubmit = computed(() =>
    isEdit.value
        ? hasPermission('purchase_orders.update')
        : hasPermission('purchase_orders.create')
)

const lineTotal = (row) => {
  const quantity = Number(row.quantity_ordered || 0)
  const unitCost = Number(row.unit_cost || 0)
  const discount = Number(row.discount_amount || 0)
  const tax = Number(row.tax_amount || 0)

  return quantity * unitCost - discount + tax
}

const subtotal = computed(() =>
    form.value.items.reduce((total, row) => total + lineTotal(row), 0)
)

const totalAmount = computed(() =>
    subtotal.value -
    Number(form.value.discount_amount || 0) +
    Number(form.value.tax_amount || 0) +
    Number(form.value.shipping_amount || 0)
)

const addItem = () => {
  form.value.items.push({
    tempId: Date.now() + Math.random(),
    item_id: '',
    quantity_ordered: 1,
    unit_cost: 0,
    discount_amount: 0,
    tax_amount: 0,
    notes: ''
  })
}

const removeItem = (index) => {
  if (form.value.items.length === 1) return

  form.value.items.splice(index, 1)
}

// Use the item's purchase cost when the item API provides one
const itemChanged = (row) => {
  const selectedItem = items.value.find(
      item => Number(item.id) === Number(row.item_id)
  )

  if (selectedItem && selectedItem.purchase_cost !== undefined) {
    row.unit_cost = Number(selectedItem.purchase_cost || 0)
  }
}

const loadSuppliers = async () => {
  try {
    // supplierApi already returns response.data, so the list is at .data
    const response = await supplierApi.getSuppliers()

    suppliers.value = response?.data || []
  } catch (err) {
    console.error('Failed to load suppliers:', err)

    error.value =
        err.response?.data?.message ||
        'Failed to load suppliers.'
  }
}

const loadItems = async () => {
  try {
    // itemApi already returns response.data, so the list is at .data
    const response = await itemApi.getItems()

    items.value = response?.data || []
  } catch (err) {
    console.error('Failed to load items:', err)

    error.value =
        err.response?.data?.message ||
        'Failed to load items.'
  }
}

const loadPurchaseOrder = async () => {
  if (!isEdit.value) {
    addItem()
    return
  }

  loading.value = true

  try {
    const response = await getPurchaseOrderById(route.params.id)

    const order = response?.data?.data

    if (!order) {
      throw new Error('Purchase order not found')
    }

    form.value = {
      purchase_order_number: order.purchase_order_number,
      supplier_id: order.supplier_id,

      order_date:
          order.order_date?.split('T')[0] ||
          order.order_date,

      expected_date: order.expected_date
          ? order.expected_date.split('T')[0]
          : '',

      status: order.status,

      discount_amount: Number(order.discount_amount || 0),
      tax_amount: Number(order.tax_amount || 0),
      shipping_amount: Number(order.shipping_amount || 0),

      notes: order.notes || '',

      items: (order.items || []).map(item => ({
        tempId: Date.now() + Math.random(),
        id: item.id,
        item_id: item.item_id,
        quantity_ordered: Number(item.quantity_ordered || 0),
        unit_cost: Number(item.unit_cost || 0),
        discount_amount: Number(item.discount_amount || 0),
        tax_amount: Number(item.tax_amount || 0),
        notes: item.notes || ''
      }))
    }

    if (!form.value.items.length) {
      addItem()
    }
  } catch (err) {
    console.error('Failed to load purchase order:', err)

    error.value =
        err.response?.data?.message ||
        err.message ||
        'Failed to load purchase order.'
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

  if (form.value.items.length === 0) {
    error.value = 'Please add at least one item.'
    return
  }

  if (form.value.items.some(row => !row.item_id)) {
    error.value = 'Please select an item for every line.'
    return
  }

  if (form.value.items.some(row => Number(row.quantity_ordered) <= 0)) {
    error.value = 'Quantities must be greater than 0.'
    return
  }

  saving.value = true

  try {
    const payload = {
      purchase_order_number: form.value.purchase_order_number,
      supplier_id: Number(form.value.supplier_id),
      order_date: form.value.order_date,
      expected_date: form.value.expected_date || null,
      status: form.value.status,

      discount_amount: Number(form.value.discount_amount || 0),
      tax_amount: Number(form.value.tax_amount || 0),
      shipping_amount: Number(form.value.shipping_amount || 0),

      notes: form.value.notes || null,

      items: form.value.items.map(row => ({
        item_id: Number(row.item_id),
        quantity_ordered: Number(row.quantity_ordered),
        unit_cost: Number(row.unit_cost),
        discount_amount: Number(row.discount_amount || 0),
        tax_amount: Number(row.tax_amount || 0),
        notes: row.notes || null
      }))
    }

    if (isEdit.value) {
      await updatePurchaseOrder(route.params.id, payload)

      success.value = 'Purchase order updated successfully.'
    } else {
      await createPurchaseOrder(payload)

      success.value = 'Purchase order created successfully.'
    }

    setTimeout(() => {
      router.push(LIST_ROUTE)
    }, 700)
  } catch (err) {
    console.error('Save purchase order error:', err)

    error.value =
        err.response?.data?.message ||
        err.message ||
        'Failed to save purchase order.'
  } finally {
    saving.value = false
  }
}

const goBack = () => {
  router.push(LIST_ROUTE)
}

const formatCurrency = (value) => {
  return Number(value || 0).toLocaleString('en-LK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

onMounted(async () => {
  await Promise.all([
    loadSuppliers(),
    loadItems()
  ])

  await loadPurchaseOrder()
})
</script>

<template>
  <div class="po-form-page">

    <!-- Header -->
    <div class="form-header">
      <div>
        <h1>{{ pageTitle }}</h1>

        <p>
          {{
            isEdit
                ? 'Update the purchase order details.'
                : 'Create a new purchase order for a supplier.'
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
      Loading purchase order...
    </div>

    <!-- Form -->
    <form
        v-else
        class="po-form"
        @submit.prevent="submitForm"
    >

      <!-- Purchase Order Information -->
      <section class="form-section">

        <div class="section-header">
          <h2>Purchase Order Information</h2>

          <p>
            Enter the purchase order number, supplier and dates.
          </p>
        </div>

        <div class="form-grid">

          <!-- PO Number -->
          <div class="form-group">

            <label for="purchase_order_number">
              PO Number
              <span>*</span>
            </label>

            <input
                id="purchase_order_number"
                v-model="form.purchase_order_number"
                type="text"
                placeholder="PO-0001"
                required
                :disabled="saving"
            />

          </div>

          <!-- Supplier -->
          <div class="form-group">

            <label for="supplier_id">
              Supplier
              <span>*</span>
            </label>

            <select
                id="supplier_id"
                v-model="form.supplier_id"
                required
                :disabled="saving"
            >
              <option value="" disabled>
                Select supplier
              </option>

              <option
                  v-for="supplier in suppliers"
                  :key="supplier.id"
                  :value="supplier.id"
              >
                {{ supplier.company_name }}
              </option>
            </select>

          </div>

          <!-- Order Date -->
          <div class="form-group">

            <label for="order_date">
              Order Date
              <span>*</span>
            </label>

            <input
                id="order_date"
                v-model="form.order_date"
                type="date"
                required
                :disabled="saving"
            />

          </div>

          <!-- Expected Date -->
          <div class="form-group">

            <label for="expected_date">
              Expected Date
            </label>

            <input
                id="expected_date"
                v-model="form.expected_date"
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
              <option value="draft">Draft</option>
              <option value="submitted">Submitted</option>
              <option value="approved">Approved</option>
            </select>

            <small>
              Keep the order as Draft until it is ready to send to the supplier.
            </small>

          </div>

        </div>

      </section>

      <!-- Items -->
      <section class="form-section">

        <div class="section-header section-header-row">
          <div>
            <h2>Items</h2>

            <p>
              Add the items you are ordering and their costs.
            </p>
          </div>

          <button
              type="button"
              class="btn-primary"
              @click="addItem"
              :disabled="saving"
          >
            + Add Item
          </button>
        </div>

        <div
            v-for="(row, index) in form.items"
            :key="row.tempId"
            class="item-row"
        >

          <!-- Item -->
          <div class="form-group">

            <label :for="`item-${row.tempId}`">
              Item
              <span>*</span>
            </label>

            <select
                :id="`item-${row.tempId}`"
                v-model="row.item_id"
                required
                :disabled="saving"
                @change="itemChanged(row)"
            >
              <option value="" disabled>
                Select item
              </option>

              <option
                  v-for="item in items"
                  :key="item.id"
                  :value="item.id"
              >
                {{ item.item_code }} - {{ item.item_name }}
              </option>
            </select>

          </div>

          <!-- Quantity -->
          <div class="form-group">

            <label :for="`qty-${row.tempId}`">
              Quantity
              <span>*</span>
            </label>

            <input
                :id="`qty-${row.tempId}`"
                v-model.number="row.quantity_ordered"
                type="number"
                min="0.001"
                step="0.001"
                required
                :disabled="saving"
            />

          </div>

          <!-- Unit Cost -->
          <div class="form-group">

            <label :for="`cost-${row.tempId}`">
              Unit Cost
              <span>*</span>
            </label>

            <input
                :id="`cost-${row.tempId}`"
                v-model.number="row.unit_cost"
                type="number"
                min="0"
                step="0.01"
                required
                :disabled="saving"
            />

          </div>

          <!-- Discount -->
          <div class="form-group">

            <label :for="`discount-${row.tempId}`">
              Discount
            </label>

            <input
                :id="`discount-${row.tempId}`"
                v-model.number="row.discount_amount"
                type="number"
                min="0"
                step="0.01"
                :disabled="saving"
            />

          </div>

          <!-- Tax -->
          <div class="form-group">

            <label :for="`tax-${row.tempId}`">
              Tax
            </label>

            <input
                :id="`tax-${row.tempId}`"
                v-model.number="row.tax_amount"
                type="number"
                min="0"
                step="0.01"
                :disabled="saving"
            />

          </div>

          <!-- Line Total -->
          <div class="form-group">

            <label :for="`total-${row.tempId}`">
              Line Total
            </label>

            <input
                :id="`total-${row.tempId}`"
                :value="formatCurrency(lineTotal(row))"
                type="text"
                disabled
            />

          </div>

          <!-- Remove -->
          <button
              type="button"
              class="btn-danger"
              :disabled="saving || form.items.length === 1"
              @click="removeItem(index)"
          >
            Remove
          </button>

        </div>

      </section>

      <!-- Totals -->
      <section class="form-section totals-section">

        <div class="totals">

          <div class="total-row">
            <span>Subtotal</span>

            <strong>{{ formatCurrency(subtotal) }}</strong>
          </div>

          <div class="total-row">
            <label for="order_discount">Discount</label>

            <input
                id="order_discount"
                v-model.number="form.discount_amount"
                type="number"
                min="0"
                step="0.01"
                class="total-input"
                :disabled="saving"
            />
          </div>

          <div class="total-row">
            <label for="order_tax">Tax</label>

            <input
                id="order_tax"
                v-model.number="form.tax_amount"
                type="number"
                min="0"
                step="0.01"
                class="total-input"
                :disabled="saving"
            />
          </div>

          <div class="total-row">
            <label for="order_shipping">Shipping</label>

            <input
                id="order_shipping"
                v-model.number="form.shipping_amount"
                type="number"
                min="0"
                step="0.01"
                class="total-input"
                :disabled="saving"
            />
          </div>

          <div class="total-row grand-total">
            <span>Total</span>

            <strong>{{ formatCurrency(totalAmount) }}</strong>
          </div>

        </div>

      </section>

      <!-- Notes -->
      <section class="form-section">

        <div class="section-header">
          <h2>Notes</h2>

          <p>
            Add any additional information about this purchase order.
          </p>
        </div>

        <div class="form-group">

          <label for="notes">
            Notes
          </label>

          <textarea
              id="notes"
              v-model="form.notes"
              rows="4"
              placeholder="Additional notes..."
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
.po-form-page {
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

.po-form {
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

.section-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-lg);
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
.form-group select,
.total-input {
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
.form-group textarea:focus,
.total-input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-light);
}

.form-group input:disabled,
.form-group select:disabled,
.form-group textarea:disabled,
.total-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.form-group small {
  font-size: var(--font-size-xs);
  line-height: 1.5;
  color: var(--color-text-muted);
}

/* =========================
   Item rows
   ========================= */

.item-row {
  display: grid;
  grid-template-columns: 2fr repeat(5, minmax(0, 1fr)) auto;
  gap: var(--spacing-md);
  align-items: end;
  padding: var(--spacing-lg) 0;
  border-bottom: 1px solid var(--color-border-light);
}

.item-row:last-child {
  padding-bottom: 0;
  border-bottom: none;
}

/* =========================
   Totals
   ========================= */

.totals-section {
  display: flex;
  justify-content: flex-end;
}

.totals {
  width: 400px;
  max-width: 100%;
}

.total-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-lg);
  padding: var(--spacing-sm) 0;
  font-size: var(--font-size-md);
  color: var(--color-text-primary);
}

.total-row label {
  font-size: var(--font-size-md);
  color: var(--color-text-primary);
}

.total-input {
  width: 140px;
  text-align: right;
}

.grand-total {
  margin-top: var(--spacing-sm);
  padding-top: var(--spacing-lg);
  border-top: 1px solid var(--color-border-light);
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
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
.btn-secondary,
.btn-danger {
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

.btn-danger {
  border: 1px solid var(--color-danger-light);
  background: var(--color-danger-bg);
  color: var(--color-danger);
}

.btn-danger:hover:not(:disabled) {
  border-color: var(--color-danger);
}

.btn-primary:disabled,
.btn-secondary:disabled,
.btn-danger:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* =========================
   Responsive
   ========================= */

@media (max-width: 1100px) {
  .item-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .item-row .btn-danger {
    grid-column: 1 / -1;
  }
}

@media (max-width: 768px) {
  .form-header,
  .section-header-row {
    flex-direction: column;
    align-items: flex-start;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }

  .form-section {
    padding: var(--spacing-xl);
  }

  .totals-section {
    justify-content: stretch;
  }

  .form-actions {
    flex-direction: column-reverse;
  }

  .btn-primary,
  .btn-secondary,
  .btn-danger {
    width: 100%;
  }
}
</style>
