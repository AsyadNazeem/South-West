<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import deliveryAreaApi from '../../api/deliveryAreaApi'
import deliveryDistrictApi from '../../api/deliveryDistrictApi'
import { hasPermission } from '../../auth/authorization'

const route = useRoute()
const router = useRouter()

// =========================================================
// STATE
// =========================================================

const saving = ref(false)
const loading = ref(false)
const error = ref('')

const districts = ref([])

const isEdit = computed(() => Boolean(route.params.id))

const form = ref({
  district_id: '',
  area_name: '',
  first_kg_charge: '',
  additional_kg_charge: 100,
  status: true
})

// =========================================================
// PAGE TITLE
// =========================================================

const pageTitle = computed(() =>
    isEdit.value
        ? 'Edit Delivery Area'
        : 'Add Delivery Area'
)

const pageDescription = computed(() =>
    isEdit.value
        ? 'Update the delivery area and its delivery charges.'
        : 'Add a delivery area and configure its delivery charges.'
)

// =========================================================
// LOAD DISTRICTS
// =========================================================

const loadDistricts = async () => {
  try {
    const response =
        await deliveryDistrictApi.getDistricts()

    districts.value =
        response?.data ||
        response ||
        []
  } catch (err) {
    console.error(
        'Failed to load delivery districts:',
        err
    )

    districts.value = []

    error.value =
        err?.response?.data?.message ||
        'Failed to load delivery districts.'
  }
}

// =========================================================
// LOAD EXISTING DELIVERY AREA
// =========================================================

const loadDeliveryArea = async () => {
  if (!isEdit.value) {
    return
  }

  try {
    const response =
        await deliveryAreaApi.getDeliveryAreaById(
            route.params.id
        )

    const area =
        response?.data ||
        response

    if (!area) {
      error.value = 'Delivery area not found.'
      return
    }

    form.value = {
      district_id:
          area.district_id || '',

      area_name:
          area.area_name || '',

      first_kg_charge:
          area.first_kg_charge ?? '',

      additional_kg_charge:
          area.additional_kg_charge ?? 100,

      status:
          Boolean(area.status)
    }

  } catch (err) {
    console.error(
        'Failed to load delivery area:',
        err
    )

    error.value =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to load delivery area.'
  }
}

// =========================================================
// VALIDATION
// =========================================================

const validateForm = () => {
  error.value = ''

  if (!form.value.district_id) {
    error.value = 'District is required.'
    return false
  }

  if (!form.value.area_name.trim()) {
    error.value = 'Area name is required.'
    return false
  }

  if (
      form.value.first_kg_charge === '' ||
      form.value.first_kg_charge === null ||
      form.value.first_kg_charge === undefined
  ) {
    error.value = 'First KG charge is required.'
    return false
  }

  if (Number(form.value.first_kg_charge) < 0) {
    error.value =
        'First KG charge cannot be negative.'

    return false
  }

  if (
      form.value.additional_kg_charge === '' ||
      form.value.additional_kg_charge === null ||
      form.value.additional_kg_charge === undefined
  ) {
    error.value =
        'Additional KG charge is required.'

    return false
  }

  if (Number(form.value.additional_kg_charge) < 0) {
    error.value =
        'Additional KG charge cannot be negative.'

    return false
  }

  return true
}

// =========================================================
// SAVE DELIVERY AREA
// =========================================================

const saveDeliveryArea = async () => {
  if (!validateForm()) {
    return
  }

  saving.value = true
  error.value = ''

  try {
    const payload = {
      district_id:
          Number(form.value.district_id),

      area_name:
          form.value.area_name.trim(),

      first_kg_charge:
          Number(form.value.first_kg_charge),

      additional_kg_charge:
          Number(form.value.additional_kg_charge),

      status:
          Boolean(form.value.status)
    }

    if (isEdit.value) {

      await deliveryAreaApi.updateDeliveryArea(
          route.params.id,
          payload
      )

    } else {

      await deliveryAreaApi.createDeliveryArea(
          payload
      )
    }

    router.push(
        '/admin/sales/delivery-chargers'
    )

  } catch (err) {
    console.error(
        'Save delivery area error:',
        err
    )

    error.value =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'Failed to save delivery area.'

  } finally {
    saving.value = false
  }
}

