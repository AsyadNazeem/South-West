<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Multiselect from 'vue-multiselect'
import 'vue-multiselect/dist/vue-multiselect.css'
import api from '../../api/axios'

const router = useRouter()
const route = useRoute()

const isEditMode = computed(() => Boolean(route.params.id))
const itemTypeId = computed(() => route.params.id)

const loading = ref(false)
const pageLoading = ref(false)
const errorMessage = ref('')

const form = ref({
  name: '',
  code: '',
  description: '',
  is_active: true
})

const specifications = ref([])
const selectedSpecifications = ref([])
const specificationsLoading = ref(false)

const createdItemTypeId = ref(null)
const assignedSpecIds = ref(new Set())

// Records already saved for this item type (edit mode)
// [{ id, specification_id }]
const originalRecords = ref([])

/*
|--------------------------------------------------------------------------
| Available Specifications
|--------------------------------------------------------------------------
*/

const availableSpecifications = computed(() =>
    specifications.value.filter(
        spec =>
            !selectedSpecifications.value.some(
                item => Number(item.specification_id) === Number(spec.id)
            )
    )
)

const specificationLabel = (specification) =>
    `${specification.name} (${specification.code})`

/*
|--------------------------------------------------------------------------
| Load Specifications
|--------------------------------------------------------------------------
*/

const loadSpecifications = async () => {
  try {
    specificationsLoading.value = true

    const response = await api.get('/item-specifications')

    specifications.value = response.data.data || []
  } catch (error) {
    console.error('Failed to load item specifications:', error)

    errorMessage.value =
        error.response?.data?.message ||
        'Failed to load item specifications.'
  } finally {
    specificationsLoading.value = false
  }
}

/*
|--------------------------------------------------------------------------
| Load Existing Item Type
|--------------------------------------------------------------------------
*/

const loadItemType = async () => {
  if (!isEditMode.value) return

  try {
    pageLoading.value = true
    errorMessage.value = ''

    const response = await api.get(
        `/item-types/${itemTypeId.value}`
    )

    const responseData = response.data

    const itemType =
        responseData?.data ||
        responseData?.itemType ||
        responseData?.item_type ||
        responseData

    if (!itemType?.id) {
      throw new Error('Item type could not be found.')
    }

    /*
     * Basic item type information
     */

    form.value.name = itemType.name || ''
    form.value.code = itemType.code || ''
    form.value.description = itemType.description || ''
    form.value.is_active = Boolean(itemType.is_active)

    /*
     * Assigned specifications come from the
     * item-type-specifications endpoint
     */

    const specResponse = await api.get(
        `/item-type-specifications/item-type/${itemTypeId.value}`
    )

    const records = specResponse.data.data || []

    originalRecords.value = records.map(record => ({
      id: record.id,
      specification_id: Number(record.specification_id)
    }))

    selectedSpecifications.value = records.map((record, index) => ({
      specification_id: Number(record.specification_id),
      name: record.specification?.name || '',
      code: record.specification?.code || '',
      data_type: record.specification?.data_type || '',
      unit: record.specification?.unit || '',
      is_required: Boolean(record.is_required),
      sort_order: record.sort_order ?? index + 1
    }))

    assignedSpecIds.value = new Set(
        selectedSpecifications.value.map(spec => spec.specification_id)
    )

    createdItemTypeId.value = itemType.id

    updateSortOrders()

  } catch (error) {
    console.error(
        'Failed to load item type:',
        error.response?.data || error
    )

    errorMessage.value =
        error.response?.data?.message ||
        error.message ||
        'Failed to load item type.'
  } finally {
    pageLoading.value = false
  }
}

/*
|--------------------------------------------------------------------------
| Add Specification
|--------------------------------------------------------------------------
*/

const addSpecification = (specification) => {
  if (!specification?.id) return

  const exists = selectedSpecifications.value.some(
      item => Number(item.specification_id) === Number(specification.id)
  )

  if (exists) return

  selectedSpecifications.value.push({
    specification_id: Number(specification.id),
    name: specification.name,
    code: specification.code,
    data_type: specification.data_type,
    unit: specification.unit,
    is_required: specification.is_required ?? false,
    sort_order: selectedSpecifications.value.length + 1
  })
}

/*
|--------------------------------------------------------------------------
| Update Sort Orders
|--------------------------------------------------------------------------
*/

