<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '@/api/axios'

const route = useRoute()
const router = useRouter()

const items = ref([])
const colors = ref([])
const specifications = ref([])
const specificationsLoading = ref(false)
const itemId = ref('')
const editingVariantId = ref(null)
const bulkEditingItemId = ref('')
const activeVariantIndex = ref(0)

const itemsLoading = ref(false)
const loadingColors = ref(false)
const saving = ref(false)
const creatingColor = ref(false)

const formError = ref('')
const success = ref('')
const colorError = ref('')
const colorSuccess = ref('')

const colorForm = ref({
  color_name: '',
  hex_code: '#000000'
})

function blankVariant() {
  return {
    variant_name: '',
    qb_item_code: '',
    color_ids: [],
    attributes: {},
    is_default: false,
    is_active: true
  }
}

const variants = ref([blankVariant()])

const isBulkEditing = computed(() => Boolean(bulkEditingItemId.value))
const isEditing = computed(() => Boolean(editingVariantId.value || bulkEditingItemId.value))

const activeVariant = computed(
  () => variants.value[activeVariantIndex.value] || null
)

function getData(response) {
  const payload = response?.data
  if (Array.isArray(payload)) return payload

  const data = payload?.data
  if (Array.isArray(data)) return data

  return data?.rows || data?.items || []
}

function addVariant() {
  const variant = blankVariant()
  applySpecificationFields(variant, false)
  variants.value.push(variant)
  activeVariantIndex.value = variants.value.length - 1
  colorError.value = ''
  colorSuccess.value = ''
}

function removeVariant(index) {
  if (saving.value || isEditing.value || variants.value.length <= 1) return

  variants.value.splice(index, 1)

  if (activeVariantIndex.value >= variants.value.length) {
    activeVariantIndex.value = variants.value.length - 1
  }

  // Keep the remaining default selection consistent.
  if (!variants.value.some(v => v.is_default)) {
    variants.value[0].is_default = true
  }
}

function toggleVariantColor(variant, colorId) {
  const id = String(colorId)
  const selected = variant.color_ids.map(String)
  if (selected.includes(id)) {
    variant.color_ids = selected.filter(value => value !== id)
    return
  }
  if (selected.length >= 2) return
  variant.color_ids = [...selected, id]
}

function setDefaultVariant(index) {
  variants.value.forEach((variant, i) => {
    variant.is_default = i === index
  })
}

function normalizeSpecificationOptions(value) {
  if (Array.isArray(value)) {
    return value.map(option => String(option).trim()).filter(Boolean)
  }
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) return parsed.map(option => String(option).trim()).filter(Boolean)
    } catch {
      // Older/manual records may contain newline-separated options.
    }
    return value.split(/\r?\n/).map(option => option.trim()).filter(Boolean)
  }
  return []
}

function applySpecificationFields(variant, preserveExisting = true) {
  const existing = preserveExisting && variant.attributes &&
    typeof variant.attributes === 'object' && !Array.isArray(variant.attributes)
    ? variant.attributes : {}
  const next = {}
  for (const spec of specifications.value) next[spec.name] = existing[spec.name] ?? ''
  // Preserve legacy keys so editing old variants does not silently discard data.
  for (const [key, value] of Object.entries(existing)) {
    if (!specifications.value.some(spec => spec.name === key)) next[key] = value ?? ''
  }
  variant.attributes = next
}

function buildAttributes(variant) {
  const result = {}
  for (const spec of specifications.value) {
    const raw = variant.attributes?.[spec.name]
    const value = raw === null || raw === undefined ? '' : String(raw).trim()
    if (spec.is_required && !value) throw new Error(`Variant "${variant.variant_name}": ${spec.name} is required.`)
    if (value) result[spec.name] = value
  }
  for (const [key, raw] of Object.entries(variant.attributes || {})) {
    if (!specifications.value.some(spec => spec.name === key)) {
      const value = raw === null || raw === undefined ? '' : String(raw).trim()
      if (value) result[key] = value
    }
  }
  return result
}

