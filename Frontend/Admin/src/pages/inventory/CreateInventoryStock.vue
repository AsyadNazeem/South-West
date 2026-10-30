<script setup>

import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'

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

// Single record edit: /edit/:id   Bulk edit of one item: /edit-item/:itemId

const isEditMode = computed(() => Boolean(route.params.id))

const stockId = computed(() => route.params.id)

const isBulkEditMode = computed(() => Boolean(route.params.itemId))

const bulkEditItemId = computed(() => route.params.itemId)

const loading = ref(false)

const saved = ref(false)

const pageLoading = ref(false)

const loadFailed = ref(false)

const forbidden = ref(false)

const errorMessage = ref('')

const successMessage = ref('')

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

// Bulk edit: every stock record of one item
const bulkEditItem = ref(null)
const bulkEditRows = ref([])
const reorderForAll = ref('')

let redirectTimer = null

// The form is locked while saving and during the short pause before redirecting.
const busy = computed(() => loading.value || saved.value)

const bulkMode = computed(() =>
  isBulkRegisterMode.value && !isEditMode.value && !isBulkEditMode.value
)

const pageTitle = computed(() => {
  if (isBulkEditMode.value) return 'Bulk Edit Stock'
  return isEditMode.value ? 'Edit Stock' : 'Add Stock'
})

const pageSubtitle = computed(() => {
  if (isBulkEditMode.value) {
    return 'Update every stock record of this item in one go.'
  }

  return isEditMode.value
    ? 'Update the stock quantities for this item and location.'
    : 'Add stock for an item at an inventory location.'
})

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

// Replaces empty rows with one row for every variant not yet in the list.
const addAllVariants = () => {
  const used = new Set(
    bulkStockRows.value
      .map(row => String(row.variant_id))
      .filter(Boolean)
  )

  const remaining = itemVariants.value.filter(
    variant => !used.has(String(variant.id))
  )

  if (!remaining.length) return

  const filled = bulkStockRows.value.filter(row => row.variant_id)

  bulkStockRows.value = [
    ...filled,
    ...remaining.map(variant => ({
      ...createBulkStockRow(),
      variant_id: String(variant.id)
    }))
  ]
}

const variantLabel = (variant) =>
  [variant.variant_sku, variant.variant_name].filter(Boolean).join(' - ')

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

| Live stock summary and inline checks

|--------------------------------------------------------------------------

*/

const onHandQty = computed(() => Number(form.value.quantity_on_hand) || 0)

const reservedQty = computed(() => Number(form.value.quantity_reserved) || 0)

const reorderQty = computed(() => Number(form.value.reorder_level) || 0)

const availableQty = computed(() => onHandQty.value - reservedQty.value)

const reservedError = computed(() =>

  reservedQty.value > onHandQty.value

    ? 'Reserved quantity cannot be greater than the quantity on hand.'

    : ''

)

const stockStatus = computed(() => {

  if (onHandQty.value <= 0) return { label: 'Out of stock', tone: 'danger' }

  if (availableQty.value <= 0) return { label: 'Fully reserved', tone: 'danger' }

  if (reorderQty.value > 0 && availableQty.value <= reorderQty.value) {

    return { label: 'Low stock', tone: 'warning' }

  }

  return { label: 'In stock', tone: 'success' }

})

const formatQty = (value) =>

  Number(value).toLocaleString(undefined, { maximumFractionDigits: 3 })

// Bulk registration: how many rows are ready and the total being added

const bulkReadyCount = computed(() =>

  bulkStockRows.value.filter(row => row.variant_id).length

)

const bulkTotalOnHand = computed(() =>

  bulkStockRows.value.reduce(

    (total, row) => total + (Number(row.quantity_on_hand) || 0),

    0

  )

)

// Bulk edit: what changed compared with the saved values

const snapshotRow = (row) => ({

  reserved: Number(row.quantity_reserved),

  reorder: Number(row.reorder_level),

  active: Boolean(row.is_active)

})

const rowChanged = (row) => {

  const current = snapshotRow(row)

  return (

    current.reserved !== row.original.reserved ||

    current.reorder !== row.original.reorder ||

    current.active !== row.original.active

  )

}

const rowReservedError = (row) =>

  Number(row.quantity_reserved) > Number(row.quantity_on_hand)

const bulkEditChangedCount = computed(() =>

  bulkEditRows.value.filter(rowChanged).length

)

const applyReorderToAll = () => {

  if (reorderForAll.value === '' || Number(reorderForAll.value) < 0) return

  bulkEditRows.value.forEach((row) => {

    row.reorder_level = reorderForAll.value

  })

}

const showError = (message) => {

  errorMessage.value = message

  nextTick(() => {

    document

      .querySelector('.stock-form-page .error-message')

      ?.scrollIntoView({ behavior: 'smooth', block: 'center' })

  })

}

// Shows a success message, then returns to the list.

