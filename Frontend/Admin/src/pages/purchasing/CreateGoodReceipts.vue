
<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  getGoodsReceiptById,
  createGoodsReceipt,
  updateGoodsReceipt,
  getGoodsReceiptItems,
  createGoodsReceiptItem,
  updateGoodsReceiptItem,
  deleteGoodsReceiptItem,
  receiveGoodsReceipt
} from '../../api/goodsReceiptApi.js'
import { getInventoryLocations } from '../../api/inventoryLocationApi.js'
import itemApi from '../../api/itemApi.js'
import api from '../../api/axios.js'
import { hasPermission } from '../../auth/authorization.js'

const route = useRoute()
const router = useRouter()
const LIST_ROUTE = '/admin/purchasing/goods-receipts'

const loading = ref(false)
const saving = ref(false)
const lineSaving = ref(false)
const receiving = ref(false)
const error = ref('')
const success = ref('')

const locations = ref([])
const items = ref([])
const variants = ref([])
const receiptItems = ref([])

const form = ref({
  receipt_number: '',
  location_id: '',
  receipt_date: new Date().toISOString().slice(0, 10),
  supplier_delivery_note: '',
  notes: ''
})

const line = ref({
  item_id: '',
  variant_id: '',
  quantity_received: 1,
  unit_cost: 0,
  condition: 'good',
  notes: ''
})

const editingLineId = ref(null)

const receiptId = computed(() => route.params.id || null)
const isEdit = computed(() => Boolean(receiptId.value))
const receipt = ref(null)

const status = computed(() => receipt.value?.status || 'draft')
const isDraft = computed(() => status.value === 'draft')
const canCreate = computed(() => hasPermission('products.create'))
const canUpdate = computed(() => hasPermission('products.update'))
const canDelete = computed(() => hasPermission('products.delete'))
const canReceive = computed(() => canUpdate.value && isDraft.value)

const pageTitle = computed(() =>
  isEdit.value ? 'Goods Receipt' : 'Create Goods Receipt'
)

const selectedItem = computed(() =>
  items.value.find(item => String(item.id) === String(line.value.item_id))
)

const selectedVariants = computed(() =>
  variants.value.filter(variant => variant.is_active !== false)
)

function unwrap(response) {
  return response?.data?.data ?? response?.data ?? []
}

function generateReceiptNumber() {
  const now = new Date()
  const date = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0')
  ].join('')
  const suffix = `${Date.now().toString(36).toUpperCase()}${Math.random()
    .toString(36).slice(2, 6).toUpperCase()}`
  return `GRN-${date}-${suffix}`
}

function messageFrom(err, fallback) {
  return err?.response?.data?.message || err?.message || fallback
}

async function loadLocations() {
  const response = await getInventoryLocations({ is_active: true })
  locations.value = unwrap(response)
}

async function loadItems() {
  const response = await itemApi.getItems()
  const data = response?.data ?? response
  items.value = Array.isArray(data) ? data : []
}

async function loadReceipt() {
  if (!receiptId.value) return

  const response = await getGoodsReceiptById(receiptId.value)
  receipt.value = unwrap(response)

  const current = receipt.value
  if (!current?.id) throw new Error('Goods receipt not found')

  form.value = {
    receipt_number: current.receipt_number || '',
    location_id: current.location_id ?? '',
    receipt_date: String(current.receipt_date || '').slice(0, 10),
    supplier_delivery_note: current.supplier_delivery_note || '',
    notes: current.notes || ''
  }

  await loadReceiptItems()
}

async function loadReceiptItems() {
  if (!receiptId.value) {
    receiptItems.value = []
    return
  }

  const response = await getGoodsReceiptItems()
  const all = unwrap(response)

  receiptItems.value = (Array.isArray(all) ? all : [])
    .filter(item =>
      Number(item.goods_receipt_id ?? item.goodsReceipt?.id) ===
      Number(receiptId.value)
    )
    .map(item => ({ ...item }))
}

