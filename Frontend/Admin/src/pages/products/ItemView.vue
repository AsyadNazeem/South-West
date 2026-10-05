<script setup>

import {
  ref,
  computed,
  onMounted
} from 'vue'

import {
  useRoute,
  useRouter
} from 'vue-router'

import api from '../../api/axios'

const route = useRoute()
const router = useRouter()

const item = ref(null)

const specifications = ref([])
const specificationValues = ref({})

const loading = ref(true)
const saving = ref(false)
const errorMessage = ref('')

const itemId = route.params.id


/*
|--------------------------------------------------------------------------
| Load Item
|--------------------------------------------------------------------------
*/

const loadItem = async () => {

  try {

    loading.value = true
    errorMessage.value = ''

    const response = await api.get(
        `/items/${itemId}`
    )

    item.value = response.data.data

  } catch (error) {

    console.error(
        'Failed to load item:',
        error
    )

    errorMessage.value =
        error.response?.data?.message ||
        'Failed to load item.'

  }
}


/*
|--------------------------------------------------------------------------
| Load Specifications
|--------------------------------------------------------------------------
*/

const loadSpecifications = async () => {

  if (!item.value?.item_type_id) {
    return
  }

  try {

    const response = await api.get(
        `/item-type-specifications/item-type/${item.value.item_type_id}`
    )

    const records =
        response.data.data || []

    specifications.value =
        records.map(record => ({
          specification_id:
          record.specification_id,

          name:
              record.specification?.name || '',

          code:
              record.specification?.code || '',

          data_type:
              record.specification?.data_type || 'text',

          unit:
              record.specification?.unit || '',

          description:
              record.specification?.description || '',

          is_required:
              record.is_required || false
        }))

  } catch (error) {

    console.error(
        'Failed to load specifications:',
        error
    )

    specifications.value = []
  }
}


/*
|--------------------------------------------------------------------------
| Prepare Specification Values
|--------------------------------------------------------------------------
*/

const prepareSpecificationValues = () => {

  specificationValues.value = {}

  if (
      !item.value ||
      !item.value.specificationValues
  ) {
    return
  }

  item.value.specificationValues.forEach(record => {

    specificationValues.value[
        record.specification_id
        ] = record.value

  })
}


/*
|--------------------------------------------------------------------------
| Get Value
|--------------------------------------------------------------------------
*/

const getSpecificationValue = (
    specificationId
) => {

  return (
      specificationValues.value[
          specificationId
          ] ?? ''
  )
}


/*
|--------------------------------------------------------------------------
| Set Value
|--------------------------------------------------------------------------
*/

const setSpecificationValue = (
    specificationId,
    value
) => {

  specificationValues.value[
      specificationId
      ] = value

}


/*
|--------------------------------------------------------------------------
| Save Specification Values
|--------------------------------------------------------------------------
*/

const saveSpecifications = async () => {

  try {

    saving.value = true

    for (
        const specification
        of specifications.value
        ) {

      const value =
          specificationValues.value[
              specification.specification_id
              ]

      /*
       * Don't save empty optional values
       */

      if (
          value === undefined ||
          value === null ||
          String(value).trim() === ''
      ) {

        if (!specification.is_required) {
          continue
        }

        alert(
            `Please enter ${specification.name}.`
        )

        saving.value = false

        return
      }


      await api.post(
          '/item-specification-values',
          {
            item_id: Number(itemId),

            specification_id:
                Number(
                    specification.specification_id
                ),

            value:
                String(value).trim()
          }
      )
    }

    alert(
        'Specification values saved successfully.'
    )

    await loadItem()

    prepareSpecificationValues()

  } catch (error) {

    console.error(
        'Failed to save specification values:',
        error
    )

    alert(
        error.response?.data?.message ||
        'Failed to save specification values.'
    )

  } finally {

    saving.value = false
  }
}


/*
|--------------------------------------------------------------------------
| Go Back
|--------------------------------------------------------------------------
*/

const goBack = () => {

  router.push('/items')

}


/*
|--------------------------------------------------------------------------
| Display Helpers
|--------------------------------------------------------------------------
*/

const itemCondition = computed(() => {

  if (!item.value?.condition) {
    return '-'
  }

  return item.value.condition
      .replace('_', ' ')
      .replace(/\b\w/g, letter =>
          letter.toUpperCase()
      )
})