const finishSave = (message) => {

  saved.value = true

  successMessage.value = message

  redirectTimer = setTimeout(() => router.push(LIST_ROUTE), 900)

}

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

| Load Existing Stock Record(s)

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

// Bulk edit: every stock record that belongs to the item

const loadItemStocks = async () => {

  try {

    pageLoading.value = true

    loadFailed.value = false

    errorMessage.value = ''

    const itemId = Number(bulkEditItemId.value)

    const response = await api.get('/inventory-stock', {

      params: { item_id: itemId }

    })

    // Filter again in case the API ignores the item_id parameter

    const records = (response.data.data || []).filter(

      stock => Number(stock.item_id ?? stock.item?.id) === itemId

    )

    if (!records.length) {

      loadFailed.value = true

      errorMessage.value = 'No stock records were found for this item.'

      return

    }

    bulkEditItem.value = records[0].item || null

    bulkEditRows.value = [...records]

      .sort((a, b) =>

        String(a.variant?.variant_sku || '').localeCompare(

          String(b.variant?.variant_sku || ''),

          undefined,

          { numeric: true }

        ) ||

        String(a.location?.code || '').localeCompare(

          String(b.location?.code || ''),

          undefined,

          { numeric: true }

        )

      )

      .map((stock) => {

        const row = {

          id: stock.id,

          variant_label: stock.variant ? variantLabel(stock.variant) : 'No variant',

          location_label: stock.location

            ? `${stock.location.code} - ${stock.location.name}`

            : 'Unknown location',

          quantity_on_hand: stock.quantity_on_hand ?? 0,

          quantity_reserved: stock.quantity_reserved ?? 0,

          reorder_level: stock.reorder_level ?? 0,

          is_active: Boolean(stock.is_active)

        }

        row.original = snapshotRow(row)

        return row

      })

  } catch (error) {

    console.error('Failed to load item stock records:', error)

    loadFailed.value = true

    errorMessage.value =

        error.response?.data?.message ||

        error.message ||

        'Failed to load stock records.'

  } finally {

    pageLoading.value = false

  }

}

const retryLoad = () => (isBulkEditMode.value ? loadItemStocks() : loadStock())

/*

|--------------------------------------------------------------------------

| Submit Form

|--------------------------------------------------------------------------

*/

const submitForm = async () => {

  if (busy.value) return

  errorMessage.value = ''

  successMessage.value = ''

  if (!selectedItem.value) {

    showError('Please select an item.')

    return

  }

  if (!isEditMode.value && itemVariants.value.length && !selectedVariant.value) {

    showError('Please select a variant.')

    return

  }

  if (!form.value.location_id) {

    showError('Please select a location.')

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

    showError('Quantities must be numbers of 0 or more.')

    return

  }

  if (reserved > onHand) {

    showError('Reserved quantity cannot be greater than the quantity on hand.')

    return

  }

  loading.value = true

  try {

    if (isEditMode.value) {

      // Only stock settings may be changed on an existing record.

      const payload = {

        quantity_reserved: reserved,

        reorder_level: reorderLevel,

        is_active: form.value.is_active

      }

      await api.put(`/inventory-stock/${stockId.value}`, payload)

      finishSave('Stock record updated successfully.')

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

      finishSave('Stock record created successfully.')

    }

  } catch (error) {

    console.error(

        isEditMode.value

            ? 'Failed to update stock record:'

            : 'Failed to create stock record:',

        error

    )

    showError(

        error.response?.data?.message ||

        error.message ||

        (

            isEditMode.value

                ? 'Failed to update stock record.'

                : 'Failed to create stock record.'

        )

    )

  } finally {

    loading.value = false

  }

}

/*

|--------------------------------------------------------------------------

| Bulk Registration

|--------------------------------------------------------------------------

*/

const submitBulkStock = async () => {
  if (busy.value) return
  errorMessage.value = ''
  successMessage.value = ''

  if (isEditMode.value) {
    showError('Bulk registration is only available when creating stock.')
    return
  }
  if (!selectedItem.value?.id) {
    showError('Please select an item.')
    return
  }
  if (!form.value.location_id) {
    showError('Please select a location.')
    return
  }
  if (!bulkStockRows.value.length) {
    showError('Add at least one variant stock row.')
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
      showError(`Row ${index + 1}: please select a variant.`)
      return
    }
    if (seenVariantIds.has(variantId)) {
      showError(`Row ${index + 1}: each variant can only be registered once per submission.`)
      return
    }
    seenVariantIds.add(variantId)

    if (
      [onHand, reserved, reorderLevel].some(value => !Number.isFinite(value) || value < 0) ||
      row.quantity_on_hand === '' ||
      row.quantity_reserved === '' ||
      row.reorder_level === ''
    ) {
      showError(`Row ${index + 1}: quantities must be numbers of 0 or more.`)
      return
    }
    if (reserved > onHand) {
      showError(`Row ${index + 1}: reserved quantity cannot exceed quantity on hand.`)
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

    finishSave(`Stock registered for ${createdCount} variant(s).`)
  } catch (error) {
    console.error('Failed to bulk register inventory stock:', error)

    const reason =
      error.response?.data?.message ||
      error.message ||
      'Bulk registration failed.'

    // Rows are saved one by one, so say how far it got.
    showError(
      createdCount
        ? `${reason} ${createdCount} of ${bulkStockRows.value.length} row(s) were already saved before the error.`
        : reason
    )
  } finally {
    loading.value = false
  }
}