// =========================================================
// CANCEL
// =========================================================

const cancel = () => {
  router.push(
      '/admin/sales/delivery-chargers'
  )
}

// =========================================================
// INITIAL LOAD
// =========================================================

onMounted(async () => {
  loading.value = true
  error.value = ''

  try {
    await loadDistricts()
    await loadDeliveryArea()
  } finally {
    loading.value = false
  }
})
</script>


<template>
  <div class="page-container">

    <!-- =================================================
         PAGE HEADER
    ================================================== -->

    <div class="page-header">

      <div>
        <h1>
          {{ pageTitle }}
        </h1>

        <p class="page-description">
          {{ pageDescription }}
        </p>
      </div>

    </div>


    <!-- =================================================
         ERROR
    ================================================== -->

    <div
        v-if="error"
        class="alert alert-error"
    >
      {{ error }}
    </div>


    <!-- =================================================
         LOADING
    ================================================== -->

    <div
        v-if="loading"
        class="loading-card"
    >
      Loading delivery charge...
    </div>


    <!-- =================================================
         FORM
    ================================================== -->

    <div
        v-else
        class="form-card"
    >

      <form @submit.prevent="saveDeliveryArea">

        <!-- =========================================
             LOCATION
        ========================================== -->

        <div class="section">

          <div class="section-header">
            <h2>
              Delivery Area
            </h2>

            <p>
              Enter the destination district
              and area for this delivery charge.
            </p>
          </div>


          <div class="form-grid">

            <!-- DISTRICT -->

            <div class="form-group">

              <label for="district_id">
                District
                <span class="required">*</span>
              </label>

              <select
                  id="district_id"
                  v-model="form.district_id"
                  :disabled="saving"
                  required
              >
                <option value="">
                  Select District
                </option>

                <option
                    v-for="district in districts"
                    :key="district.id"
                    :value="district.id"
                >
                  {{ district.district_name }}
                </option>
              </select>

              <small>
                Select the district for this delivery area.
              </small>

            </div>


            <!-- AREA -->

            <div class="form-group">

              <label for="area_name">
                Area
                <span class="required">*</span>
              </label>

              <input
                  id="area_name"
                  v-model="form.area_name"
                  type="text"
                  placeholder="e.g. Colombo 01"
                  maxlength="150"
                  :disabled="saving"
                  required
              />

              <small>
                Enter the specific delivery
                area.
              </small>

            </div>

          </div>

        </div>


        <!-- =========================================
             CHARGES
        ========================================== -->

        <div class="section">

          <div class="section-header">
            <h2>
              Delivery Charges
            </h2>

            <p>
              Configure the delivery rate based
              on weight.
            </p>
          </div>


          <div class="form-grid">

            <!-- FIRST KG -->

            <div class="form-group">

              <label for="first_kg_charge">
                First 1 KG Charge
                <span class="required">*</span>
              </label>

              <div class="input-with-prefix">

                                <span>
                                    Rs.
                                </span>

                <input
                    id="first_kg_charge"
                    v-model="form.first_kg_charge"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="350.00"
                    :disabled="saving"
                    required
                />

              </div>

              <small>
                Charge for the first 1 KG.
              </small>

            </div>


            <!-- ADDITIONAL KG -->

            <div class="form-group">

              <label for="additional_kg_charge">
                Additional 1 KG Charge
                <span class="required">*</span>
              </label>

              <div class="input-with-prefix">

                                <span>
                                    Rs.
                                </span>

                <input
                    id="additional_kg_charge"
                    v-model="form.additional_kg_charge"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="100.00"
                    :disabled="saving"
                    required
                />

              </div>

              <small>
                Charge for every additional
                1 KG.
              </small>

            </div>

          </div>

        </div>


        <!-- =========================================
             STATUS
        ========================================== -->

        <div class="section">

          <div class="section-header">
            <h2>
              Status
            </h2>

            <p>
              Inactive charges will not be used
              for new deliveries.
            </p>
          </div>


          <label class="checkbox-row">

            <input
                v-model="form.status"
                type="checkbox"
                :disabled="saving"
            />

            <span>
                            Active
                        </span>

          </label>

        </div>


        <!-- =========================================
             FORM ACTIONS
        ========================================== -->

        <div class="form-actions">

          <button
              type="button"
              class="cancel-button"
              :disabled="saving"
              @click="cancel"
          >
            Cancel
          </button>


          <button
              v-if="!isEdit && hasPermission('delivery-chargers.create')"
              type="submit"
              class="save-button"
              :disabled="saving"
          >
            {{ saving ? 'Saving...' : 'Save Delivery Area' }}
          </button>

          <button
              v-if="isEdit && hasPermission('delivery-chargers.update')"
              type="submit"
              class="save-button"
              :disabled="saving"
          >
            {{ saving ? 'Updating...' : 'Update Delivery Area' }}
          </button>

        </div>

      </form>

    </div>

  </div>