async function loadItemSpecifications(id) {
  specifications.value = []
  if (!id) return
  specificationsLoading.value = true
  try {
    const selectedItem = items.value.find(item => String(item.id) === String(id))
    const detailResponse = await api.get(`/items/${id}`)
    const payload = detailResponse?.data
    const item = payload?.data?.item || payload?.data || payload?.item || payload
    const itemTypeId = item?.item_type_id ?? selectedItem?.item_type_id
    if (!itemTypeId) {
      variants.value.forEach(variant => { variant.attributes = {} })
      return
    }
    const response = await api.get(`/item-type-specifications/item-type/${itemTypeId}`)
    specifications.value = getData(response).map(record => {
      const spec = record.specification || {}
      return {
        id: Number(record.specification_id ?? spec.id),
        name: String(spec.name || '').trim(),
        code: spec.code || '',
        data_type: spec.data_type || 'text',
        unit: spec.unit || '',
        options: normalizeSpecificationOptions(spec.options),
        is_required: Boolean(record.is_required ?? spec.is_required)
      }
    }).filter(spec => spec.id && spec.name)
      // Colour is handled through the colour picker and variant-colour relation.
      .filter(spec => !['color', 'colour', 'colors', 'colours'].includes(spec.name.toLowerCase()))
    variants.value.forEach(variant => applySpecificationFields(variant))
  } catch (error) {
    specifications.value = []
    formError.value = error.response?.data?.message || 'Failed to load item specifications.'
  } finally {
    specificationsLoading.value = false
  }
}

async function loadItems() {
  itemsLoading.value = true

  try {
    items.value = getData(await api.get('/items'))
  } catch (error) {
    formError.value =
      error.response?.data?.message || 'Failed to load items.'
  } finally {
    itemsLoading.value = false
  }
}

async function loadItemColors(id) {
  colors.value = []
  if (!id) return

  loadingColors.value = true

  try {
    colors.value = getData(await api.get(`/items/${id}/colors`))
      .map(color => ({
        ...color,
        hex_code: String(color.hex_code || '#000000').toUpperCase()
      }))
  } catch (error) {
    formError.value =
      error.response?.data?.message || 'Failed to load item colours.'
  } finally {
    loadingColors.value = false
  }
}

async function handleItemChange() {
  formError.value = ''
  success.value = ''
  colorError.value = ''
  colorSuccess.value = ''
  specifications.value = []
  variants.value = [blankVariant()]
  activeVariantIndex.value = 0
  await Promise.all([loadItemSpecifications(itemId.value), loadItemColors(itemId.value)])
}

async function createColor() {
  colorError.value = ''
  colorSuccess.value = ''

  if (!itemId.value) {
    colorError.value = 'Select an item first.'
    return
  }

  const colorName = colorForm.value.color_name.trim()
  const hexCode = colorForm.value.hex_code.toUpperCase()

  if (!colorName) {
    colorError.value = 'Colour name is required.'
    return
  }

  if (!/^#[0-9A-F]{6}$/.test(hexCode)) {
    colorError.value = 'Enter a valid HEX colour.'
    return
  }

  creatingColor.value = true

  try {
    const response = await api.post(`/items/${itemId.value}/colors`, {
      color_name: colorName,
      hex_code: hexCode
    })

    const payload = response.data?.data ?? response.data
    const created = payload?.color ?? payload

    await loadItemColors(itemId.value)

    const matchingColor = colors.value.find(color =>
      String(color.id) === String(created?.id ?? created?.color_id) ||
      (
        color.color_name?.toLowerCase() === colorName.toLowerCase() &&
        color.hex_code?.toUpperCase() === hexCode
      )
    )

    if (matchingColor && activeVariant.value) {
      const ids = activeVariant.value.color_ids
      if (!ids.includes(String(matchingColor.id))) {
        ids.push(String(matchingColor.id))
      }
    }

    colorForm.value = {
      color_name: '',
      hex_code: '#000000'
    }

    colorSuccess.value = 'Colour created successfully.'
  } catch (error) {
    colorError.value =
      error.response?.data?.message || 'Failed to create colour.'
  } finally {
    creatingColor.value = false
  }
}