/*

|--------------------------------------------------------------------------

| Bulk Edit

|--------------------------------------------------------------------------

*/

const submitBulkEdit = async () => {

  if (busy.value) return

  errorMessage.value = ''

  successMessage.value = ''

  for (const row of bulkEditRows.value) {

    const reserved = Number(row.quantity_reserved)

    const reorderLevel = Number(row.reorder_level)

    const label = `${row.variant_label} at ${row.location_label}`

    if (

      [reserved, reorderLevel].some(value => !Number.isFinite(value) || value < 0) ||

      row.quantity_reserved === '' ||

      row.reorder_level === ''

    ) {

      showError(`${label}: quantities must be numbers of 0 or more.`)

      return

    }

    if (reserved > Number(row.quantity_on_hand)) {

      showError(`${label}: reserved quantity cannot exceed quantity on hand.`)

      return

    }

  }

  const changedRows = bulkEditRows.value.filter(rowChanged)

  if (!changedRows.length) {

    showError('There are no changes to save.')

    return

  }

  loading.value = true

  let updatedCount = 0

  try {

    for (const row of changedRows) {

      // Only stock settings may be changed on an existing record.

      await api.put(`/inventory-stock/${row.id}`, {

        quantity_reserved: Number(row.quantity_reserved),

        reorder_level: Number(row.reorder_level),

        is_active: Boolean(row.is_active)

      })

      // A retry after an error skips the rows that already saved

      row.original = snapshotRow(row)

      updatedCount++

    }

    finishSave(`Updated ${updatedCount} stock record(s).`)

  } catch (error) {

    console.error('Failed to bulk edit stock records:', error)

    const reason =

      error.response?.data?.message ||

      error.message ||

      'Bulk update failed.'

    showError(

      updatedCount

        ? `${reason} ${updatedCount} of ${changedRows.length} changed record(s) were already saved before the error.`

        : reason

    )

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

  const editing = isEditMode.value || isBulkEditMode.value

  const required = editing

      ? 'inventory.update'

      : 'inventory.create'

  if (!authorization(required)) {

    forbidden.value = true

    errorMessage.value =

        'You do not have permission to ' +

        (editing ? 'edit' : 'add') +

        ' inventory stock.'

    return

  }

  // Bulk edit works from the item's own stock records, so it needs no option lists

  if (isBulkEditMode.value) {

    await loadItemStocks()

    return

  }

  await Promise.all([loadItems(), loadLocations()])

  if (isEditMode.value) {

    await loadStock()

    return

  }

  // Opened from "Add Stock" on an item in the list: /create?item_id=12

  const presetItemId = Number(route.query.item_id)

  if (presetItemId) {

    const presetItem = items.value.find(

      item => Number(item.id) === presetItemId

    )

    if (presetItem) {

      selectedItem.value = presetItem

      await loadItemVariants(presetItem.id)

    }

  }

})

onBeforeUnmount(() => {

  clearTimeout(redirectTimer)

})

watch(stockId, (id) => {

  if (id && !forbidden.value) loadStock()

})

watch(bulkEditItemId, (id) => {

  if (id && !forbidden.value) loadItemStocks()

})

</script>