const updateSortOrders = () => {
  selectedSpecifications.value.forEach(
      (item, index) => {
        item.sort_order = index + 1
      }
  )
}

/*
|--------------------------------------------------------------------------
| Remove Specification
|--------------------------------------------------------------------------
*/

const removeSpecification = (index) => {
  selectedSpecifications.value.splice(index, 1)

  updateSortOrders()
}

/*
|--------------------------------------------------------------------------
| Move Specification Up
|--------------------------------------------------------------------------
*/

const moveSpecificationUp = (index) => {
  if (index === 0) return

  const items = selectedSpecifications.value

  const temp = items[index]

  items[index] = items[index - 1]
  items[index - 1] = temp

  updateSortOrders()
}

/*
|--------------------------------------------------------------------------
| Move Specification Down
|--------------------------------------------------------------------------
*/

const moveSpecificationDown = (index) => {
  if (index === selectedSpecifications.value.length - 1) {
    return
  }

  const items = selectedSpecifications.value

  const temp = items[index]

  items[index] = items[index + 1]
  items[index + 1] = temp

  updateSortOrders()
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
    /*
     * Validation
     */

    if (!form.value.name.trim()) {
      errorMessage.value = 'Item type name is required.'
      return
    }

    if (!form.value.code.trim()) {
      errorMessage.value = 'Item type code is required.'
      return
    }

    updateSortOrders()

    /*
     |--------------------------------------------------------------------------
     | EDIT
     |--------------------------------------------------------------------------
     */

    if (isEditMode.value) {

      const payload = {
        name: form.value.name.trim(),
        code: form.value.code.trim().toUpperCase(),
        description: form.value.description.trim() || null,
        is_active: form.value.is_active
      }

      await api.put(
          `/item-types/${itemTypeId.value}`,
          payload
      )

      const currentIds = new Set(
          selectedSpecifications.value.map(spec => spec.specification_id)
      )

      // Remove unassigned specifications
      for (const original of originalRecords.value) {
        if (!currentIds.has(original.specification_id)) {
          await api.delete(
              `/item-type-specifications/${original.id}`
          )
        }
      }

      // Update existing / add new specifications
      for (const spec of selectedSpecifications.value) {
        const existing = originalRecords.value.find(
            original => original.specification_id === spec.specification_id
        )

        const body = {
          is_required: Boolean(spec.is_required),
          sort_order: spec.sort_order
        }

        if (existing) {
          await api.put(
              `/item-type-specifications/${existing.id}`,
              body
          )
        } else {
          await api.post('/item-type-specifications', {
            item_type_id: Number(itemTypeId.value),
            specification_id: spec.specification_id,
            ...body
          })
        }
      }

      alert('Item type updated successfully.')

      router.push('/item-types')

      return
    }

    /*
     |--------------------------------------------------------------------------
     | CREATE
     |--------------------------------------------------------------------------
     */

    /*
     * Step 1: Create item type
     */

    if (!createdItemTypeId.value) {

      const payload = {
        name: form.value.name.trim(),
        code: form.value.code.trim().toUpperCase(),
        description: form.value.description.trim() || null,
        is_active: form.value.is_active
      }

      const response = await api.post('/item-types', payload)

      const responseData = response.data

      const returnedItemType =
          responseData?.data ||
          responseData?.itemType ||
          responseData?.item_type ||
          responseData

      if (!returnedItemType?.id) {
        throw new Error(
            'Item type was created, but the API did not return its ID.'
        )
      }

      createdItemTypeId.value = returnedItemType.id
    }

    /*
     * Step 2: Assign specifications
     */

    for (const specification of selectedSpecifications.value) {

      if (assignedSpecIds.value.has(specification.specification_id)) {
        continue
      }

      await api.post('/item-type-specifications', {
        item_type_id: createdItemTypeId.value,
        specification_id: specification.specification_id,
        is_required: Boolean(specification.is_required),
        sort_order: specification.sort_order
      })

      assignedSpecIds.value.add(specification.specification_id)
    }

    alert('Item type and specifications created successfully.')

    router.push('/item-types')

  } catch (error) {

    console.error(
        'Failed to save item type:',
        error.response?.data || error
    )

    errorMessage.value =
        error.response?.data?.message ||
        error.message ||
        'Failed to save item type.'

  } finally {
    loading.value = false
  }
}