async function loadVariants(itemId) {
  variants.value = []
  line.value.variant_id = ''

  if (!itemId) return

  try {
    const response = await api.get(`/items/${itemId}/variants`)
    variants.value = unwrap(response)
  } catch (err) {
    console.error('Failed to load item variants:', err)
    error.value = messageFrom(err, 'Could not load variants for this item.')
  }
}

watch(
  () => line.value.item_id,
  async itemId => {
    await loadVariants(itemId)
  }
)

function resetLine() {
  editingLineId.value = null
  line.value = {
    item_id: '',
    variant_id: '',
    quantity_received: 1,
    unit_cost: 0,
    condition: 'good',
    notes: ''
  }
  variants.value = []
}

async function submitHeader() {
  error.value = ''
  success.value = ''

  if (isEdit.value ? !canUpdate.value : !canCreate.value) {
    error.value = 'You do not have permission to save this receipt.'
    return
  }

  if (!form.value.location_id || !form.value.receipt_date) {
    error.value = 'Receiving location and receipt date are required.'
    return
  }

  saving.value = true

  try {
    const payload = {
      receipt_number: form.value.receipt_number.trim() || generateReceiptNumber(),
      location_id: Number(form.value.location_id),
      receipt_date: form.value.receipt_date,
      supplier_delivery_note: form.value.supplier_delivery_note.trim() || null,
      notes: form.value.notes.trim() || null
    }

    if (isEdit.value) {
      await updateGoodsReceipt(receiptId.value, payload)
      success.value = 'Goods receipt details saved.'
      await loadReceipt()
    } else {
      const response = await createGoodsReceipt(payload)
      const created = unwrap(response)
      const id = created?.id ?? created?.goodsReceipt?.id

      if (!id) {
        throw new Error('Receipt was created, but its ID was not returned.')
      }

      success.value = 'Draft receipt created. Add the items below.'
      await router.replace(`${LIST_ROUTE}/edit/${id}`)
    }
  } catch (err) {
    error.value = messageFrom(err, 'Failed to save goods receipt.')
  } finally {
    saving.value = false
  }
}

function startEditLine(item) {
  editingLineId.value = item.id
  line.value = {
    item_id: String(item.item_id),
    variant_id: item.variant_id == null ? '' : String(item.variant_id),
    quantity_received: Number(item.quantity_received),
    unit_cost: Number(item.unit_cost),
    condition: item.condition || 'good',
    notes: item.notes || ''
  }
}

async function saveLine() {
  error.value = ''
  success.value = ''

  if (!receiptId.value || !isDraft.value) {
    error.value = 'Save the receipt as a draft before adding items.'
    return
  }

  if (editingLineId.value ? !canUpdate.value : !canCreate.value) {
    error.value = 'You do not have permission to save receipt items.'
    return
  }

  if (!line.value.item_id) {
    error.value = 'Select a product.'
    return
  }

  if (
    !Number.isFinite(Number(line.value.quantity_received)) ||
    Number(line.value.quantity_received) <= 0
  ) {
    error.value = 'Quantity must be greater than zero.'
    return
  }

  if (
    !Number.isFinite(Number(line.value.unit_cost)) ||
    Number(line.value.unit_cost) < 0
  ) {
    error.value = 'Unit cost must be zero or greater.'
    return
  }

  lineSaving.value = true

  try {
    const payload = {
      item_id: Number(line.value.item_id),
      variant_id: line.value.variant_id ? Number(line.value.variant_id) : null,
      quantity_received: Number(line.value.quantity_received),
      unit_cost: Number(line.value.unit_cost),
      condition: line.value.condition,
      notes: line.value.notes.trim() || null
    }

    if (editingLineId.value) {
      // The current backend updates quantity, cost, condition and notes.
      // It does not change the product or variant on an existing line.
      const original = receiptItems.value.find(
        item => Number(item.id) === Number(editingLineId.value)
      )

      if (
        !original ||
        Number(original.item_id) !== payload.item_id ||
        Number(original.variant_id ?? 0) !== Number(payload.variant_id ?? 0)
      ) {
        error.value = 'To change the product or variant, delete this line and add it again.'
        return
      }

      await updateGoodsReceiptItem(editingLineId.value, {
        quantity_received: payload.quantity_received,
        unit_cost: payload.unit_cost,
        condition: payload.condition,
        notes: payload.notes
      })

      success.value = 'Receipt item updated.'
    } else {
      await createGoodsReceiptItem({
        goods_receipt_id: Number(receiptId.value),
        ...payload
      })

      success.value = 'Item added to the draft receipt.'
    }

    resetLine()
    await loadReceiptItems()
  } catch (err) {
    error.value = messageFrom(err, 'Failed to save receipt item.')
  } finally {
    lineSaving.value = false
  }
}

