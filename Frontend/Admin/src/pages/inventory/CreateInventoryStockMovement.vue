<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import Multiselect from 'vue-multiselect'
import 'vue-multiselect/dist/vue-multiselect.css'
import api from '@/api/axios'
import {
  hasPermission as authorization,
  ensureAuthorization
} from '@/auth/authorization.js'

// Base path of inventory stock movement pages
const MOVEMENT_BASE = '/admin/inventory/movements'

const router = useRouter()
const route = useRoute()

const itemVariants = ref([])
const selectedVariant = ref(null)
const variantsLoading = ref(false)

// ==========================================
// Mode
// ==========================================

const isEditMode = computed(() => !!route.params.id)

const movementId = computed(() => route.params.id || null)

const requiredPermission = computed(() =>
    isEditMode.value ? 'inventory.update' : 'inventory.create'
)

// ==========================================
// Movement types
// ==========================================

const movementTypes = [
  { value: 'purchase', label: 'Purchase', effect: 'in' },
  { value: 'customer_return', label: 'Customer Return', effect: 'in' },
  { value: 'transfer_in', label: 'Transfer In', effect: 'in' },
  { value: 'sale', label: 'Sale', effect: 'out' },
  { value: 'supplier_return', label: 'Supplier Return', effect: 'out' },
  { value: 'transfer_out', label: 'Transfer Out', effect: 'out' },
  { value: 'adjustment', label: 'Adjustment', effect: 'adjustment' }
]

// ==========================================
// State
// ==========================================

const loading = ref(false)
const pageLoading = ref(true)
const forbidden = ref(false)
const loadFailed = ref(false)
const errorMessage = ref('')

const items = ref([])
const locations = ref([])

const selectedItem = ref(null)
const selectedLocation = ref(null)

const form = ref({
  movement_type: '',
  quantity: '',
  reference_type: '',
  reference_id: '',
  is_active: true
})

// ==========================================
// Helpers
// ==========================================

const itemLabel = (item) => `${item.item_code} - ${item.item_name}`

const locationLabel = (location) => `${location.code} - ${location.name}`

const selectedType = computed(() =>
    movementTypes.find(type => type.value === form.value.movement_type)
)

const isAdjustment = computed(
    () => selectedType.value?.effect === 'adjustment'
)

// Short explanation of what the movement does to stock
const effectText = computed(() => {
  const quantity = Number(form.value.quantity)

  if (!selectedType.value) return ''

  if (selectedType.value.effect === 'in') {
    return 'This movement adds stock to the location.'
  }

  if (selectedType.value.effect === 'out') {
    return 'This movement removes stock from the location.'
  }

  if (!form.value.quantity || Number.isNaN(quantity)) {
    return 'Use a positive number to add stock or a negative number to remove it.'
  }

  return quantity > 0
      ? `This adjustment adds ${quantity} to stock.`
      : `This adjustment removes ${Math.abs(quantity)} from stock.`
})

// ==========================================
// Load
// ==========================================

const loadOptions = async () => {
  const [itemsResult, locationsResult] = await Promise.allSettled([
    api.get('/items'),
    api.get('/inventory-locations')
  ])

  if (itemsResult.status === 'fulfilled') {
    items.value = itemsResult.value.data.data || []
  } else {
    console.error('Failed to load items:', itemsResult.reason)

    errorMessage.value =
        itemsResult.reason.response?.data?.message ||
        'Failed to load items.'
  }

  if (locationsResult.status === 'fulfilled') {
    locations.value = locationsResult.value.data.data || []
  } else {
    console.error('Failed to load locations:', locationsResult.reason)

    errorMessage.value =
        locationsResult.reason.response?.data?.message ||
        'Failed to load inventory locations.'
  }
}

const loadMovement = async () => {
  try {
    const response = await api.get(
        `/inventory-stock-movements/${movementId.value}`
    )

    const movement = response.data.data

    if (!movement) {
      throw new Error('Stock movement not found.')
    }

    return movement
  } catch (error) {
    console.error('Failed to load stock movement:', error)

    loadFailed.value = true

    errorMessage.value =
        error.response?.data?.message ||
        error.message ||
        'Failed to load stock movement.'

    return null
  }
}