const serializedText = computed(() => {

  return item.value?.is_serialized
      ? 'Yes'
      : 'No'

})


const activeText = computed(() => {

  return item.value?.is_active
      ? 'Active'
      : 'Inactive'

})


/*
|--------------------------------------------------------------------------
| Load Page
|--------------------------------------------------------------------------
*/

onMounted(async () => {

  await loadItem()

  if (item.value) {

    await loadSpecifications()

    prepareSpecificationValues()

  }

  loading.value = false

})

</script>


<template>

  <div class="item-view-page">


    <!-- Loading -->

    <div
        v-if="loading"
        class="loading-state"
    >

      Loading item...

    </div>


    <!-- Error -->

    <div
        v-else-if="errorMessage"
        class="error-state"
    >

      {{ errorMessage }}

    </div>


    <!-- Item -->

    <div
        v-else-if="item"
        class="item-content"
    >


      <!-- Header -->

      <div class="page-header">

        <div>

          <h1>
            {{ item.item_name }}
          </h1>

          <p>
            Item Code:
            <strong>
              {{ item.item_code }}
            </strong>
          </p>

        </div>


        <div class="header-actions">

          <button
              type="button"
              class="btn-secondary"
              @click="goBack"
          >

            Back

          </button>


          <router-link
              :to="`/items/edit/${item.id}`"
              class="btn-primary"
          >

            Edit Item

          </router-link>

        </div>

      </div>


      <!-- Basic Information -->

      <section class="view-section">

        <div class="section-header">

          <h2>
            Basic Information
          </h2>

          <p>
            Main information about this item.
          </p>

        </div>


        <div class="details-grid">


          <div class="detail-item">

                    <span class="detail-label">
                        Item Code / SKU
                    </span>

            <span class="detail-value">
                        {{ item.item_code || '-' }}
                    </span>

          </div>


          <div class="detail-item">

                    <span class="detail-label">
                        Item Name
                    </span>

            <span class="detail-value">
                        {{ item.item_name || '-' }}
                    </span>

          </div>


          <div class="detail-item">

                    <span class="detail-label">
                        Category
                    </span>

            <span class="detail-value">
                        {{ item.category?.name || '-' }}
                    </span>

          </div>


          <div class="detail-item">

                    <span class="detail-label">
                        Brand
                    </span>

            <span class="detail-value">
                        {{ item.brand?.name || '-' }}
                    </span>

          </div>


          <div class="detail-item">

                    <span class="detail-label">
                        Unit of Measure
                    </span>

            <span class="detail-value">
                        {{ item.unitOfMeasure?.name || '-' }}
                    </span>

          </div>


          <div class="detail-item">

                    <span class="detail-label">
                        Item Type
                    </span>

            <span class="detail-value">
                        {{ item.itemType?.name || '-' }}
                    </span>

          </div>


          <div class="detail-item">

                    <span class="detail-label">
                        Condition
                    </span>

            <span
                class="condition-badge"
                :class="item.condition?.toLowerCase()"
            >

                        {{ itemCondition }}

                    </span>

          </div>


          <div class="detail-item">

                    <span class="detail-label">
                        Serialized
                    </span>

            <span
                class="serialized-badge"
                :class="
                            item.is_serialized
                                ? 'yes'
                                : 'no'
                        "
            >

                        {{ serializedText }}

                    </span>

          </div>


          <div class="detail-item">

                    <span class="detail-label">
                        Status
                    </span>

            <span
                class="status-badge"
                :class="
                            item.is_active
                                ? 'active'
                                : 'inactive'
                        "
            >

                        {{ activeText }}

                    </span>

          </div>

        </div>

      </section>


      <!-- Description -->

      <section class="view-section">

        <div class="section-header">

          <h2>
            Description
          </h2>

          <p>
            Additional information about the item.
          </p>

        </div>


        <div class="description-box">

          {{ item.description || 'No description available.' }}

        </div>

      </section>


      <!-- Specifications -->

      <section class="view-section">

        <div class="section-header">

          <div>

            <h2>
              Specifications
            </h2>

            <p>
              Specifications assigned to this item type.
            </p>

          </div>

        </div>


        <!-- No Specifications -->

        <div
            v-if="specifications.length === 0"
            class="empty-state"
        >

          No specifications have been assigned
          to this item type.

        </div>


        <!-- Specifications -->

        <div
            v-else
            class="specifications-container"
        >


          <div
              v-for="specification in specifications"
              :key="
                        specification.specification_id
                    "
              class="specification-row"
          >


            <!-- Specification -->

            <div class="specification-info">

              <div class="specification-name">

                {{ specification.name }}

                <span
                    v-if="
                                    specification.is_required
                                "
                    class="required"
                >

                                *

                            </span>

              </div>


              <div
                  v-if="
                                specification.code
                            "
                  class="specification-code"
              >

                {{ specification.code }}

              </div>


              <div
                  v-if="
                                specification.description
                            "
                  class="specification-description"
              >

                {{ specification.description }}

              </div>

            </div>


            <!-- Value -->

            <div class="specification-value">

              <div class="value-input-wrapper">

                <input
                    :type="
                                    specification.data_type === 'number' ||
                                    specification.data_type === 'decimal'
                                        ? 'number'
                                        : 'text'
                                "
                    :value="
                                    getSpecificationValue(
                                        specification.specification_id
                                    )
                                "
                    :placeholder="
                                    `Enter ${specification.name.toLowerCase()}`
                                "
                    @input="
                                    setSpecificationValue(
                                        specification.specification_id,
                                        $event.target.value
                                    )
                                "
                />


                <span
                    v-if="
                                    specification.unit
                                "
                    class="specification-unit"
                >

                                {{ specification.unit }}

                            </span>

              </div>

            </div>

          </div>


          <!-- Save -->

          <div class="specification-actions">

            <button
                type="button"
                class="btn-primary"
                :disabled="saving"
                @click="saveSpecifications"
            >

              {{
                saving
                    ? 'Saving...'
                    : 'Save Specification Values'
              }}

            </button>

          </div>

        </div>

      </section>


    </div>

  </div>