/*
|--------------------------------------------------------------------------
| Back
|--------------------------------------------------------------------------
*/

const goBack = () => {
  router.push('/admin/products/item-types')
}

/*
|--------------------------------------------------------------------------
| Initial Load
|--------------------------------------------------------------------------
*/

onMounted(async () => {

  await loadSpecifications()

  if (isEditMode.value) {
    await loadItemType()
  }

})
</script>

<template>

  <div class="item-type-form-page">

    <!-- Header -->

    <div class="form-header">

      <div>

        <h1>
          {{ isEditMode ? 'Edit Item Type' : 'Create Item Type' }}
        </h1>

        <p>
          {{
            isEditMode
                ? 'Update the item type and its specifications.'
                : 'Add a new item type that can be assigned to products.'
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


    <!-- Loading -->

    <div
        v-if="pageLoading"
        class="loading-message"
    >
      Loading item type...
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
        v-if="!pageLoading"
        class="item-type-form"
        @submit.prevent="submitForm"
    >

      <!-- Item Type Information -->

      <section class="form-section">

        <div class="section-header">

          <h2>
            Item Type Information
          </h2>

          <p>
            Define the name, code and description
            of the item type.
          </p>

        </div>


        <div class="form-grid">

          <!-- Name -->

          <div class="form-group">

            <label for="name">

              Item Type Name

              <span>*</span>

            </label>

            <input
                id="name"
                v-model="form.name"
                type="text"
                placeholder="e.g. Accessory"
                maxlength="50"
                :disabled="loading"
                required
            />

          </div>


          <!-- Code -->

          <div class="form-group">

            <label for="code">

              Item Type Code

              <span>*</span>

            </label>

            <input
                id="code"
                v-model="form.code"
                type="text"
                placeholder="e.g. ACCESSORY"
                maxlength="30"
                :disabled="loading"
                required
            />

            <small>
              A unique code used to identify
              this item type.
            </small>

          </div>

        </div>


        <!-- Description -->

        <div class="form-group full-width">

          <label for="description">
            Description
          </label>

          <textarea
              id="description"
              v-model="form.description"
              rows="5"
              maxlength="255"
              placeholder="Describe this item type..."
              :disabled="loading"
          ></textarea>

        </div>

      </section>


      <!-- Specifications -->

      <section class="form-section">

        <div class="section-header">

          <h2>
            Specifications
          </h2>

          <p>
            Select the specifications that should
            be available when registering items
            under this item type.
          </p>

        </div>


        <!-- Add Specification -->

        <div class="form-group">

          <label for="specification">
            Add Specification
          </label>

          <Multiselect
              id="specification"
              :model-value="null"
              :options="availableSpecifications"
              :custom-label="specificationLabel"
              track-by="id"
              :loading="specificationsLoading"
              :show-labels="false"
              :disabled="loading"
              placeholder="Search by name or code to add..."
              @select="addSpecification"
          >

            <template #noResult>
              No specifications found.
            </template>

            <template #noOptions>
              No more specifications to add.
            </template>

          </Multiselect>

        </div>


        <!-- Selected Specifications -->

        <div
            v-if="selectedSpecifications.length"
            class="specification-list"
        >

          <div
              v-for="(
              specification,
              index
            ) in selectedSpecifications"
              :key="specification.specification_id"
              class="specification-row"
          >

            <!-- Sort Order -->

            <div class="sort-order">
              {{ specification.sort_order }}
            </div>


            <!-- Specification Information -->

            <div class="specification-info">

              <strong>
                {{ specification.name }}
              </strong>

              <small>

                {{ specification.code }}

                <span
                    v-if="specification.data_type"
                >
                  • {{ specification.data_type }}
                </span>

                <span
                    v-if="specification.unit"
                >
                  • {{ specification.unit }}
                </span>

              </small>

            </div>


            <!-- Required -->

            <div class="required-control">

              <label>

                <input
                    v-model="specification.is_required"
                    type="checkbox"
                    :disabled="loading"
                />

                Required

              </label>

            </div>


            <!-- Sort Controls -->

            <div class="sort-controls">

              <button
                  type="button"
                  class="icon-button"
                  :disabled="
                  loading ||
                  index === 0
                "
                  @click="moveSpecificationUp(index)"
                  title="Move up"
              >
                ↑
              </button>

              <button
                  type="button"
                  class="icon-button"
                  :disabled="
                  loading ||
                  index ===
                    selectedSpecifications.length - 1
                "
                  @click="moveSpecificationDown(index)"
                  title="Move down"
              >
                ↓
              </button>

            </div>


            <!-- Remove -->

            <button
                type="button"
                class="remove-button"
                @click="removeSpecification(index)"
                :disabled="loading"
            >
              Remove
            </button>

          </div>

        </div>


        <!-- Empty State -->

        <div
            v-else
            class="empty-specifications"
        >
          No specifications assigned yet.
        </div>

      </section>


      <!-- Settings -->

      <section class="form-section">

        <div class="section-header">

          <h2>
            Settings
          </h2>

          <p>
            Configure whether this item type can
            be used in the system.
          </p>

        </div>


        <!-- Active -->

        <div class="checkbox-group">

          <label>

            <input
                v-model="form.is_active"
                type="checkbox"
                :disabled="loading"
            />

            <span>
              Active
            </span>

          </label>

          <small>
            Inactive item types will not be available
            when registering new items.
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
                : isEditMode
                    ? 'Update Item Type'
                    : 'Create Item Type'
          }}
        </button>

      </div>

    </form>

  </div>

