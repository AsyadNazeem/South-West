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

const itemVariants = ref([])

const variantsLoading = ref(false)

const selectedVariant = ref(null)

// Bulk registration is available when creating stock records.
const isBulkRegisterMode = ref(false)
const bulkStockRows = ref([createBulkStockRow()])

function createBulkStockRow() {
  return {
    variant_id: '',
    quantity_on_hand: 0,
    quantity_reserved: 0,
    reorder_level: 0,
    is_active: true
  }
}

const addBulkStockRow = () => {
  bulkStockRows.value.push(createBulkStockRow())
}

const removeBulkStockRow = (index) => {
  if (bulkStockRows.value.length > 1) {
    bulkStockRows.value.splice(index, 1)
  }
}

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

const loadItemVariants = async (itemId, preferredVariantId = null) => {

  itemVariants.value = []

  selectedVariant.value = null

  if (!itemId) return

  try {

    variantsLoading.value = true

    const response = await api.get(`/items/${itemId}/variants`)

    const variants = response.data.data || []

    itemVariants.value = variants.filter(

      variant =>

        variant.is_active ||

        Number(variant.id) === Number(preferredVariantId)

    )

    selectedVariant.value =

      itemVariants.value.find(

        variant => Number(variant.id) === Number(preferredVariantId)

      ) ||

      itemVariants.value.find(variant => variant.is_default) ||

      null

  } catch (error) {

    console.error('Failed to load item variants:', error)

    errorMessage.value =

      error.response?.data?.message || 'Failed to load item variants.'

  } finally {

    variantsLoading.value = false

  }

}