async function saveVariants() {
  formError.value = ''
  success.value = ''

  if (!itemId.value) {
    formError.value = 'Select an item.'
    return
  }

  if (!variants.value.length) {
    formError.value = 'Add at least one variant.'
    return
  }

  if (
    (!isEditing.value || isBulkEditing.value) &&
    variants.value.filter(v => v.is_default).length !== 1
  ) {
    formError.value = 'Select exactly one default variant.'
    return
  }

  let payload

  try {
    payload = variants.value.map((variant, index) => {
      const name = variant.variant_name.trim()

      if (!name) {
        throw new Error(`Enter a name for variant ${index + 1}.`)
      }

      const selectedIds = variant.color_ids.map(String)

      if (selectedIds.length > 2) {
        throw new Error(`Variant "${name}" can have a maximum of two colours.`)
      }

      if (
        new Set(selectedIds).size !== selectedIds.length ||
        selectedIds.some(id => !colors.value.some(c => String(c.id) === id))
      ) {
        throw new Error(`Variant "${name}" has an invalid colour selection.`)
      }

      return {
        ...(isBulkEditing.value ? { id: variant.id } : {}),
        variant_name: name,
        qb_item_code: variant.qb_item_code.trim() || null,
        attributes: buildAttributes(variant),
        color_ids: selectedIds,
        is_default: Boolean(variant.is_default),
        is_active: Boolean(variant.is_active)
      }
    })
  } catch (error) {
    formError.value = error.message
    return
  }

  saving.value = true

  try {
    if (isBulkEditing.value) {
      const ordered = [
        ...payload.filter(v => !v.is_default),
        ...payload.filter(v => v.is_default)
      ]

      for (const variant of ordered) {
        if (!variant.id) throw new Error('A variant ID is missing. Reload and try again.')

        await api.put(`/items/${itemId.value}/variants/${variant.id}`, {
          variant_name: variant.variant_name,
          qb_item_code: variant.qb_item_code,
          attributes: variant.attributes,
          is_default: variant.is_default,
          is_active: variant.is_active
        })

        await api.put(
          `/items/${itemId.value}/variants/${variant.id}/colors`,
          { color_ids: variant.color_ids }
        )
      }

      success.value = `${payload.length} variants updated successfully.`
    } else if (isEditing.value) {
      const variant = payload[0]
      const variantId = editingVariantId.value

      await api.put(`/items/${itemId.value}/variants/${variantId}`, {
        variant_name: variant.variant_name,
        qb_item_code: variant.qb_item_code,
        attributes: variant.attributes,
        is_default: variant.is_default,
        is_active: variant.is_active
      })

      await api.put(
        `/items/${itemId.value}/variants/${variantId}/colors`,
        { color_ids: variant.color_ids }
      )

      success.value = 'Variant updated successfully.'
    } else {
      const response = await api.post(
        `/items/${itemId.value}/variants/bulk`,
        { variants: payload }
      )

      const created = response.data?.data

      if (!Array.isArray(created) || created.length !== payload.length) {
        throw new Error(
          'Please verify the server response before submitting again.'
        )
      }

      success.value = `${created.length} variants created successfully.`
    }

    variants.value = [blankVariant()]
    activeVariantIndex.value = 0
    editingVariantId.value = null
    bulkEditingItemId.value = ''
    colorForm.value = { color_name: '', hex_code: '#000000' }
    colorError.value = ''
    colorSuccess.value = ''
  } catch (error) {
    formError.value =
      error.response?.data?.message ||
      error.message ||
      'Failed to save variants.'
  } finally {
    saving.value = false
  }
}