<template>

  <div class="stock-form-page">

    <!-- Header -->

    <div class="form-header">

      <div>

        <button type="button" class="back-link" @click="goBack">

          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">

            <path d="m15 6-6 6 6 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />

          </svg>

          Inventory stock

        </button>

        <h1>

          {{ pageTitle }}

        </h1>

        <p>

          {{ pageSubtitle }}

        </p>

      </div>

      <!-- Single or bulk (create only) -->

      <div

        v-if="!isEditMode && !isBulkEditMode && !forbidden && !pageLoading"

        class="mode-switch"

        role="group"

        aria-label="Registration mode"

      >

        <button

          type="button"

          class="mode-option"

          :class="{ active: !isBulkRegisterMode }"

          :aria-pressed="!isBulkRegisterMode"

          :disabled="busy"

          @click="isBulkRegisterMode = false"

        >

          Single stock

        </button>

        <button

          type="button"

          class="mode-option"

          :class="{ active: isBulkRegisterMode }"

          :aria-pressed="isBulkRegisterMode"

          :disabled="busy"

          @click="isBulkRegisterMode = true"

        >

          Bulk registration

        </button>

      </div>

    </div>

    <!-- Messages -->

    <div

        v-if="errorMessage && !forbidden && !loadFailed"

        class="error-message"

        role="alert"

    >

      {{ errorMessage }}

    </div>

    <div

        v-if="successMessage"

        class="success-message"

        role="status"

    >

      {{ successMessage }}

    </div>

    <!-- Loading -->

    <div

        v-if="pageLoading"

        class="loading-message"

        aria-busy="true"

    >

      <span class="spinner" aria-hidden="true"></span>

      {{ isBulkEditMode ? 'Loading stock records...' : 'Loading stock record...' }}

    </div>

    <!-- No permission -->

    <div v-else-if="forbidden" class="state-card" role="alert">

      <h2>Access denied</h2>

      <p>{{ errorMessage }}</p>

      <button type="button" class="btn-secondary" @click="goBack">

        Back to stock list

      </button>

    </div>

    <!-- Could not load the record(s) -->

    <div v-else-if="loadFailed" class="state-card" role="alert">

      <h2>Unable to load {{ isBulkEditMode ? 'these stock records' : 'this stock record' }}</h2>

      <p>{{ errorMessage }}</p>

      <div class="state-actions">

        <button type="button" class="btn-primary" @click="retryLoad">

          Try again

        </button>

        <button type="button" class="btn-secondary" @click="goBack">

          Back to stock list

        </button>

      </div>

    </div>

    <!-- Bulk edit form: all stock records of one item -->
    <form
      v-else-if="isBulkEditMode"
      class="stock-form"
      @submit.prevent="submitBulkEdit"
    >
      <section class="form-section">
        <div class="section-header">
          <h2>Item</h2>
          <p>Editing every stock record of this item.</p>
        </div>

        <div class="item-readonly">
          <strong>{{ bulkEditItem?.item_code || '-' }}</strong>
          <span>{{ bulkEditItem?.item_name || 'Unknown item' }}</span>
        </div>
      </section>

      <section class="form-section">
        <div class="section-header section-header-row">
          <div>
            <h2>Stock Records</h2>
            <p>
              Reserved quantity, reorder level and status can be changed here.
              Quantity on hand cannot.
            </p>
          </div>

          <div class="apply-all">
            <input
              v-model="reorderForAll"
              type="number"
              inputmode="decimal"
              min="0"
              step="0.001"
              placeholder="Reorder level"
              aria-label="Reorder level to apply to all records"
              :disabled="busy"
            />
            <button
              type="button"
              class="btn-secondary btn-small"
              :disabled="busy || reorderForAll === ''"
              @click="applyReorderToAll"
            >
              Apply to all
            </button>
          </div>
        </div>

        <div class="bulk-stock-list">
          <div
            v-for="row in bulkEditRows"
            :key="row.id"
            class="bulk-stock-card"
            :class="{ changed: rowChanged(row) }"
          >
            <div class="bulk-stock-card-header">
              <div class="record-title">
                <h3>{{ row.variant_label }}</h3>
                <span class="record-location">{{ row.location_label }}</span>
              </div>

              <span v-if="rowChanged(row)" class="edited-chip">Edited</span>
            </div>

            <div class="form-grid">
              <div class="form-group">
                <label :for="`edit-on-hand-${row.id}`">Quantity On Hand</label>
                <input
                  :id="`edit-on-hand-${row.id}`"
                  :value="row.quantity_on_hand"
                  type="number"
                  disabled
                />
                <small>Cannot be changed on an existing stock record.</small>
              </div>

              <div class="form-group">
                <label :for="`edit-reserved-${row.id}`">Quantity Reserved</label>
                <input
                  :id="`edit-reserved-${row.id}`"
                  v-model="row.quantity_reserved"
                  type="number"
                  inputmode="decimal"
                  min="0"
                  step="0.001"
                  required
                  :class="{ invalid: rowReservedError(row) }"
                  :aria-invalid="rowReservedError(row)"
                  :disabled="busy"
                />
                <small
                  v-if="rowReservedError(row)"
                  class="field-error"
                >
                  Cannot exceed quantity on hand.
                </small>
                <small v-else>Cannot exceed quantity on hand.</small>
              </div>

              <div class="form-group">
                <label :for="`edit-reorder-${row.id}`">Reorder Level</label>
                <input
                  :id="`edit-reorder-${row.id}`"
                  v-model="row.reorder_level"
                  type="number"
                  inputmode="decimal"
                  min="0"
                  step="0.001"
                  required
                  :disabled="busy"
                />
              </div>

              <div class="form-group bulk-active-field">
                <label>
                  <input
                    v-model="row.is_active"
                    type="checkbox"
                    :disabled="busy"
                  />
                  Active
                </label>
              </div>
            </div>
          </div>
        </div>

        <p class="bulk-summary">
          {{ bulkEditChangedCount }} of {{ bulkEditRows.length }} record(s) changed
        </p>
      </section>

      <div class="form-actions">
        <button
          type="button"
          class="btn-secondary"
          @click="goBack"
          :disabled="busy"
        >
          Cancel
        </button>
        <button
          type="submit"
          class="btn-primary"
          :disabled="busy || !bulkEditChangedCount"
        >
          {{
            loading
              ? 'Saving...'
              : (bulkEditChangedCount ? `Save ${bulkEditChangedCount} Change(s)` : 'Save Changes')
          }}
        </button>
      </div>
    </form>

    <!-- Bulk registration form -->
    <form
      v-else-if="bulkMode"
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
              :disabled="busy"
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
              :disabled="busy || locationsLoading"
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
        <div class="section-header section-header-row">
          <div>
            <h2>Variant Stock</h2>
            <p>Enter quantities for each variant. A variant can appear only once in this submission.</p>
          </div>

          <button
            type="button"
            class="btn-secondary btn-small"
            :disabled="busy || variantsLoading || !itemVariants.length"
            @click="addAllVariants"
          >
            Add all variants
          </button>
        </div>

        <p v-if="!selectedItem" class="hint-box">
          Select an item above to load its variants.
        </p>

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
                :disabled="busy"
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
                  :disabled="busy || variantsLoading || !selectedItem"
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
                    {{ variantLabel(variant) }}
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
                  inputmode="decimal"
                  min="0"
                  step="0.001"
                  required
                  :disabled="busy"
                />
              </div>

              <div class="form-group">
                <label :for="`bulk-reserved-${index}`">Quantity Reserved</label>
                <input
                  :id="`bulk-reserved-${index}`"
                  v-model="row.quantity_reserved"
                  type="number"
                  inputmode="decimal"
                  min="0"
                  step="0.001"
                  required
                  :class="{ invalid: Number(row.quantity_reserved) > Number(row.quantity_on_hand) }"
                  :disabled="busy"
                />
                <small
                  v-if="Number(row.quantity_reserved) > Number(row.quantity_on_hand)"
                  class="field-error"
                >
                  Cannot exceed quantity on hand.
                </small>
                <small v-else>Cannot exceed quantity on hand.</small>
              </div>

              <div class="form-group">
                <label :for="`bulk-reorder-${index}`">Reorder Level</label>
                <input
                  :id="`bulk-reorder-${index}`"
                  v-model="row.reorder_level"
                  type="number"
                  inputmode="decimal"
                  min="0"
                  step="0.001"
                  required
                  :disabled="busy"
                />
              </div>

              <div class="form-group bulk-active-field">
                <label>
                  <input
                    v-model="row.is_active"
                    type="checkbox"
                    :disabled="busy"
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
          :disabled="busy || variantsLoading || !itemVariants.length || bulkStockRows.length >= itemVariants.length"
          @click="addBulkStockRow"
        >
          + Add Another Variant
        </button>

        <p v-if="selectedItem && itemVariants.length" class="bulk-summary">
          {{ bulkReadyCount }} of {{ itemVariants.length }} variant(s) selected
          · Total on hand: <strong>{{ formatQty(bulkTotalOnHand) }}</strong>
        </p>
      </section>

      <div class="form-actions">
        <button
          type="button"
          class="btn-secondary"
          @click="goBack"
          :disabled="busy"
        >
          Cancel
        </button>
        <button
          type="submit"
          class="btn-primary"
          :disabled="busy || !itemVariants.length"
        >
          {{ loading ? 'Registering...' : 'Register All Stock' }}
        </button>
      </div>
    </form>

    <!-- Single stock form -->

    <form

        v-else

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

                :disabled="busy || isEditMode"

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

          </div>

          <!-- Variant -->

          <div class="form-group">

            <label for="variant_id">

              Item Variant

              <span v-if="itemVariants.length">*</span>

            </label>

            <Multiselect

              id="variant_id"

              v-model="selectedVariant"

              :options="itemVariants"

              label="variant_sku"

              track-by="id"

              :loading="variantsLoading"

              :disabled="busy || isEditMode || !selectedItem"

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

                {{ selectedItem ? 'This item has no active variants.' : 'Select an item to load its variants.' }}

              </template>

            </Multiselect>

            <small v-if="isEditMode">

              The variant cannot be changed on an existing stock record.

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

                :disabled="busy || isEditMode || locationsLoading"

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

              <span v-if="!isEditMode">*</span>

            </label>

            <input

                id="quantity_on_hand"

                v-model="form.quantity_on_hand"

                type="number"

                inputmode="decimal"

                step="0.001"

                min="0"

                placeholder="0"

                required

                :disabled="busy || isEditMode"

            />

            <small v-if="isEditMode">

              Quantity on hand cannot be changed on an existing stock record.

            </small>

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

                inputmode="decimal"

                step="0.001"

                min="0"

                placeholder="0"

                :class="{ invalid: reservedError }"

                :aria-invalid="Boolean(reservedError)"

                aria-describedby="reserved-hint"

                :disabled="busy"

            />

            <small

              id="reserved-hint"

              :class="{ 'field-error': reservedError }"

            >

              {{

                reservedError ||

                'Stock held for orders. It cannot exceed the quantity on hand.'

              }}

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

                inputmode="decimal"

                step="0.001"

                min="0"

                placeholder="0"

                :disabled="busy"

            />

            <small>

              The stock list warns when available stock falls to this level.

            </small>

          </div>

        </div>

        <!-- Live summary -->

        <div class="stock-summary" aria-live="polite">

          <div class="summary-tile">

            <span>On hand</span>

            <strong>{{ formatQty(onHandQty) }}</strong>

          </div>

          <div class="summary-tile">

            <span>Reserved</span>

            <strong>{{ formatQty(reservedQty) }}</strong>

          </div>

          <div class="summary-tile" :class="stockStatus.tone">

            <span>Available</span>

            <strong>{{ formatQty(Math.max(availableQty, 0)) }}</strong>

            <em class="status-chip">{{ stockStatus.label }}</em>

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

                :disabled="busy"

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

            :disabled="busy"

        >

          Cancel

        </button>

        <button

            type="submit"

            class="btn-primary"

            :disabled="busy"

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

  align-items: flex-end;

  justify-content: space-between;

  gap: var(--spacing-lg);

  margin-bottom: var(--spacing-2xl);

}

