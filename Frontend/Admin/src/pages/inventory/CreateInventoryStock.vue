<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import Multiselect from 'vue-multiselect'
import 'vue-multiselect/dist/vue-multiselect.css'
import api from '../../api/axios'
import {
  hasPermission as authorization,
  ensureAuthorization
} from '../../auth/authorization.js'

const router = useRouter()
const route = useRoute()

// List page of the inventory stock section in your router
const LIST_ROUTE = '/admin/inventory/stock'

const isEditMode = computed(() => Boolean(route.params.id))
const stockId = computed(() => route.params.id)

const loading = ref(false)
const pageLoading = ref(false)
const loadFailed = ref(false)
const forbidden = ref(false)
const errorMessage = ref('')

const items = ref([])
const itemsLoading = ref(false)
const selectedItem = ref(null)

const locations = ref([])
const locationsLoading = ref(false)

const form = ref({
  location_id: '',
  quantity_on_hand: 0,
  quantity_reserved: 0,
  reorder_level: 0,
  is_active: true
})

const itemLabel = (item) => `${item.item_code} - ${item.item_name}`

// Active locations only, but keep the record's current one when editing
const availableLocations = computed(() =>
    locations.value.filter(
        location =>
            location.is_active ||
            Number(location.id) === Number(form.value.location_id)
    )
)

/*
|--------------------------------------------------------------------------
| Load Options
|--------------------------------------------------------------------------
*/

const loadItems = async () => {
  try {
    itemsLoading.value = true

    const response = await api.get('/items')

    items.value = response.data.data || []
  } catch (error) {
    console.error('Failed to load items:', error)

    errorMessage.value =
        error.response?.data?.message ||
        'Failed to load items.'
  } finally {
    itemsLoading.value = false
  }
}

const loadLocations = async () => {
  try {
    locationsLoading.value = true

    const response = await api.get('/inventory-locations')

    locations.value = response.data.data || []
  } catch (error) {
    console.error('Failed to load inventory locations:', error)

    errorMessage.value =
        error.response?.data?.message ||
        'Failed to load inventory locations.'
  } finally {
    locationsLoading.value = false
  }
}

/*
|--------------------------------------------------------------------------
| Load Existing Stock Record
|--------------------------------------------------------------------------
*/

const loadStock = async () => {
  try {
    pageLoading.value = true
    loadFailed.value = false
    errorMessage.value = ''

    const response = await api.get(`/inventory-stock/${stockId.value}`)

    const stock = response.data.data

    if (!stock) {
      loadFailed.value = true
      errorMessage.value = 'Stock record not found.'
      return
    }

    selectedItem.value =
        items.value.find(
            item => Number(item.id) === Number(stock.item_id)
        ) ||
        stock.item ||
        null

    form.value = {
      location_id: stock.location_id ?? '',
      quantity_on_hand: stock.quantity_on_hand ?? 0,
      quantity_reserved: stock.quantity_reserved ?? 0,
      reorder_level: stock.reorder_level ?? 0,
      is_active: Boolean(stock.is_active)
    }
  } catch (error) {
    console.error('Failed to load stock record:', error)

    loadFailed.value = true

    errorMessage.value =
        error.response?.data?.message ||
        error.message ||
        'Failed to load stock record.'
  } finally {
    pageLoading.value = false
  }
}

/*
|--------------------------------------------------------------------------
| Submit Form
|--------------------------------------------------------------------------
*/

const submitForm = async () => {
  loading.value = true
  errorMessage.value = ''

  try {
    if (!selectedItem.value) {
      errorMessage.value = 'Please select an item.'
      return
    }

    if (!form.value.location_id) {
      errorMessage.value = 'Please select a location.'
      return
    }

    const onHand = Number(form.value.quantity_on_hand)
    const reserved = Number(form.value.quantity_reserved)
    const reorderLevel = Number(form.value.reorder_level)

    if (
        [onHand, reserved, reorderLevel].some(
            value => Number.isNaN(value) || value < 0
        ) ||
        form.value.quantity_on_hand === '' ||
        form.value.quantity_reserved === '' ||
        form.value.reorder_level === ''
    ) {
      errorMessage.value = 'Quantities must be numbers of 0 or more.'
      return
    }

    if (reserved > onHand) {
      errorMessage.value =
          'Reserved quantity cannot be greater than the quantity on hand.'
      return
    }

    const payload = {
      item_id: Number(selectedItem.value.id),
      location_id: Number(form.value.location_id),
      quantity_on_hand: onHand,
      quantity_reserved: reserved,
      reorder_level: reorderLevel,
      is_active: form.value.is_active
    }

    if (isEditMode.value) {
      await api.put(`/inventory-stock/${stockId.value}`, payload)

      alert('Stock record updated successfully.')
    } else {
      await api.post('/inventory-stock', payload)

      alert('Stock record created successfully.')
    }

    router.push(LIST_ROUTE)
  } catch (error) {
    console.error(
        isEditMode.value
            ? 'Failed to update stock record:'
            : 'Failed to create stock record:',
        error
    )

    errorMessage.value =
        error.response?.data?.message ||
        error.message ||
        (
            isEditMode.value
                ? 'Failed to update stock record.'
                : 'Failed to create stock record.'
        )
  } finally {
    loading.value = false
  }
}