</template>

<style scoped>
/* ================================
   ITEM VIEW PAGE
================================ */

.item-view-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 32px;
  color: #1f2937;
}


/* ================================
   LOADING / ERROR
================================ */

.loading-state,
.error-state,
.empty-state {
  padding: 40px;
  text-align: center;
  border-radius: 10px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  color: #6b7280;
}

.error-state {
  color: #b91c1c;
  background: #fef2f2;
  border-color: #fecaca;
}


/* ================================
   HEADER
================================ */

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 24px;
  margin-bottom: 28px;
}

.page-header h1 {
  margin: 0 0 8px;
  font-size: 28px;
  font-weight: 700;
  color: #111827;
}

.page-header p {
  margin: 0;
  color: #6b7280;
  font-size: 14px;
}

.header-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}


/* ================================
   BUTTONS
================================ */

.btn-primary,
.btn-secondary {
  min-height: 40px;
  padding: 0 18px;
  border-radius: 7px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.btn-primary {
  border: 1px solid #2563eb;
  background: #2563eb;
  color: #ffffff;
}

.btn-primary:hover {
  background: #1d4ed8;
  border-color: #1d4ed8;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  border: 1px solid #d1d5db;
  background: #ffffff;
  color: #374151;
}

.btn-secondary:hover {
  background: #f9fafb;
  border-color: #9ca3af;
}


/* ================================
   VIEW SECTIONS
================================ */

.view-section {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  margin-bottom: 24px;
  overflow: hidden;
}

.section-header {
  padding: 20px 24px;
  border-bottom: 1px solid #e5e7eb;
}

.section-header h2 {
  margin: 0 0 5px;
  font-size: 18px;
  font-weight: 650;
  color: #111827;
}

.section-header p {
  margin: 0;
  font-size: 13px;
  color: #6b7280;
}


/* ================================
   BASIC INFORMATION
================================ */

.details-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
}

.detail-item {
  min-height: 78px;
  padding: 18px 24px;
  border-bottom: 1px solid #f0f1f3;
  border-right: 1px solid #f0f1f3;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 7px;
}

.detail-item:nth-child(3n) {
  border-right: none;
}

.detail-label {
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
}

.detail-value {
  font-size: 14px;
  font-weight: 500;
  color: #111827;
}


/* ================================
   CONDITION BADGE
================================ */