</template>

<style scoped>
.item-type-form-page {
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

.item-type-form {
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

.full-width {
  margin-top: var(--spacing-xl);
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
.form-group textarea {
  width: 100%;
  box-sizing: border-box;
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

.form-group input,
.form-group select {
  height: 40px;
  padding: 0 var(--spacing-lg);
}

.form-group textarea {
  min-height: 120px;
  padding: 10px var(--spacing-lg);
  resize: vertical;
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

/* Reset the generic input rules above for the search box */
.form-group :deep(.multiselect__input),
.form-group :deep(.multiselect__single) {
  width: auto;
  height: auto;
  min-height: 20px;
  margin-bottom: 0;
  padding: 0;
  border: none;
  box-shadow: none;
  background: transparent;
  color: var(--color-text-primary);
  font-family: inherit;
  font-size: var(--font-size-md);
}

.form-group :deep(.multiselect__input) {
  width: 100%;
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
   Specifications
   ========================= */

.specification-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-lg);
}

.specification-row {
  display: grid;
  grid-template-columns: 40px 1fr auto auto auto;
  align-items: center;
  gap: var(--spacing-md);

  padding: var(--spacing-md);

  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);

  background: var(--color-surface);
}

.sort-order {
  display: flex;
  align-items: center;
  justify-content: center;

  width: 32px;
  height: 32px;

  border-radius: var(--radius-lg);

  background: var(--color-hover-bg);

  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);

  color: var(--color-text-secondary);
}

.specification-info {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.specification-info strong {
  font-size: var(--font-size-md);
  color: var(--color-text-primary);
}

.specification-info small {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.required-control label {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);

  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);

  color: var(--color-text-primary);

  cursor: pointer;
}

.required-control input {
  width: 16px;
  height: 16px;

  cursor: pointer;

  accent-color: var(--color-primary);
}

.sort-controls {
  display: flex;
  gap: 4px;
}

.icon-button {
  display: flex;
  align-items: center;
  justify-content: center;

  width: 32px;
  height: 32px;

  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);

  background: var(--color-surface);
  color: var(--color-text-secondary);

  cursor: pointer;
}

.icon-button:hover:not(:disabled) {
  background: var(--color-hover-bg);
  color: var(--color-text-primary);
}

.icon-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.remove-button {
  border: none;
  background: transparent;

  color: var(--color-danger);

  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);

  cursor: pointer;
}

.remove-button:hover {
  text-decoration: underline;
}

.empty-specifications {
  margin-top: var(--spacing-lg);
  padding: var(--spacing-lg);

  border: 1px dashed var(--color-border);
  border-radius: var(--radius-lg);

  text-align: center;

  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
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

  .specification-row {
    grid-template-columns: 40px 1fr;
  }

  .required-control {
    grid-column: 2;
  }

  .sort-controls {
    grid-column: 2;
  }

  .remove-button {
    grid-column: 2;
    justify-self: start;
  }
}
</style>