const loadItemVariants = async (itemId) => {
  itemVariants.value = []
  selectedVariant.value = null

  if (!itemId) return

  try {
    variantsLoading.value = true

    const response = await api.get(`/items/${itemId}/variants`)
    itemVariants.value = (response.data.data || []).filter(
      variant => variant.is_active
    )

    selectedVariant.value =
      itemVariants.value.find(variant => variant.is_default) ||
      itemVariants.value[0] ||
      null
  } catch (error) {
    console.error('Failed to load item variants:', error)
    errorMessage.value =
      error.response?.data?.message || 'Failed to load item variants.'
  } finally {
    variantsLoading.value = false
  }
}

const onItemChange = (item) => loadItemVariants(item?.id)

// Fills the form from an existing movement (edit mode)
const applyMovement = (movement) => {
  selectedItem.value =
      items.value.find(item => String(item.id) === String(movement.item_id)) ||
      (movement.item ? { id: movement.item_id, ...movement.item } : null)

  selectedLocation.value =
      locations.value.find(
          location => String(location.id) === String(movement.location_id)
      ) ||
      (movement.location
          ? { id: movement.location_id, ...movement.location }
          : null)

  form.value = {
    movement_type: movement.movement_type ?? '',
    quantity:
        movement.quantity !== null && movement.quantity !== undefined
            ? String(Number(movement.quantity))
            : '',
    reference_type: movement.reference_type ?? '',
    reference_id:
        movement.reference_id !== null && movement.reference_id !== undefined
            ? String(movement.reference_id)
            : '',
    is_active: movement.is_active !== false && movement.is_active !== 0
  }
}

onMounted(async () => {
  // Wait for the user's permissions before checking them
  try {
    await ensureAuthorization()
  } catch (error) {
    console.error('Failed to load authorization:', error)
  }

  if (!authorization(requiredPermission.value)) {
    forbidden.value = true
    pageLoading.value = false

    errorMessage.value = isEditMode.value
        ? 'You do not have permission to edit inventory stock movements.'
        : 'You do not have permission to create inventory stock movements.'

    return
  }

  const [, movement] = await Promise.all([
    loadOptions(),
    isEditMode.value ? loadMovement() : Promise.resolve(null)
  ])

  if (movement) {
    applyMovement(movement)
  }

  pageLoading.value = false
})

// ==========================================
// Submit
// ==========================================

const submitForm = async () => {
  loading.value = true
  errorMessage.value = ''

  try {
    if (!selectedItem.value) {
      errorMessage.value = 'Please select an item.'
      return
    }

    if (!selectedLocation.value) {
      errorMessage.value = 'Please select a location.'
      return
    }

    if (!form.value.movement_type) {
      errorMessage.value = 'Please select a movement type.'
      return
    }

    const quantity = Number(form.value.quantity)

    if (form.value.quantity === '' || Number.isNaN(quantity) || quantity === 0) {
      errorMessage.value = 'Enter a quantity other than zero.'
      return
    }

    if (!isAdjustment.value && quantity < 0) {
      errorMessage.value = 'Quantity must be greater than zero.'
      return
    }

    if (!selectedVariant.value) {
  errorMessage.value = 'Please select an item variant.'
  return
}

    const referenceId = form.value.reference_id.trim()

    const payload = {
      item_id: Number(selectedItem.value.id),
      location_id: Number(selectedLocation.value.id),
      movement_type: form.value.movement_type,
      variant_id: Number(selectedVariant.value.id),
      quantity,
      reference_type: form.value.reference_type.trim() || null,
      reference_id: referenceId
          ? (Number.isNaN(Number(referenceId)) ? referenceId : Number(referenceId))
          : null,
      is_active: form.value.is_active
    }

    if (isEditMode.value) {
      await api.put(`/inventory-stock-movements/${movementId.value}`, payload)

      alert('Stock movement updated successfully.')
    } else {
      await api.post('/inventory-stock-movements', payload)

      alert('Stock movement created successfully.')
    }

    router.push(MOVEMENT_BASE)
  } catch (error) {
    console.error(
        isEditMode.value
            ? 'Failed to update stock movement:'
            : 'Failed to create stock movement:',
        error
    )

    errorMessage.value =
        error.response?.data?.message ||
        error.message ||
        (isEditMode.value
            ? 'Failed to update stock movement.'
            : 'Failed to create stock movement.')
  } finally {
    loading.value = false
  }
}

const goBack = () => {
  router.push(MOVEMENT_BASE)
}
</script>