async function loadBulkVariantsForEdit(targetItemId) {
  bulkEditingItemId.value = String(targetItemId)
  itemsLoading.value = true
  formError.value = ''

  try {
    items.value = getData(await api.get('/items'))
    const item = items.value.find(v => String(v.id) === String(targetItemId))
    if (!item) throw new Error('Item not found.')

    itemId.value = String(item.id)
    await loadItemSpecifications(itemId.value)
    await loadItemColors(itemId.value)

    const existing = getData(await api.get(`/items/${itemId.value}/variants`))
    if (!existing.length) throw new Error('This item has no variants to edit.')

    const loaded = []
    for (const variant of existing) {
      const response = await api.get(
        `/items/${itemId.value}/variants/${variant.id}/colors`
      )
      const result = response.data?.data ?? response.data
      const assigned = Array.isArray(result) ? result
        : Array.isArray(result?.colors) ? result.colors
        : result?.color ? [result.color] : []

      const entry = {
        id: variant.id,
        variant_name: variant.variant_name || '',
        qb_item_code: variant.qb_item_code || '',
        color_ids: assigned
          .map(c => String(c.color_id ?? c.color?.id ?? c.id))
          .filter(id => colors.value.some(c => String(c.id) === id)),
        attributes: variant.attributes && typeof variant.attributes === 'object'
          ? { ...variant.attributes } : {},
        is_default: Boolean(variant.is_default),
        is_active: Boolean(variant.is_active)
      }
      applySpecificationFields(entry)
      loaded.push(entry)
    }

    variants.value = loaded
    activeVariantIndex.value = 0
  } catch (error) {
    formError.value = error.response?.data?.message || error.message ||
      'Failed to load variants for bulk editing.'
  } finally {
    itemsLoading.value = false
  }
}

async function loadVariantForEdit() {
  if (route.query.bulkEdit === '1' && route.query.itemId) {
    await loadBulkVariantsForEdit(route.query.itemId)
    return
  }
  const variantId = route.params.id || route.query.id
  if (!variantId) return

  editingVariantId.value = String(variantId)
  itemsLoading.value = true

  try {
    items.value = getData(await api.get('/items'))

    let foundVariant = null
    let foundItemId = null

    for (const item of items.value) {
      const list = getData(await api.get(`/items/${item.id}/variants`))
      const found = list.find(v => String(v.id) === String(variantId))

      if (found) {
        foundVariant = found
        foundItemId = String(item.id)
        break
      }
    }

    if (!foundVariant) throw new Error('Variant not found.')

    itemId.value = foundItemId
    await loadItemSpecifications(foundItemId)

    variants.value = [{
      variant_name: foundVariant.variant_name || '',
      qb_item_code: foundVariant.qb_item_code || '',
      color_ids: [],
      attributes: foundVariant.attributes && typeof foundVariant.attributes === 'object'
        ? { ...foundVariant.attributes } : {},
      is_default: Boolean(foundVariant.is_default),
      is_active: Boolean(foundVariant.is_active)
    }]
    applySpecificationFields(variants.value[0])

    await loadItemColors(foundItemId)

    const response = await api.get(
      `/items/${foundItemId}/variants/${variantId}/colors`
    )

    const result = response.data?.data ?? response.data
    const assigned = Array.isArray(result)
      ? result
      : Array.isArray(result?.colors)
        ? result.colors
        : result?.color
          ? [result.color]
          : []

    variants.value[0].color_ids = assigned
      .map(c => String(c.color_id ?? c.color?.id ?? c.id))
      .filter(id => colors.value.some(c => String(c.id) === id))
  } catch (error) {
    formError.value =
      error.response?.data?.message ||
      error.message ||
      'Failed to load variant.'
  } finally {
    itemsLoading.value = false
  }
}

function resetForm() {
  if (saving.value || creatingColor.value) return

  itemId.value = ''
  variants.value = [blankVariant()]
  activeVariantIndex.value = 0
  editingVariantId.value = null
  bulkEditingItemId.value = ''
  colors.value = []
  specifications.value = []
  specificationsLoading.value = false
  formError.value = ''
  success.value = ''
  colorError.value = ''
  colorSuccess.value = ''
  colorForm.value = { color_name: '', hex_code: '#000000' }
}

function cancelForm() {
  if (saving.value || creatingColor.value) return
  router.back()
}

onMounted(async () => {
  if (route.query.bulkEdit === '1' && route.query.itemId) {
    await loadVariantForEdit()
  } else if (route.params.id || route.query.id) {
    await loadVariantForEdit()
  } else {
    await loadItems()
  }
})
</script>