.condition-badge,
.serialized-badge,
.status-badge {
  width: fit-content;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
}


/* Condition */

.condition-badge.new {
  color: #166534;
  background: #dcfce7;
}

.condition-badge.used {
  color: #92400e;
  background: #fef3c7;
}

.condition-badge.refurbished {
  color: #1e40af;
  background: #dbeafe;
}

.condition-badge.open_box {
  color: #6b21a8;
  background: #f3e8ff;
}

.condition-badge.damaged {
  color: #991b1b;
  background: #fee2e2;
}


/* Serialized */

.serialized-badge.yes {
  color: #166534;
  background: #dcfce7;
}

.serialized-badge.no {
  color: #6b7280;
  background: #f3f4f6;
}


/* Status */

.status-badge.active {
  color: #166534;
  background: #dcfce7;
}

.status-badge.inactive {
  color: #991b1b;
  background: #fee2e2;
}


/* ================================
   DESCRIPTION
================================ */

.description-box {
  padding: 24px;
  min-height: 100px;
  font-size: 14px;
  line-height: 1.7;
  color: #374151;
  white-space: pre-wrap;
}


/* ================================
   SPECIFICATIONS
================================ */

.specifications-container {
  padding: 0;
}

.specification-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 40px;
  padding: 22px 24px;
  border-bottom: 1px solid #f0f1f3;
  align-items: center;
}

.specification-row:last-child {
  border-bottom: none;
}


/* Specification information */

.specification-info {
  min-width: 0;
}

.specification-name {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
  margin-bottom: 5px;
}

.specification-name .required {
  color: #dc2626;
  margin-left: 3px;
}

.specification-code {
  display: inline-block;
  margin-top: 3px;
  font-size: 11px;
  font-family: monospace;
  color: #6b7280;
  background: #f3f4f6;
  padding: 3px 6px;
  border-radius: 4px;
}

.specification-description {
  margin-top: 7px;
  font-size: 12px;
  line-height: 1.5;
  color: #9ca3af;
}


/* Specification value */

.specification-value {
  width: 100%;
}

.value-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.value-input-wrapper input {
  width: 100%;
  height: 42px;
  padding: 0 14px;
  border: 1px solid #d1d5db;
  border-radius: 7px;
  background: #ffffff;
  color: #111827;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s ease,
  box-shadow 0.2s ease;
}

.value-input-wrapper input:focus {
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.value-input-wrapper input::placeholder {
  color: #9ca3af;
}


/* Input with unit */

.value-input-wrapper:has(.specification-unit) input {
  padding-right: 60px;
}

.specification-unit {
  position: absolute;
  right: 13px;
  color: #6b7280;
  font-size: 12px;
  font-weight: 500;
  pointer-events: none;
}


/* ================================
   SPECIFICATION SAVE
================================ */

.specification-actions {
  display: flex;
  justify-content: flex-end;
  padding: 20px 24px;
  background: #fafafa;
  border-top: 1px solid #e5e7eb;
}


/* ================================
   EMPTY SPECIFICATIONS
================================ */

.specifications-container + .empty-state {
  margin: 20px 24px;
}


/* ================================
   RESPONSIVE
================================ */

@media (max-width: 900px) {

  .item-view-page {
    padding: 24px;
  }

  .details-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .detail-item:nth-child(3n) {
    border-right: 1px solid #f0f1f3;
  }

  .detail-item:nth-child(2n) {
    border-right: none;
  }

  .specification-row {
    grid-template-columns: 1fr;
    gap: 16px;
  }
}


@media (max-width: 650px) {

  .item-view-page {
    padding: 16px;
  }

  .page-header {
    flex-direction: column;
  }

  .header-actions {
    width: 100%;
  }

  .header-actions .btn-primary,
  .header-actions .btn-secondary {
    flex: 1;
  }

  .details-grid {
    grid-template-columns: 1fr;
  }

  .detail-item,
  .detail-item:nth-child(2n),
  .detail-item:nth-child(3n) {
    border-right: none;
  }

  .specification-row {
    padding: 18px;
  }

  .section-header {
    padding: 18px;
  }

  .description-box {
    padding: 18px;
  }

  .specification-actions {
    padding: 16px 18px;
  }

  .specification-actions .btn-primary {
    width: 100%;
  }
}
</style>
