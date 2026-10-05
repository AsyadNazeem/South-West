<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import Multiselect from 'vue-multiselect'
import 'vue-multiselect/dist/vue-multiselect.css'
import api from '../../api/axios'

const router = useRouter()
const route = useRoute()

const loading = ref(false)
const errorMessage = ref('')

const items = ref([])
const itemsLoading = ref(false)
const selectedItem = ref(null)

const isEditMode = ref(false)
const priceId = ref(null)

const form = ref({
  price_type: '',
  price: '',
  currency: 'LKR',
  effective_from: '',
  effective_to: '',
  is_active: true
})

const itemLabel = (item) => {
  return `${item.item_code} - ${item.item_name}`
}

/*
|--------------------------------------------------------------------------
| Load Items
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

/*
|--------------------------------------------------------------------------
| Load Existing Item Price
|--------------------------------------------------------------------------
*/

const loadItemPrice = async () => {
  try {
    loading.value = true
    errorMessage.value = ''

    const response = await api.get(`/item-prices/${priceId.value}`)

    const itemPrice = response.data.data

    if (!itemPrice) {
      errorMessage.value = 'Item price not found.'
      return
    }

    /*
     * Select the matching item from the already loaded items.
     */
    selectedItem.value =
        items.value.find(
            item => Number(item.id) === Number(itemPrice.item_id)
        ) || null

    form.value = {
      price_type: itemPrice.price_type || '',
      price: itemPrice.price ?? '',
      currency: itemPrice.currency || 'LKR',
      effective_from: itemPrice.effective_from
          ? itemPrice.effective_from.substring(0, 10)
          : '',
      effective_to: itemPrice.effective_to
          ? itemPrice.effective_to.substring(0, 10)
          : '',
      is_active: Boolean(itemPrice.is_active)
    }
  } catch (error) {
    console.error('Failed to load item price:', error)

    errorMessage.value =
        error.response?.data?.message ||
        error.message ||
        'Failed to load item price.'
  } finally {
    loading.value = false
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

    if (!form.value.price_type) {
      errorMessage.value = 'Please select a price type.'
      return
    }

    if (
        form.value.effective_from &&
        form.value.effective_to &&
        form.value.effective_to < form.value.effective_from
    ) {
      errorMessage.value =
          'Effective To date cannot be before Effective From date.'
      return
    }

    if (
        form.value.price === '' ||
        form.value.price === null ||
        Number(form.value.price) < 0
    ) {
      errorMessage.value = 'Please enter a valid price.'
      return
    }

    const payload = {
      item_id: Number(selectedItem.value.id),
      price_type: form.value.price_type,
      price: Number(form.value.price),
      currency: form.value.currency,
      effective_from: form.value.effective_from || null,
      effective_to: form.value.effective_to || null,
      is_active: form.value.is_active
    }

    if (isEditMode.value) {
      await api.put(
          `/item-prices/${priceId.value}`,
          payload
      )

      alert('Item price updated successfully.')
    } else {
      await api.post(
          '/item-prices',
          payload
      )

      alert('Item price created successfully.')
    }

    router.push('/admin/products/item-prices')
  } catch (error) {
    console.error(
        isEditMode.value
            ? 'Failed to update item price:'
            : 'Failed to create item price:',
        error
    )

    errorMessage.value =
        error.response?.data?.message ||
        error.message ||
        (
            isEditMode.value
                ? 'Failed to update item price.'
                : 'Failed to create item price.'
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
  router.push('/admin/products/item-prices')
}

/*
|--------------------------------------------------------------------------
| Page Initialization
|--------------------------------------------------------------------------
*/

onMounted(async () => {
  /*
   * First determine whether this is Create or Edit.
   */
  if (route.params.id) {
    isEditMode.value = true
    priceId.value = route.params.id
  }

  /*
   * Load items first so the correct item
   * can be selected when editing.
   */
  await loadItems()

  /*
   * If editing, load the existing item price.
   */
  if (isEditMode.value) {
    await loadItemPrice()
  }
})
</script>

<template>
  <div class="item-price-form-page">

    <!-- Header -->
    <div class="form-header">
      <div>
        <h1>
          {{ isEditMode ? 'Edit Item Price' : 'Create Item Price' }}
        </h1>

        <p>
          {{
            isEditMode
                ? 'Update the pricing details for this item.'
                : 'Add a price for an item.'
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

    <!-- Form -->
    <form
        class="item-price-form"
        @submit.prevent="submitForm"
    >

      <!-- Item -->
      <section class="form-section">

        <div class="section-header">
          <h2>Item</h2>

          <p>
            Search and select the item this price belongs to.
          </p>
        </div>

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
              :options-limit="200"
              :show-labels="false"
              placeholder="Search by item code or name..."
              :disabled="loading"
          >
            <template #noResult>
              No items found.
            </template>

            <template #noOptions>
              No items available.
            </template>
          </Multiselect>

        </div>

      </section>

      <!-- Pricing -->
      <section class="form-section">

        <div class="section-header">
          <h2>Pricing</h2>

          <p>
            Define the price type, amount and currency.
          </p>
        </div>

        <div class="form-grid">

          <!-- Price Type -->
          <div class="form-group">

            <label for="price_type">
              Price Type
              <span>*</span>
            </label>

            <select
                id="price_type"
                v-model="form.price_type"
                required
                :disabled="loading"
            >
              <option value="" disabled>
                Select price type
              </option>

              <option value="cost">
                Cost Price
              </option>

              <option value="selling">
                Selling Price
              </option>

              <option value="wholesale">
                Wholesale Price
              </option>

              <option value="retail">
                Retail Price
              </option>

              <option value="special">
                Special Price
              </option>
            </select>

          </div>

          <!-- Currency -->
          <div class="form-group">

            <label for="currency">
              Currency
              <span>*</span>
            </label>

            <select
                id="currency"
                v-model="form.currency"
                required
                :disabled="loading"
            >
              <option value="LKR">
                LKR
              </option>

              <option value="USD">
                USD
              </option>

              <option value="AED">
                AED
              </option>

              <option value="EUR">
                EUR
              </option>

              <option value="GBP">
                GBP
              </option>
            </select>

          </div>

          <!-- Price -->
          <div class="form-group">

            <label for="price">
              Price
              <span>*</span>
            </label>

            <input
                id="price"
                v-model="form.price"
                type="number"
                step="0.01"
                min="0"
                placeholder="Enter price"
                required
                :disabled="loading"
            />

          </div>

        </div>

      </section>

      <!-- Validity -->
      <section class="form-section">

        <div class="section-header">
          <h2>Validity</h2>

          <p>
            Optionally limit the period during which this price applies.
          </p>
        </div>

        <div class="form-grid">

          <!-- Effective From -->
          <div class="form-group">

            <label for="effective_from">
              Effective From
            </label>

            <input
                id="effective_from"
                v-model="form.effective_from"
                type="date"
                :disabled="loading"
            />

          </div>

          <!-- Effective To -->
          <div class="form-group">

            <label for="effective_to">
              Effective To
            </label>

            <input
                id="effective_to"
                v-model="form.effective_to"
                type="date"
                :min="form.effective_from || undefined"
                :disabled="loading"
            />

          </div>

        </div>

      </section>

      <!-- Settings -->
      <section class="form-section">

        <div class="section-header">
          <h2>Settings</h2>

          <p>
            Configure whether this price can be used in the system.
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
            Inactive prices will not be applied in selling operations.
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
                : (isEditMode ? 'Update Item Price' : 'Create Item Price')
          }}
        </button>

      </div>

    </form>

  </div>
</template>

<style scoped>
.item-price-form-page {
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

.item-price-form {
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

.form-group :deep(.multiselect__content) {
  padding: 0;
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
   Error
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