<template>
  <div class="variant-form-page">

    <!-- Header -->
    <div class="form-header">
      <div>
        <h1>{{ isBulkEditing ? 'Edit All Item Variants' : isEditing ? 'Edit Variant' : 'Create Item Variants' }}</h1>

        <p>
          {{
            isEditing
              ? (isBulkEditing ? 'Update all variants for this item in one submission.' : 'Update the selected variant.')
              : 'Create multiple variants for one item in a single submission.'
          }}
        </p>
      </div>
    </div>

    <!-- Error -->
    <div v-if="formError" class="error-message">
      {{ formError }}
    </div>

    <!-- Success -->
    <div v-if="success" class="success-message">
      {{ success }}
    </div>

    <div class="variant-form">

      <!-- Item Details -->
      <section class="form-section">

        <div class="section-header">
          <h2>Item Details</h2>

          <p>Choose the item these variants belong to.</p>
        </div>

        <div class="form-group">

          <label for="item_id">
            Item
            <span class="required">*</span>
          </label>

          <select
            id="item_id"
            v-model="itemId"
            required
            :disabled="itemsLoading || isEditing || saving"
            @change="handleItemChange"
          >
            <option value="" disabled>
              {{ itemsLoading ? 'Loading items...' : 'Select item...' }}
            </option>

            <option
              v-for="item in items"
              :key="item.id"
              :value="String(item.id)"
            >
              {{ item.item_code ? item.item_code + ' - ' : '' }}{{ item.item_name }}
            </option>
          </select>

        </div>

      </section>

      <!-- Colour Creator -->
      <section class="form-section">

        <div class="section-header">
          <h2>Colour Creator</h2>

          <p>Create an item colour and assign it to the currently selected variant.</p>
        </div>

        <div class="form-grid">

          <div class="form-group">

            <label for="color_name">
              Colour name
            </label>

            <input
              id="color_name"
              v-model="colorForm.color_name"
              type="text"
              maxlength="50"
              placeholder="e.g. Midnight Black"
              :disabled="!itemId || saving || creatingColor"
            />

          </div>

          <div class="form-group">

            <label for="hex_code">
              HEX colour
            </label>

            <div class="hex-input-row">

              <input
                v-model="colorForm.hex_code"
                type="color"
                class="color-picker"
                aria-label="Choose colour"
                :disabled="!itemId || saving || creatingColor"
              />

              <input
                id="hex_code"
                v-model="colorForm.hex_code"
                type="text"
                maxlength="7"
                placeholder="#000000"
                :disabled="!itemId || saving || creatingColor"
              />

            </div>

          </div>

        </div>

        <div class="section-actions">
          <button
            type="button"
            class="btn-primary"
            :disabled="!itemId || saving || creatingColor"
            @click="createColor"
          >
            {{ creatingColor ? 'Creating...' : 'Create Colour' }}
          </button>
        </div>

        <div v-if="colorError" class="error-message inline-message">
          {{ colorError }}
        </div>

        <div v-if="colorSuccess" class="success-message inline-message">
          {{ colorSuccess }}
        </div>

      </section>

      <!-- Variant Details -->
      <form
        class="variant-section"
        @submit.prevent="saveVariants"
      >

        <div class="section-header section-header-row">

          <div>
            <h2>Variant Details</h2>

            <p v-if="!isEditing">Add a row for each variant you want to create.</p>
          </div>

          <button
            v-if="!isEditing || isBulkEditing"
            type="button"
            class="btn-secondary"
            :disabled="!itemId || saving"
            @click="addVariant"
          >
            + Add Variant
          </button>

        </div>

        <p v-if="!itemId" class="helper-note">
          Select an item before entering variant details.
        </p>

        <section
          v-for="(variant, index) in variants"
          :key="index"
          class="variant-card"
        >

          <div class="variant-heading">

            <h3>
              Variant {{ index + 1 }}

              <span
                v-if="variant.is_default"
                class="status-badge default"
              >
                Default
              </span>
            </h3>

            <button
              type="button"
              class="action-button delete"
              :disabled="saving || variants.length <= 1 || (isEditing && !isBulkEditing)"
              @click="removeVariant(index)"
            >
              Remove
            </button>

          </div>

          <div class="form-grid">

            <!-- Variant name -->
            <div class="form-group">

              <label :for="`variant_name_${index}`">
                Variant name
                <span class="required">*</span>
              </label>

              <input
                :id="`variant_name_${index}`"
                v-model.trim="variant.variant_name"
                type="text"
                required
                maxlength="255"
                placeholder="e.g. DDR3 8GB 1600MHz"
                :disabled="saving"
              />

            </div>

            <!-- QuickBooks -->
            <div class="form-group">

              <label :for="`qb_code_${index}`">
                QuickBooks item code
              </label>

              <input
                :id="`qb_code_${index}`"
                v-model.trim="variant.qb_item_code"
                type="text"
                maxlength="100"
                placeholder="Optional"
                :disabled="saving"
              />

            </div>

            <!-- Colours -->
            <div class="form-group full-width">

              <label>
                Variant colours
              </label>

              <div class="colour-picker-list">

                <button
                  v-for="color in colors"
                  :key="color.id"
                  type="button"
                  class="colour-choice"
                  :class="{ selected: variant.color_ids.includes(String(color.id)) }"
                  :disabled="
                    !itemId ||
                    loadingColors ||
                    saving ||
                    (!variant.color_ids.includes(String(color.id)) && variant.color_ids.length >= 2)
                  "
                  @click="toggleVariantColor(variant, color.id)"
                >
                  <span
                    class="color-swatch"
                    :style="{ backgroundColor: color.hex_code || '#cccccc' }"
                  ></span>

                  <span>{{ color.color_name }}</span>

                  <span
                    v-if="variant.color_ids.includes(String(color.id))"
                    aria-hidden="true"
                  >✓</span>
                </button>

              </div>

              <small v-if="itemId && !loadingColors && !colors.length">
                No colours yet. Create one in the Colour Creator above.
              </small>

              <small v-else>
                Select one or two colours for this variant.
              </small>

            </div>

            <!-- Specifications -->
            <div class="form-group full-width">

              <label>
                Specifications
              </label>

              <p v-if="specificationsLoading" class="helper-note">
                Loading specifications for this item's type...
              </p>

              <p v-else-if="!specifications.length" class="helper-note">
                No active specifications are assigned to this item's type.
              </p>

              <div class="spec-grid">

                <div
                  v-for="spec in specifications"
                  :key="spec.id"
                  class="form-group"
                >

                  <label :for="`spec_${index}_${spec.id}`">
                    {{ spec.name }}
                    <span v-if="spec.unit">({{ spec.unit }})</span>
                    <span v-if="spec.is_required" class="required">*</span>
                  </label>

                  <select
                    v-if="spec.data_type === 'select' && spec.options.length"
                    :id="`spec_${index}_${spec.id}`"
                    v-model="variant.attributes[spec.name]"
                    :required="spec.is_required"
                    :disabled="saving || specificationsLoading"
                  >
                    <option value="">Select...</option>
                    <option
                      v-for="option in spec.options"
                      :key="option"
                      :value="option"
                    >
                      {{ option }}
                    </option>
                  </select>

                  <input
                    v-else-if="['number', 'decimal'].includes(spec.data_type)"
                    :id="`spec_${index}_${spec.id}`"
                    v-model="variant.attributes[spec.name]"
                    :type="spec.data_type === 'number' ? 'number' : 'text'"
                    :required="spec.is_required"
                    :disabled="saving || specificationsLoading"
                    :placeholder="`Enter ${spec.name.toLowerCase()}`"
                  />

                  <select
                    v-else-if="spec.data_type === 'boolean'"
                    :id="`spec_${index}_${spec.id}`"
                    v-model="variant.attributes[spec.name]"
                    :required="spec.is_required"
                    :disabled="saving || specificationsLoading"
                  >
                    <option value="">Select...</option>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>

                  <input
                    v-else
                    :id="`spec_${index}_${spec.id}`"
                    v-model="variant.attributes[spec.name]"
                    :type="spec.data_type === 'date' ? 'date' : 'text'"
                    :required="spec.is_required"
                    :disabled="saving || specificationsLoading"
                    :placeholder="`Enter ${spec.name.toLowerCase()}`"
                  />

                </div>

              </div>

            </div>

          </div>

          <div class="flags">

            <label>
              <input
                type="radio"
                name="default_variant"
                :checked="variant.is_default"
                :disabled="saving"
                @change="setDefaultVariant(index)"
              />

              Default variant
            </label>

            <label>
              <input
                v-model="variant.is_active"
                type="checkbox"
                :disabled="saving"
              />

              Active
            </label>

          </div>

        </section>

        <!-- Actions -->
        <div class="form-actions">

          <button
            type="button"
            class="btn-secondary"
            :disabled="saving || creatingColor"
            @click="cancelForm"
          >
            Cancel
          </button>

          <button
            type="button"
            class="btn-secondary"
            :disabled="saving || creatingColor"
            @click="resetForm"
          >
            Reset
          </button>

          <button
            type="submit"
            class="btn-primary"
            :disabled="saving || creatingColor || !itemId || itemsLoading"
          >
            {{
              saving
                ? 'Saving...'
                : isBulkEditing
                  ? `Update ${variants.length} Variants`
                  : isEditing
                    ? 'Update Variant'
                    : `Create ${variants.length} Variant${variants.length === 1 ? '' : 's'}`
            }}
          </button>

        </div>

      </form>

    </div>

  </div>