.form-header h1 {

  margin: 0;

  font-size: var(--font-size-2xl);

  font-weight: var(--font-weight-bold);

  color: var(--color-text-primary);

}

.form-header p {

  margin: 5px 0 0;

  font-size: var(--font-size-md);

  color: var(--color-text-secondary);

}

.back-link {

  display: inline-flex;

  align-items: center;

  gap: 4px;

  margin-bottom: var(--spacing-sm);

  padding: 0;

  border: 0;

  background: none;

  color: var(--color-text-secondary);

  cursor: pointer;

  font: inherit;

  font-size: var(--font-size-sm);

  font-weight: var(--font-weight-semibold);

  transition: color var(--transition-fast);

}

.back-link svg {

  width: 16px;

  height: 16px;

}

.back-link:hover {

  color: var(--color-primary);

}

/* Single / bulk switch */

.mode-switch {

  display: inline-flex;

  flex-shrink: 0;

  padding: 3px;

  border: 1px solid var(--color-border-light);

  border-radius: var(--radius-lg);

  background: var(--color-hover-bg);

}

.mode-option {

  height: 34px;

  padding: 0 var(--spacing-lg);

  border: 0;

  border-radius: var(--radius-lg);

  background: transparent;

  color: var(--color-text-secondary);

  cursor: pointer;

  font: inherit;

  font-size: var(--font-size-sm);

  font-weight: var(--font-weight-semibold);

  white-space: nowrap;

  transition: background var(--transition-fast), color var(--transition-fast);

}