async function removeLine(item) {
  if (!canDelete.value || !isDraft.value) return

  if (!window.confirm('Remove this item from the draft receipt?')) return

  error.value = ''
  success.value = ''

  try {
    await deleteGoodsReceiptItem(item.id)
    if (Number(editingLineId.value) === Number(item.id)) resetLine()
    await loadReceiptItems()
    success.value = 'Receipt item removed.'
  } catch (err) {
    error.value = messageFrom(err, 'Failed to remove receipt item.')
  }
}

async function receiveReceipt() {
  if (!canReceive.value || !receiptItems.value.length) {
    error.value = 'A draft receipt with at least one item is required.'
    return
  }

  if (!window.confirm('Receive these goods and update inventory stock?')) return

  error.value = ''
  success.value = ''
  receiving.value = true

  try {
    await receiveGoodsReceipt(receiptId.value)
    await loadReceipt()
    success.value = 'Goods received and inventory updated.'
  } catch (err) {
    error.value = messageFrom(err, 'Failed to receive goods.')
  } finally {
    receiving.value = false
  }
}

function goBack() {
  router.push(LIST_ROUTE)
}

onMounted(async () => {
  loading.value = true
  error.value = ''

  try {
    await Promise.all([loadLocations(), loadItems()])
    await loadReceipt()
  } catch (err) {
    error.value = messageFrom(err, 'Failed to load goods receipt information.')
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="receipt-form-page">
    <header class="form-header">
      <div>
        <h1>{{ pageTitle }}</h1>
        <p>Create a draft, add the received products, then receive the goods to update stock.</p>
      </div>
      <div class="header-actions">
        <span v-if="receipt" class="status-pill" :class="status">
          {{ status }}
        </span>
        <button type="button" class="btn-secondary" @click="goBack">
          Back to receipts
        </button>
      </div>
    </header>

    <div v-if="error" class="message error-message">{{ error }}</div>
    <div v-if="success" class="message success-message">{{ success }}</div>
    <div v-if="loading" class="loading-message">Loading receipt...</div>

    <template v-else>
      <form class="panel" @submit.prevent="submitHeader">
        <h2>Receipt information</h2>

        <div class="form-grid">
          <label class="form-group">
            Receipt number
            <input
              v-model="form.receipt_number"
              maxlength="50"
              placeholder="Generated automatically if empty"
              :disabled="saving || (isEdit && !isDraft)"
            />
          </label>

          <label class="form-group">
            Receipt date *
            <input
              v-model="form.receipt_date"
              type="date"
              required
              :disabled="saving || (isEdit && !isDraft)"
            />
          </label>

          <label class="form-group">
            Receiving location *
            <select
              v-model="form.location_id"
              required
              :disabled="saving || (isEdit && !isDraft)"
            >
              <option value="">Select location</option>
              <option v-for="location in locations" :key="location.id" :value="location.id">
                {{ location.code ? `${location.code} - ` : '' }}{{ location.name }}
              </option>
            </select>
          </label>

          <label class="form-group">
            Delivery note reference
            <input
              v-model="form.supplier_delivery_note"
              maxlength="100"
              placeholder="Optional reference"
              :disabled="saving || (isEdit && !isDraft)"
            />
          </label>
        </div>

        <label class="form-group">
          Notes
          <textarea
            v-model="form.notes"
            rows="3"
            placeholder="Optional receipt notes"
            :disabled="saving || (isEdit && !isDraft)"
          />
        </label>

        <div class="actions">
          <button
            v-if="isEdit ? canUpdate && isDraft : canCreate"
            class="btn-primary"
            type="submit"
            :disabled="saving"
          >
            {{ saving ? 'Saving...' : isEdit ? 'Save receipt details' : 'Create draft receipt' }}
          </button>
        </div>
      </form>

      <section v-if="isEdit" class="panel">
        <h2>Received products</h2>
        <p class="muted">Add each product or variant once. Stock is not changed until you receive the GRN.</p>

        <div v-if="receiptItems.length" class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Variant</th>
                <th>Qty</th>
                <th>Unit cost</th>
                <th>Condition</th>
                <th>Notes</th>
                <th v-if="isDraft">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in receiptItems" :key="item.id">
                <td>
                  {{ item.item?.item_name || `Item #${item.item_id}` }}
                  <small v-if="item.item?.item_code">{{ item.item.item_code }}</small>
                </td>
                <td>
                  {{ item.variant?.variant_name || (item.variant_id ? `Variant #${item.variant_id}` : 'No variant') }}
                  <small v-if="item.variant?.variant_sku">{{ item.variant.variant_sku }}</small>
                </td>
                <td>{{ item.quantity_received }}</td>
                <td>{{ Number(item.unit_cost).toFixed(2) }}</td>
                <td>{{ item.condition }}</td>
                <td>{{ item.notes || '—' }}</td>
                <td v-if="isDraft" class="row-actions">
                  <button
                    v-if="canUpdate"
                    type="button"
                    class="btn-small"
                    @click="startEditLine(item)"
                  >Edit</button>
                  <button
                    v-if="canDelete"
                    type="button"
                    class="btn-small danger"
                    @click="removeLine(item)"
                  >Remove</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else class="empty-state">No products added yet.</p>

        <form
          v-if="isDraft && (editingLineId ? canUpdate : canCreate)"
          class="line-form"
          @submit.prevent="saveLine"
        >
          <h3>{{ editingLineId ? 'Edit receipt item' : 'Add a product' }}</h3>

          <div class="form-grid">
            <label class="form-group">
              Product *
              <select v-model="line.item_id" required :disabled="lineSaving || Boolean(editingLineId)">
                <option value="">Select product</option>
                <option v-for="item in items" :key="item.id" :value="String(item.id)">
                  {{ item.item_code ? `${item.item_code} - ` : '' }}{{ item.item_name }}
                </option>
              </select>
            </label>

            <label class="form-group">
              Variant *
              <select
                v-model="line.variant_id"
                required
                :disabled="lineSaving || Boolean(editingLineId) || !line.item_id"
              >
                <option value="">Select variant</option>
                <option
                  v-for="variant in selectedVariants"
                  :key="variant.id"
                  :value="String(variant.id)"
                >
                  {{ variant.variant_name }} ({{ variant.variant_sku }})
                  {{ variant.is_default ? '— Default' : '' }}
                </option>
              </select>
            </label>

            <label class="form-group">
              Quantity received *
              <input
                v-model.number="line.quantity_received"
                type="number"
                min="0.001"
                step="0.001"
                required
                :disabled="lineSaving"
              />
            </label>

            <label class="form-group">
              Unit cost *
              <input
                v-model.number="line.unit_cost"
                type="number"
                min="0"
                step="0.01"
                required
                :disabled="lineSaving"
              />
            </label>

            <label class="form-group">
              Condition *
              <select v-model="line.condition" required :disabled="lineSaving">
                <option value="good">Good</option>
                <option value="damaged">Damaged</option>
                <option value="defective">Defective</option>
              </select>
            </label>

            <label class="form-group">
              Item notes
              <input v-model="line.notes" maxlength="1000" :disabled="lineSaving" />
            </label>
          </div>

          <div class="actions">
            <button class="btn-primary" type="submit" :disabled="lineSaving">
              {{ lineSaving ? 'Saving...' : editingLineId ? 'Update item' : 'Add item' }}
            </button>
            <button
              v-if="editingLineId"
              class="btn-secondary"
              type="button"
              :disabled="lineSaving"
              @click="resetLine"
            >Cancel edit</button>
          </div>
        </form>

        <div v-if="isDraft" class="receive-actions">
          <button
            v-if="canReceive"
            class="btn-primary"
            type="button"
            :disabled="receiving || saving || lineSaving || !receiptItems.length"
            @click="receiveReceipt"
          >
            {{ receiving ? 'Receiving...' : 'Receive Goods & Update Stock' }}
          </button>
          <p class="muted">Receiving is final: the backend validates the receipt and applies the stock movements.</p>
        </div>

        <p v-else class="muted">
          This receipt is {{ status }}. Its items can no longer be changed.
        </p>
      </section>
    </template>
  </div>
</template>

<style scoped>
.receipt-form-page {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  font-family: var(--font-family);
  color: var(--color-text-primary);
}
.form-header, .header-actions, .actions, .receive-actions, .row-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}
.form-header {
  justify-content: space-between;
  flex-wrap: wrap;
  margin-bottom: 24px;
}
.form-header h1 { font-size: var(--font-size-2xl); }
.form-header p, .muted { color: var(--color-text-secondary); }
.panel {
  margin-bottom: 24px;
  padding: 24px;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-surface, white);
}
.panel h2 { margin: 0 0 16px; font-size: 1.2rem; }
.panel h3 { margin: 0 0 16px; }
.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 16px;
}
.form-group {
  display: flex;
  flex-direction: column;
  gap: 7px;
  margin-bottom: 14px;
  font-weight: 500;
}
input, select, textarea {
  box-sizing: border-box;
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: 7px;
  background: var(--color-background, white);
  color: inherit;
  font: inherit;
}
input:disabled, select:disabled, textarea:disabled { opacity: .65; }
.btn-primary, .btn-secondary, .btn-small {
  padding: 10px 15px;
  border: 0;
  border-radius: 7px;
  cursor: pointer;
  font: inherit;
}
.btn-primary {
  background: var(--color-primary);
  color: white;
}
.btn-secondary, .btn-small {
  border: 1px solid var(--color-border);
  background: var(--color-surface, white);
  color: inherit;
}
.btn-small { padding: 6px 9px; }
.danger { color: #b42318; }
button:disabled { cursor: not-allowed; opacity: .6; }
.line-form {
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid var(--color-border);
}
.table-wrap { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; }
th, td {
  padding: 12px 10px;
  text-align: left;
  vertical-align: top;
  border-bottom: 1px solid var(--color-border);
}
th { white-space: nowrap; }
td small { display: block; margin-top: 4px; color: var(--color-text-secondary); }
.row-actions { flex-wrap: wrap; }
.receive-actions {
  align-items: flex-start;
  flex-direction: column;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid var(--color-border);
}
.status-pill {
  padding: 5px 10px;
  border-radius: 999px;
  background: var(--color-background);
  text-transform: capitalize;
}
.message { padding: 12px 14px; margin-bottom: 16px; border-radius: 7px; }
.error-message { color: #b42318; background: #fef3f2; }
.success-message { color: #067647; background: #ecfdf3; }
.loading-message, .empty-state { padding: 20px 0; color: var(--color-text-secondary); }
@media (max-width: 700px) {
  .form-grid { grid-template-columns: 1fr; }
  .panel { padding: 16px; }
}
</style>