</template>


<style scoped>
.page-container {
  width: 100%;
  max-width: 900px;
  margin: 0 auto;
  font-family: var(--font-family);
}

/* =========================
   Header
   ========================= */

.page-header {
  margin-bottom: var(--spacing-2xl);
}

.page-header h1 {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
}

.page-description {
  margin-top: 5px;
  font-size: var(--font-size-md);
  color: var(--color-text-secondary);
}

/* =========================
   States
   ========================= */

.alert {
  margin-bottom: var(--spacing-lg);
  padding: var(--spacing-md) var(--spacing-lg);
  border: 1px solid;
  border-radius: var(--radius-lg);
  font-size: var(--font-size-sm);
}

.alert-error {
  border-color: var(--color-danger-light);
  background: var(--color-danger-bg);
  color: var(--color-danger);
}

.loading-card {
  padding: 50px var(--spacing-xl);
  text-align: center;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  background: var(--color-surface);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

/* =========================
   Form Card / Sections
   ========================= */

.form-card {
  overflow: hidden;
  background: var(--color-surface);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.section {
  padding: var(--spacing-2xl);
  border-bottom: 1px solid var(--color-border-light);
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

.required {
  margin-left: 2px;
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

.form-group select {
  cursor: pointer;
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

.form-group small {
  font-size: var(--font-size-xs);
  line-height: 1.5;
  color: var(--color-text-muted);
}

/* =========================
   Currency Input (Rs. prefix)
   ========================= */

.input-with-prefix {
  display: flex;
  align-items: stretch;
}

.input-with-prefix span {
  display: flex;
  align-items: center;
  padding: 0 var(--spacing-lg);
  border: 1px solid var(--color-border);
  border-right: none;
  border-radius: var(--radius-lg) 0 0 var(--radius-lg);
  background: var(--color-hover-bg);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
}

.input-with-prefix input {
  flex: 1;
  min-width: 0;
  border-radius: 0 var(--radius-lg) var(--radius-lg) 0;
}

/* =========================
   Status Checkbox
   ========================= */

.checkbox-row {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-md);
  cursor: pointer;
}

.checkbox-row input {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  cursor: pointer;
  accent-color: var(--color-primary);
}

.checkbox-row span {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

/* =========================
   Actions
   ========================= */

.form-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--spacing-md);
  padding: var(--spacing-lg) var(--spacing-2xl);
  background: var(--color-hover-bg);
}

.cancel-button,
.save-button {
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

.cancel-button {
  border: 1px solid var(--color-border-light);
  background: var(--color-surface);
  color: var(--color-text-secondary);
}

.cancel-button:hover:not(:disabled) {
  background: var(--color-hover-bg);
  color: var(--color-text-primary);
}

.save-button {
  border: none;
  background: var(--color-primary);
  color: var(--color-text-light);
}

.save-button:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.cancel-button:disabled,
.save-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* =========================
   Responsive
   ========================= */

@media (max-width: 700px) {
  .form-grid {
    grid-template-columns: 1fr;
  }

  .section {
    padding: var(--spacing-xl);
  }

  .form-actions {
    flex-direction: column-reverse;
    align-items: stretch;
    padding: var(--spacing-xl);
  }

  .cancel-button,
  .save-button {
    width: 100%;
  }
}
</style>