<template>
  <div class="movement-form-page">

    <!-- Header -->
    <div class="form-header">
      <div>
        <h1>{{ isEditMode ? 'Edit Stock Movement' : 'Add Stock Movement' }}</h1>

        <p>
          {{
            isEditMode
                ? 'Update this stock movement.'
                : 'Record a stock movement for an item at an inventory location.'
          }}
        </p>
      </div>

      <button
          type="button"
          class="btn-secondary"
          @click="goBack"
      >
        Cancel
      </button>
    </div>

    <!-- Error -->
    <div
        v-if="errorMessage"
        class="error-message"
    >
      {{ errorMessage }}
    </div>

    <!-- Loading -->
    <div
        v-if="pageLoading"
        class="loading-state"
    >
      Loading...
    </div>

    <!-- Form -->
    <form
        v-else-if="!forbidden && !loadFailed"
        class="movement-form"
        @submit.prevent="submitForm"
    >

      <!-- Movement Details -->
      <section class="form-section">

        <div class="section-header">
          <h2>Movement Details</h2>
          <p>Choose the item, location, movement type and quantity.</p>
        </div>

        <div class="form-grid">

          <!-- Item -->
          <div class="form-group">
            <label for="item">
              Item
              <span>*</span>
            </label>

            <Multiselect
                id="item"
                v-model="selectedItem"
                :options="items"
                :custom-label="itemLabel"
                track-by="id"
                :options-limit="200"
                :show-labels="false"
                :disabled="loading"
                placeholder="Search by item code or name..."
                @select="onItemChange"
            >
              <template #noResult>
                No items found.
              </template>

              <template #noOptions>
                No items available.
              </template>
            </Multiselect>

            <div class="form-group">
  <label for="variant">Variant <span>*</span></label>

  <Multiselect
    id="variant"
    v-model="selectedVariant"
    :options="itemVariants"
    label="variant_sku"
    track-by="id"
    :loading="variantsLoading"
    :disabled="loading || !selectedItem"
    :show-labels="false"
    placeholder="Select a variant..."
  >
    <template #noOptions>
      Select an item to load its variants.
    </template>
  </Multiselect>
</div>
          </div>

          <!-- Location -->
          <div class="form-group">
            <label for="location">
              Location
              <span>*</span>
            </label>

            <Multiselect
                id="location"
                v-model="selectedLocation"
                :options="locations"
                :custom-label="locationLabel"
                track-by="id"
                :show-labels="false"
                :disabled="loading"
                placeholder="Search by location code or name..."
            >
              <template #noResult>
                No locations found.
              </template>

              <template #noOptions>
                No locations available.
              </template>
            </Multiselect>
          </div>

          <!-- Movement Type -->
          <div class="form-group">
            <label for="movement_type">
              Movement Type
              <span>*</span>
            </label>

            <select
                id="movement_type"
                v-model="form.movement_type"
                :disabled="loading"
                required
            >
              <option value="" disabled>
                Select movement type
              </option>

              <optgroup label="Stock in">
                <option
                    v-for="type in movementTypes.filter(t => t.effect === 'in')"
                    :key="type.value"
                    :value="type.value"
                >
                  {{ type.label }}
                </option>
              </optgroup>

              <optgroup label="Stock out">
                <option
                    v-for="type in movementTypes.filter(t => t.effect === 'out')"
                    :key="type.value"
                    :value="type.value"
                >
                  {{ type.label }}
                </option>
              </optgroup>

              <optgroup label="Correction">
                <option
                    v-for="type in movementTypes.filter(t => t.effect === 'adjustment')"
                    :key="type.value"
                    :value="type.value"
                >
                  {{ type.label }}
                </option>
              </optgroup>
            </select>
          </div>

          <!-- Quantity -->
          <div class="form-group">
            <label for="quantity">
              Quantity
              <span>*</span>
            </label>

            <input
                id="quantity"
                v-model="form.quantity"
                type="number"
                step="0.001"
                :min="isAdjustment ? undefined : 0.001"
                placeholder="e.g. 10"
                :disabled="loading"
                required
            />

            <small
                v-if="effectText"
                :class="['effect', selectedType?.effect]"
            >
              {{ effectText }}
            </small>
          </div>

        </div>

      </section>

      <!-- Reference -->
      <section class="form-section">

        <div class="section-header">
          <h2>Reference</h2>
          <p>
            Optionally link this movement to the document that caused it.
          </p>
        </div>

        <div class="form-grid">

          <!-- Reference Type -->
          <div class="form-group">
            <label for="reference_type">
              Reference Type
            </label>

            <input
                id="reference_type"
                v-model="form.reference_type"
                type="text"
                placeholder="e.g. purchase_order"
                maxlength="50"
                :disabled="loading"
            />
          </div>

          <!-- Reference ID -->
          <div class="form-group">
            <label for="reference_id">
              Reference ID
            </label>

            <input
                id="reference_id"
                v-model="form.reference_id"
                type="text"
                placeholder="e.g. 1024"
                maxlength="50"
                :disabled="loading"
            />
          </div>

        </div>

      </section>

      <!-- Settings -->
      <section class="form-section">

        <div class="section-header">
          <h2>Settings</h2>
          <p>Configure whether this movement counts in the stock history.</p>
        </div>

        <div class="checkbox-group">
          <label>
            <input
                v-model="form.is_active"
                type="checkbox"
                :disabled="loading"
            />

            <span>Active</span>
          </label>

          <small>
            Inactive movements stay in the history but are dimmed in the
            movements list.
          </small>
        </div>

      </section>

      <!-- Actions -->
      <div class="form-actions">

        <button
            type="button"
            class="btn-secondary"
            @click="goBack"
            :disabled="loading"
        >
          Cancel
        </button>

        <button
            type="submit"
            class="btn-primary"
            :disabled="loading"
        >
          {{ loading ? 'Saving...' : (isEditMode ? 'Update Movement' : 'Create Movement') }}
        </button>

      </div>

    </form>

  </div>