const onItemChange = async item => {

  selectedVariant.value = null

  itemVariants.value = []

  if (isBulkRegisterMode.value) {
    bulkStockRows.value = [createBulkStockRow()]
  }

  if (item?.id) {

    await loadItemVariants(item.id)

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

        await loadItemVariants(

  stock.item_id,

  stock.variant_id ?? stock.variant?.id ?? null

)

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

    if (isEditMode.value) {

      // Only stock settings may be changed on an existing record.

      const payload = {

        quantity_reserved: reserved,

        reorder_level: reorderLevel,

        is_active: form.value.is_active

      }

      await api.put(`/inventory-stock/${stockId.value}`, payload)

      alert('Stock record updated successfully.')

    } else {

      // Creating a stock record requires item, location and initial quantities.

      const payload = {

  item_id: Number(selectedItem.value.id),

variant_id: selectedVariant.value?.id

  ? Number(selectedVariant.value.id)

  : null,

  location_id: Number(form.value.location_id),

  quantity_on_hand: onHand,

  quantity_reserved: reserved,

  reorder_level: reorderLevel,

  is_active: form.value.is_active

}

      await api.post('/inventory-stock', payload)

      alert('Stock record created successfully.')

    }

    router.push(LIST_ROUTE)

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

const submitBulkStock = async () => {
  if (loading.value) return
  errorMessage.value = ''

  if (isEditMode.value) {
    errorMessage.value = 'Bulk registration is only available when creating stock.'
    return
  }
  if (!selectedItem.value?.id) {
    errorMessage.value = 'Please select an item.'
    return
  }
  if (!form.value.location_id) {
    errorMessage.value = 'Please select a location.'
    return
  }
  if (!bulkStockRows.value.length) {
    errorMessage.value = 'Add at least one variant stock row.'
    return
  }

  const seenVariantIds = new Set()
  for (let index = 0; index < bulkStockRows.value.length; index++) {
    const row = bulkStockRows.value[index]
    const variantId = Number(row.variant_id)
    const onHand = Number(row.quantity_on_hand)
    const reserved = Number(row.quantity_reserved)
    const reorderLevel = Number(row.reorder_level)

    if (!Number.isInteger(variantId) || variantId <= 0) {
      errorMessage.value = `Row ${index + 1}: please select a variant.`
      return
    }
    if (seenVariantIds.has(variantId)) {
      errorMessage.value = `Row ${index + 1}: each variant can only be registered once per submission.`
      return
    }
    seenVariantIds.add(variantId)

    if (
      [onHand, reserved, reorderLevel].some(value => !Number.isFinite(value) || value < 0) ||
      row.quantity_on_hand === '' ||
      row.quantity_reserved === '' ||
      row.reorder_level === ''
    ) {
      errorMessage.value = `Row ${index + 1}: quantities must be numbers of 0 or more.`
      return
    }
    if (reserved > onHand) {
      errorMessage.value = `Row ${index + 1}: reserved quantity cannot exceed quantity on hand.`
      return
    }
  }

  loading.value = true
  let createdCount = 0

  try {
    for (const row of bulkStockRows.value) {
      await api.post('/inventory-stock', {
        item_id: Number(selectedItem.value.id),
        variant_id: Number(row.variant_id),
        location_id: Number(form.value.location_id),
        quantity_on_hand: Number(row.quantity_on_hand),
        quantity_reserved: Number(row.quantity_reserved),
        reorder_level: Number(row.reorder_level),
        is_active: Boolean(row.is_active)
      })
      createdCount++
    }

    alert(`Successfully registered stock for ${createdCount} variant(s).`)
    router.push(LIST_ROUTE)
  } catch (error) {
    console.error('Failed to bulk register inventory stock:', error)
    errorMessage.value =
      error.response?.data?.message ||
      error.message ||
      `Bulk registration stopped after ${createdCount} of ${bulkStockRows.value.length} row(s). Earlier rows may already have been saved.`
  } finally {
    loading.value = false
  }
}

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

      <div class="header-actions">
        <button
          v-if="!isEditMode"
          type="button"
          class="btn-secondary"
          :disabled="loading"
          @click="isBulkRegisterMode = !isBulkRegisterMode"
        >
          {{ isBulkRegisterMode ? 'Single Registration' : 'Bulk Registration' }}
        </button>

        <button
          type="button"
          class="btn-secondary"
          @click="goBack"

          :disabled="loading"

      >

          Cancel
        </button>
      </div>

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

    <!-- Bulk registration form -->
    <form
      v-else-if="!forbidden && !loadFailed && isBulkRegisterMode"
      class="stock-form"
      @submit.prevent="submitBulkStock"
    >
      <section class="form-section">
        <div class="section-header">
          <h2>Item &amp; Location</h2>
          <p>Select one item and location, then register stock for multiple variants.</p>
        </div>
        <div class="form-grid">
          <div class="form-group">
            <label for="bulk-item">Item <span>*</span></label>
            <Multiselect
              id="bulk-item"
              v-model="selectedItem"
              :options="items"
              :custom-label="itemLabel"
              track-by="id"
              :loading="itemsLoading"
              :disabled="loading"
              :options-limit="200"
              :show-labels="false"
              placeholder="Search by item code or name..."
              @select="onItemChange"
            >
              <template #noResult>No items found.</template>
              <template #noOptions>No items available.</template>
            </Multiselect>
          </div>
          <div class="form-group">
            <label for="bulk-location">Location <span>*</span></label>
            <select
              id="bulk-location"
              v-model="form.location_id"
              required
              :disabled="loading || locationsLoading"
            >
              <option value="" disabled>Select location</option>
              <option
                v-for="location in availableLocations"
                :key="location.id"
                :value="location.id"
              >
                {{ location.code }} - {{ location.name }}
              </option>
            </select>
          </div>
        </div>
      </section>

      <section class="form-section">
        <div class="section-header">
          <h2>Variant Stock</h2>
          <p>Enter quantities for each variant. A variant can appear only once in this submission.</p>
        </div>

        <div class="bulk-stock-list">
          <div
            v-for="(row, index) in bulkStockRows"
            :key="index"
            class="bulk-stock-card"
          >
            <div class="bulk-stock-card-header">
              <h3>Variant {{ index + 1 }}</h3>
              <button
                v-if="bulkStockRows.length > 1"
                type="button"
                class="action-button delete"
                :disabled="loading"
                @click="removeBulkStockRow(index)"
              >
                Remove
              </button>
            </div>

            <div class="form-grid">
              <div class="form-group">
                <label :for="`bulk-variant-${index}`">Item Variant <span>*</span></label>
                <select
                  :id="`bulk-variant-${index}`"
                  v-model="row.variant_id"
                  required
                  :disabled="loading || variantsLoading || !selectedItem"
                >
                  <option value="">Select a variant</option>
                  <option
                    v-for="variant in itemVariants"
                    :key="variant.id"
                    :value="String(variant.id)"
                    :disabled="bulkStockRows.some((other, otherIndex) =>
                      otherIndex !== index &&
                      String(other.variant_id) === String(variant.id)
                    )"
                  >
                    {{ variant.variant_sku }} - {{ variant.variant_name }}
                    {{ variant.is_default ? '(Default)' : '' }}
                  </option>
                </select>
                <small v-if="variantsLoading">Loading variants...</small>
                <small v-else-if="selectedItem && !itemVariants.length">
                  This item has no active variants.
                </small>
              </div>

              <div class="form-group">
                <label :for="`bulk-on-hand-${index}`">Quantity On Hand <span>*</span></label>
                <input
                  :id="`bulk-on-hand-${index}`"
                  v-model="row.quantity_on_hand"
                  type="number"
                  min="0"
                  step="0.001"
                  required
                  :disabled="loading"
                />
              </div>

              <div class="form-group">
                <label :for="`bulk-reserved-${index}`">Quantity Reserved</label>
                <input
                  :id="`bulk-reserved-${index}`"
                  v-model="row.quantity_reserved"
                  type="number"
                  min="0"
                  step="0.001"
                  required
                  :disabled="loading"
                />
                <small>Cannot exceed quantity on hand.</small>
              </div>

              <div class="form-group">
                <label :for="`bulk-reorder-${index}`">Reorder Level</label>
                <input
                  :id="`bulk-reorder-${index}`"
                  v-model="row.reorder_level"
                  type="number"
                  min="0"
                  step="0.001"
                  required
                  :disabled="loading"
                />
              </div>

              <div class="form-group bulk-active-field">
                <label>
                  <input
                    v-model="row.is_active"
                    type="checkbox"
                    :disabled="loading"
                  />
                  Active
                </label>
              </div>
            </div>
          </div>
        </div>

        <button
          type="button"
          class="add-row-button"
          :disabled="loading || variantsLoading || !itemVariants.length || bulkStockRows.length >= itemVariants.length"
          @click="addBulkStockRow"
        >
          + Add Another Variant
        </button>
      </section>

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
          :disabled="loading || !itemVariants.length"
        >
          {{ loading ? 'Registering...' : 'Register All Stock' }}
        </button>
      </div>
    </form>

    <!-- Single stock form -->

    <form

        v-else-if="!forbidden && !loadFailed && !isBulkRegisterMode"

        class="stock-form"

        @submit.prevent="submitForm"

    >

      <!-- Item & Location -->

      <section class="form-section">

        <div class="section-header">

          <h2>Item & Location</h2>

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

                @select="onItemChange"

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

            <!-- Variant -->

<div class="form-group">

  <label for="variant_id">

    Item Variant

    <span>*</span>

  </label>

  <Multiselect

    id="variant_id"

    v-model="selectedVariant"

    :options="itemVariants"

    label="variant_sku"

    track-by="id"

    :loading="variantsLoading"

    :disabled="loading || isEditMode || !selectedItem"

    :options-limit="200"

    :show-labels="false"

    placeholder="Select a variant..."

  >

    <template #option="{ option }">

      <div>

        <strong>{{ option.variant_sku }}</strong>

        <small v-if="option.variant_name">

          — {{ option.variant_name }}

        </small>

      </div>

    </template>

    <template #noResult>

      No variants found.

    </template>

    <template #noOptions>

      Select an item to load its variants.

    </template>

  </Multiselect>

  <small v-if="isEditMode">

    The variant cannot be changed on an existing stock record.

  </small>

</div>

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

@.header-actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.bulk-stock-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.bulk-stock-card {
  padding: var(--spacing-xl);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}

.bulk-stock-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
}

.bulk-stock-card-header h3 {
  margin: 0;
  color: var(--color-text-primary);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
}

.bulk-active-field label {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.bulk-active-field input {
  width: 16px;
  height: 16px;
}

.add-row-button {
  margin-top: var(--spacing-lg);
  padding: 10px var(--spacing-lg);
  border: 1px dashed var(--color-primary);
  border-radius: var(--radius-lg);
  background: transparent;
  color: var(--color-primary);
  font: inherit;
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
}

.add-row-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

media (max-width: 768px) {

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