</template>

<style scoped>
.variant-form-page {
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

.variant-form,
.variant-section {
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
  margin-bottom: 0;
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

.section-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--spacing-xl);
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--spacing-xl);
}

.spec-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--spacing-lg);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  min-width: 0;
}

.form-group.full-width {
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

.required {
  color: var(--color-danger);
}

.form-group input:not([type="checkbox"]):not([type="radio"]):not([type="color"]),
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
.helper-note {
  font-size: var(--font-size-xs);
  line-height: 1.5;
  color: var(--color-text-muted);
}

.helper-note {
  margin: 0;
  font-size: var(--font-size-sm);
}

.variant-section > .helper-note {
  padding: var(--spacing-xl);
  text-align: center;
  background: var(--color-surface);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-lg);
}

/* =========================
   Colour creator
   ========================= */

.hex-input-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.color-picker {
  width: 52px;
  height: 40px;
  flex-shrink: 0;
  padding: 4px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  cursor: pointer;
}

.color-picker:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.inline-message {
  margin: var(--spacing-lg) 0 0;
}

/* =========================
   Variant cards
   ========================= */

.variant-card {
  padding: var(--spacing-xl);
  background: var(--color-surface);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.variant-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-lg);
  margin-bottom: var(--spacing-lg);
}

.variant-heading h3 {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.colour-picker-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
}