</template>

<style scoped>
.movement-form-page {
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

.movement-form {
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

.form-group input::placeholder {
  color: var(--color-text-muted);
}

.form-group input:focus,
.form-group select:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-light);
}

.form-group input:disabled,
.form-group select:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.form-group small,
.checkbox-group small {
  font-size: var(--font-size-xs);
  line-height: 1.5;
  color: var(--color-text-muted);
}

.form-group small.effect.in {
  color: var(--color-success);
}

.form-group small.effect.out {
  color: var(--color-danger);
}

/* =========================
   Searchable Select (vue-multiselect)
   ========================= */

.form-group :deep(.multiselect) {
  min-height: 40px;
  font-family: inherit;
  font-size: var(--font-size-md);
  color: var(--color-text-primary);
}

.form-group :deep(.multiselect__tags) {
  min-height: 40px;
  padding: 7px 40px 0 var(--spacing-lg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  transition: border-color var(--transition-fast),
  box-shadow var(--transition-fast);
}

.form-group :deep(.multiselect--active .multiselect__tags) {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-light);
}

.form-group :deep(.multiselect--disabled) {
  opacity: 0.6;
}

.form-group :deep(.multiselect__input),
.form-group :deep(.multiselect__single) {
  min-height: 20px;
  margin-bottom: 0;
  padding: 0;
  background: transparent;
  color: var(--color-text-primary);
  font-family: inherit;
  font-size: var(--font-size-md);
}

.form-group :deep(.multiselect__placeholder) {
  margin-bottom: 0;
  padding-top: 0;
  color: var(--color-text-muted);
}

.form-group :deep(.multiselect__select) {
  height: 38px;
  right: 4px;
}

.form-group :deep(.multiselect__content-wrapper) {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-sm);
  z-index: 1000;
}

.form-group :deep(.multiselect__content) {
  padding: 0;
}

.form-group :deep(.multiselect__option) {
  padding: 10px var(--spacing-lg);
  min-height: 0;
  font-size: var(--font-size-md);
  color: var(--color-text-primary);
}

.form-group :deep(.multiselect__option--highlight),
.form-group :deep(.multiselect__option--highlight::after) {
  background: var(--color-primary);
  color: var(--color-text-light);
}

.form-group :deep(.multiselect__option--selected) {
  background: var(--color-hover-bg);
  font-weight: var(--font-weight-semibold);
}

.form-group :deep(.multiselect__option--selected.multiselect__option--highlight) {
  background: var(--color-primary);
  color: var(--color-text-light);
}

/* =========================
   Checkbox
   ========================= */

.checkbox-group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.checkbox-group label {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  cursor: pointer;
}

.checkbox-group input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
  accent-color: var(--color-primary);
}

/* =========================
   States
   ========================= */

.error-message {
  margin-bottom: var(--spacing-lg);
  padding: var(--spacing-md) var(--spacing-lg);
  border: 1px solid var(--color-danger-light);
  border-radius: var(--radius-lg);
  background: var(--color-danger-bg);
  color: var(--color-danger);
  font-size: var(--font-size-sm);
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