/*
|--------------------------------------------------------------------------
| Navigation
|--------------------------------------------------------------------------
*/

const goBack = () => {
  router.push(LIST_ROUTE)
}

onMounted(async () => {
  // Wait for the user's permissions before checking them
  try {
    await ensureAuthorization()
  } catch (error) {
    console.error('Failed to load authorization:', error)
  }

  const required = isEditMode.value
      ? 'inventory.update'
      : 'inventory.create'

  if (!authorization(required)) {
    forbidden.value = true
    errorMessage.value =
        'You do not have permission to ' +
        (isEditMode.value ? 'edit' : 'add') +
        ' inventory stock.'
    return
  }

  await Promise.all([loadItems(), loadLocations()])

  if (isEditMode.value) {
    await loadStock()
  }
})

watch(stockId, (id) => {
  if (id && !forbidden.value) loadStock()
})
</script>

<template>
  <div class="stock-form-page">

    <!-- Header -->
    <div class="form-header">
      <div>
        <h1>
          {{ isEditMode ? 'Edit Stock' : 'Add Stock' }}
        </h1>

        <p>
          {{
            isEditMode
                ? 'Update the stock quantities for this item and location.'
                : 'Add stock for an item at an inventory location.'
          }}
        </p>
      </div>

      <button
          type="button"
          class="btn-secondary"
          @click="goBack"
          :disabled="loading"
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
        class="loading-message"
    >
      Loading stock record...
    </div>

    <!-- Form -->
    <form
        v-else-if="!forbidden && !loadFailed"
        class="stock-form"
        @submit.prevent="submitForm"
    >

      <!-- Item & Location -->
      <section class="form-section">

        <div class="section-header">
          <h2>Item &amp; Location</h2>

          <p>
            Choose the item and where it is stored.
          </p>
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
                :loading="itemsLoading"
                :disabled="loading || isEditMode"
                :options-limit="200"
                :show-labels="false"
                placeholder="Search by item code or name..."
            >
              <template #noResult>
                No items found.
              </template>

              <template #noOptions>
                No items available.
              </template>
            </Multiselect>

            <small v-if="isEditMode">
              The item cannot be changed. Create a new stock record instead.
            </small>

          </div>

          <!-- Location -->
          <div class="form-group">

            <label for="location_id">
              Location
              <span>*</span>
            </label>

            <select
                id="location_id"
                v-model="form.location_id"
                required
                :disabled="loading || isEditMode || locationsLoading"
            >
              <option value="" disabled>
                Select location
              </option>

              <option
                  v-for="location in availableLocations"
                  :key="location.id"
                  :value="location.id"
              >
                {{ location.code }} - {{ location.name }}
              </option>
            </select>

            <small v-if="isEditMode">
              The location cannot be changed.
            </small>

          </div>

        </div>

      </section>

      <!-- Quantities -->
      <section class="form-section">

        <div class="section-header">
          <h2>Quantities</h2>

          <p>
            Set the stock on hand, what is reserved, and when to reorder.
          </p>
        </div>

        <div class="form-grid">

          <!-- On Hand -->
          <div class="form-group">

            <label for="quantity_on_hand">
              Quantity On Hand
              <span>*</span>
            </label>

            <input
                id="quantity_on_hand"
                v-model="form.quantity_on_hand"
                type="number"
                step="0.001"
                min="0"
                placeholder="0"
                required
                :disabled="loading"
            />

          </div>

          <!-- Reserved -->
          <div class="form-group">

            <label for="quantity_reserved">
              Quantity Reserved
            </label>

            <input
                id="quantity_reserved"
                v-model="form.quantity_reserved"
                type="number"
                step="0.001"
                min="0"
                placeholder="0"
                :disabled="loading"
            />

            <small>
              Stock held for orders. It cannot exceed the quantity on hand.
            </small>

          </div>

          <!-- Reorder Level -->
          <div class="form-group">

            <label for="reorder_level">
              Reorder Level
            </label>

            <input
                id="reorder_level"
                v-model="form.reorder_level"
                type="number"
                step="0.001"
                min="0"
                placeholder="0"
                :disabled="loading"
            />

            <small>
              The stock list warns when available stock falls to this level.
            </small>

          </div>

        </div>

      </section>

      <!-- Settings (edit only) -->
      <section
          v-if="isEditMode"
          class="form-section"
      >

        <div class="section-header">
          <h2>Settings</h2>

          <p>
            Configure whether this stock record is in use.
          </p>
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
            Inactive stock records are kept but not used for stock operations.
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
          {{
            loading
                ? 'Saving...'
                : (isEditMode ? 'Update Stock' : 'Add Stock')
          }}
        </button>

      </div>

    </form>

  </div>
</template>

<style scoped>
.stock-form-page {
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

.stock-form {
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

.form-group :deep(.multiselect__spinner) {
  background: var(--color-surface);
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