.colour-choice {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: 6px var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  font-family: inherit;
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: background var(--transition-fast),
  border-color var(--transition-fast),
  color var(--transition-fast);
}

.colour-choice:hover:not(:disabled) {
  background: var(--color-hover-bg);
}

.colour-choice.selected {
  border-color: var(--color-primary);
  background: var(--color-primary-light);
  color: var(--color-primary);
  font-weight: var(--font-weight-semibold);
}

.colour-choice:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.color-swatch {
  display: inline-block;
  width: 18px;
  height: 18px;
  flex: 0 0 auto;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
}

.flags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xl);
  margin-top: var(--spacing-xl);
  padding-top: var(--spacing-lg);
  border-top: 1px solid var(--color-border-light);
}

.flags label {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  cursor: pointer;
}

.flags input {
  accent-color: var(--color-primary);
}

/* =========================
   Badges
   ========================= */

.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  white-space: nowrap;
}

.status-badge.default {
  background: var(--color-primary-light);
  color: var(--color-primary);
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

.action-button {
  display: inline-flex;
  align-items: center;
  padding: 6px var(--spacing-md);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  font-family: inherit;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  white-space: nowrap;
  cursor: pointer;
  transition: background var(--transition-fast),
  color var(--transition-fast),
  border-color var(--transition-fast);
}

.action-button.delete:hover:not(:disabled) {
  background: var(--color-danger-bg);
  border-color: var(--color-danger-light);
  color: var(--color-danger);
}

.action-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* =========================
   Responsive
   ========================= */

@media (max-width: 768px) {
  .form-header,
  .section-header-row,
  .variant-heading {
    flex-direction: column;
    align-items: flex-start;
  }

  .form-grid,
  .spec-grid {
    grid-template-columns: 1fr;
  }

  .form-section,
  .variant-card {
    padding: var(--spacing-xl);
  }

  .form-actions {
    flex-direction: column-reverse;
  }

  .btn-primary,
  .btn-secondary {
    width: 100%;
  }

  .section-actions .btn-primary {
    width: 100%;
  }
}
</style>