.mode-option.active {

  background: var(--color-surface);

  color: var(--color-primary);

  box-shadow: var(--shadow-sm);

}

.mode-option:disabled {

  cursor: not-allowed;

  opacity: 0.6;

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

  margin: 0;

  font-size: var(--font-size-xl);

  font-weight: var(--font-weight-bold);

  color: var(--color-text-primary);

}

.section-header p {

  margin: 5px 0 0;

  font-size: var(--font-size-md);

  color: var(--color-text-secondary);

}

.section-header-row {

  display: flex;

  align-items: flex-start;

  justify-content: space-between;

  gap: var(--spacing-lg);

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

  min-width: 0;

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

.apply-all input {

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

.form-group input::placeholder,

.apply-all input::placeholder {

  color: var(--color-text-muted);

}

.form-group input:hover:not(:disabled),

.form-group select:hover:not(:disabled) {

  border-color: var(--color-text-muted);

}

.form-group input:focus,

.form-group select:focus,

.apply-all input:focus {

  border-color: var(--color-primary);

  box-shadow: 0 0 0 3px var(--color-primary-light);

}

.form-group input.invalid {

  border-color: var(--color-danger);

}

.form-group input.invalid:focus {

  box-shadow: 0 0 0 3px var(--color-danger-bg);

}

.form-group input:disabled,

.form-group select:disabled,

.apply-all input:disabled {

  background: var(--color-hover-bg);

  opacity: 0.7;

  cursor: not-allowed;

}

.form-group small,

.checkbox-group small {

  font-size: var(--font-size-xs);

  line-height: 1.5;

  color: var(--color-text-muted);

}

.form-group small.field-error {

  color: var(--color-danger);

  font-weight: var(--font-weight-semibold);

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

  opacity: 0.7;

}

.form-group :deep(.multiselect--disabled .multiselect__tags),

.form-group :deep(.multiselect--disabled .multiselect__current) {

  background: var(--color-hover-bg);

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

   Live stock summary

   ========================= */

.stock-summary {

  display: grid;

  grid-template-columns: repeat(3, minmax(0, 1fr));

  gap: var(--spacing-md);

  margin-top: var(--spacing-xl);

}

.summary-tile {

  display: flex;

  flex-direction: column;

  gap: 4px;

  padding: var(--spacing-md) var(--spacing-lg);

  border: 1px solid var(--color-border-light);

  border-radius: var(--radius-lg);

  background: var(--color-hover-bg);

}

.summary-tile span {

  font-size: var(--font-size-xs);

  color: var(--color-text-secondary);

}

.summary-tile strong {

  font-size: var(--font-size-xl);

  font-weight: var(--font-weight-bold);

  color: var(--color-text-primary);

}

.status-chip {

  align-self: flex-start;

  padding: 1px 8px;

  border-radius: 999px;

  font-size: var(--font-size-xs);

  font-style: normal;

  font-weight: var(--font-weight-semibold);

}

.summary-tile.success .status-chip {

  background: var(--color-success-bg, #ecfdf3);

  color: var(--color-success, #15803d);

}

.summary-tile.warning .status-chip {

  background: var(--color-warning-bg, #fffaeb);

  color: var(--color-warning, #b45309);

}

.summary-tile.danger .status-chip {

  background: var(--color-danger-bg);

  color: var(--color-danger);

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

.error-message,

.success-message {

  margin-bottom: var(--spacing-lg);

  padding: var(--spacing-md) var(--spacing-lg);

  border-radius: var(--radius-lg);

  font-size: var(--font-size-sm);

  line-height: 1.5;

}

.error-message {

  border: 1px solid var(--color-danger-light);

  background: var(--color-danger-bg);

  color: var(--color-danger);

}

.success-message {

  border: 1px solid var(--color-success-light, #abefc6);

  background: var(--color-success-bg, #ecfdf3);

  color: var(--color-success, #15803d);

  font-weight: var(--font-weight-semibold);

}

.loading-message {

  display: flex;

  align-items: center;

  justify-content: center;

  gap: var(--spacing-md);

  padding: 50px var(--spacing-xl);

  font-size: var(--font-size-sm);

  color: var(--color-text-muted);

}

.spinner {

  width: 18px;

  height: 18px;

  border: 2px solid var(--color-border);

  border-top-color: var(--color-primary);

  border-radius: 50%;

  animation: spin 0.8s linear infinite;

}

@keyframes spin {

  to {

    transform: rotate(360deg);

  }

}

.state-card {

  padding: var(--spacing-2xl) var(--spacing-xl);

  border: 1px solid var(--color-border-light);

  border-radius: var(--radius-lg);

  background: var(--color-surface);

  box-shadow: var(--shadow-sm);

  text-align: center;

}

.state-card h2 {

  margin: 0 0 var(--spacing-sm);

  font-size: var(--font-size-xl);

  font-weight: var(--font-weight-bold);

  color: var(--color-text-primary);

}

.state-card p {

  margin: 0 0 var(--spacing-xl);

  font-size: var(--font-size-md);

  color: var(--color-text-secondary);

}

.state-actions {

  display: flex;

  justify-content: center;

  flex-wrap: wrap;

  gap: var(--spacing-md);

}

.hint-box {

  margin: 0 0 var(--spacing-lg);

  padding: var(--spacing-md) var(--spacing-lg);

  border: 1px dashed var(--color-border);

  border-radius: var(--radius-lg);

  background: var(--color-hover-bg);

  color: var(--color-text-secondary);

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

.btn-small {

  height: 34px;

  padding: 0 var(--spacing-lg);

  font-size: var(--font-size-sm);

}

.btn-primary:disabled,

.btn-secondary:disabled {

  opacity: 0.6;

  cursor: not-allowed;

}

.btn-primary:focus-visible,

.btn-secondary:focus-visible,

.mode-option:focus-visible,

.back-link:focus-visible,

.add-row-button:focus-visible,

.action-button:focus-visible {

  outline: 2px solid var(--color-primary);

  outline-offset: 2px;

}

/* =========================

   Bulk registration and bulk edit

   ========================= */

.bulk-stock-list {

  display: flex;

  flex-direction: column;

  gap: var(--spacing-lg);

}

.bulk-stock-card {

  padding: var(--spacing-xl);

  border: 1px solid var(--color-border-light);

  border-radius: var(--radius-lg);

  background: var(--color-hover-bg);

  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);

}

/* Bulk edit: records with unsaved changes */

.bulk-stock-card.changed {

  border-color: var(--color-primary);

  background: var(--color-surface);

  box-shadow: inset 3px 0 0 var(--color-primary);

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

.record-title {

  display: flex;

  flex-direction: column;

  gap: 2px;

  min-width: 0;

}

.record-title h3 {

  overflow-wrap: anywhere;

}

.record-location {

  color: var(--color-text-secondary);

  font-size: var(--font-size-sm);

}

.edited-chip {

  flex-shrink: 0;

  padding: 2px 10px;

  border-radius: 999px;

  background: var(--color-primary-light);

  color: var(--color-primary);

  font-size: var(--font-size-xs);

  font-weight: var(--font-weight-semibold);

}

.item-readonly {

  display: flex;

  flex-direction: column;

  gap: 4px;

  padding: var(--spacing-md) var(--spacing-lg);

  border: 1px solid var(--color-border-light);

  border-radius: var(--radius-lg);

  background: var(--color-hover-bg);

}

.item-readonly strong {

  color: var(--color-text-primary);

  font-size: var(--font-size-md);

  font-weight: var(--font-weight-bold);

}

.item-readonly span {

  color: var(--color-text-secondary);

  font-size: var(--font-size-sm);

}

.apply-all {

  display: flex;

  align-items: center;

  gap: var(--spacing-sm);

  flex-shrink: 0;

}

.apply-all input {

  width: 150px;

}

.action-button.delete {

  padding: 4px var(--spacing-md);

  border: 1px solid transparent;

  border-radius: var(--radius-lg);

  background: transparent;

  color: var(--color-danger);

  cursor: pointer;

  font: inherit;

  font-size: var(--font-size-sm);

  font-weight: var(--font-weight-semibold);

  transition: background var(--transition-fast);

}

.action-button.delete:hover:not(:disabled) {

  background: var(--color-danger-bg);

}

.action-button.delete:disabled {

  opacity: 0.5;

  cursor: not-allowed;

}

.bulk-active-field {

  justify-content: flex-end;

}

.bulk-active-field label {

  display: flex;

  align-items: center;

  gap: var(--spacing-sm);

  height: 40px;

  cursor: pointer;

}

.bulk-active-field input {

  width: 16px;

  height: 16px;

  accent-color: var(--color-primary);

}

.add-row-button {

  width: 100%;

  margin-top: var(--spacing-lg);

  padding: 10px var(--spacing-lg);

  border: 1px dashed var(--color-primary);

  border-radius: var(--radius-lg);

  background: transparent;

  color: var(--color-primary);

  font: inherit;

  font-weight: var(--font-weight-semibold);

  cursor: pointer;

  transition: background var(--transition-fast);

}

.add-row-button:hover:not(:disabled) {

  background: var(--color-primary-light);

}

.add-row-button:disabled {

  opacity: 0.5;

  cursor: not-allowed;

}

.bulk-summary {

  margin: var(--spacing-lg) 0 0;

  color: var(--color-text-secondary);

  font-size: var(--font-size-sm);

  text-align: right;

}

.bulk-summary strong {

  color: var(--color-text-primary);

}

/* =========================

   Touch devices

   ========================= */

@media (pointer: coarse) {

  .form-group input,

  .form-group select,

  .apply-all input {

    height: 44px;

    font-size: 16px; /* stops iOS zooming into the field */

  }

  .btn-primary,

  .btn-secondary,

  .mode-option {

    height: 44px;

  }

  .btn-small {

    height: 40px;

  }

}

/* =========================

   Responsive

   ========================= */

@media (max-width: 768px) {

  .form-header {

    flex-direction: column;

    align-items: flex-start;

  }

  .mode-switch {

    width: 100%;

  }

  .mode-option {

    flex: 1;

  }

  .form-grid {

    grid-template-columns: 1fr;

  }

  .form-section {

    padding: var(--spacing-xl);

  }

  .section-header-row {

    flex-direction: column;

  }

  .section-header-row > .btn-secondary {

    width: 100%;

  }

  .apply-all {

    width: 100%;

  }

  .apply-all input {

    flex: 1;

    width: auto;

  }

  .stock-summary {

    gap: var(--spacing-sm);

  }

  .summary-tile {

    padding: var(--spacing-md);

  }

  .summary-tile strong {

    font-size: var(--font-size-md);

  }

  .bulk-summary {

    text-align: left;

  }

  /* Save buttons stay in view while scrolling a long form */

  .form-actions {

    position: sticky;

    bottom: 0;

    z-index: 5;

    flex-direction: column-reverse;

    padding: var(--spacing-md) 0;

    background: var(--color-background, var(--color-surface));

    border-top: 1px solid var(--color-border-light);

  }

  .btn-primary,

  .btn-secondary {

    width: 100%;

  }

}

@media (max-width: 380px) {

  .stock-summary {

    grid-template-columns: 1fr;

  }

}

@media (prefers-reduced-motion: reduce) {

  .spinner {

    animation-duration: 1.6s;

  }

  .form-group input,

  .form-group select,

  .btn-primary,

  .btn-secondary,

  .mode-option,

  .back-link,

  .bulk-stock-card {

    transition: none;

  }

}

</style>