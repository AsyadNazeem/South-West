<script setup>
import { ref, computed, onMounted, watch, nextTick } from "vue"
import { useRoute, useRouter } from "vue-router"
import api from "@/api/axios"
import SearchableSelect from "@/components/common/SearchableSelect.vue"
import customerAddressApi from "@/api/deliveryAddressApi"

const route = useRoute()
const router = useRouter()

const LIST_ROUTE = "/admin/customers/addresses"

// Param names must match your router: /admin/customers/:customerId/addresses/:addressId/edit
const routeCustomerId = route.params.customerId || ""
const addressId = route.params.addressId || null
const isEdit = computed(() => Boolean(addressId))

const loading = ref(false)
const loadingCustomers = ref(true)
const loadingAddress = ref(false)
const loadingDistricts = ref(true)
const loadingAreas = ref(false)

const errorMessage = ref("")
const successMessage = ref("")

const customers = ref([])
const districts = ref([])
const areas = ref([])

const form = ref({
  customer_id: "",
  recipient_name: "",
  address_type: "shipping",
  address_line_1: "",
  address_line_2: "",
  district_id: "",
  area_id: "",
  city: "",
  province: "",
  postal_code: "",
  country: "Sri Lanka",
  phone: "",
  is_default: false
})

// True while the edit form is being filled, so the district watcher
// does not clear the saved area_id.
let hydrating = false

/* =========================
   OPTIONS
   ========================= */

const customerOptions = computed(() =>
    customers.value.map(customer => ({
      value: customer.id,
      label:
          customer.name ||
          [customer.first_name, customer.last_name].filter(Boolean).join(" ") ||
          customer.company_name ||
          customer.email ||
          `Customer #${customer.id}`,
      hint: customer.phone || customer.email || ""
    }))
)

const districtOptions = computed(() =>
    districts.value.map(district => ({
      value: district.id,
      label: district.district_name
    }))
)

const areaOptions = computed(() =>
    areas.value.map(area => ({
      value: area.id,
      label: area.area_name,
      hint: `Rs. ${Number(area.first_kg_charge || 0).toFixed(2)} first kg`
    }))
)

/* =========================
   LOAD LOOKUPS
   ========================= */

const loadCustomers = async () => {
  try {
    loadingCustomers.value = true

    const response = await api.get("/customers", {
      params: { limit: 1000 }
    })

    customers.value = response.data.data || []
  } catch (error) {
    console.error("Customer loading error:", error)

    errorMessage.value =
        error.response?.data?.message || "Failed to load customers."
  } finally {
    loadingCustomers.value = false
  }
}

const loadDistricts = async () => {
  try {
    loadingDistricts.value = true

    const response = await api.get("/delivery-districts")

    districts.value = response.data.data || []
  } catch (error) {
    console.error("District loading error:", error)

    errorMessage.value =
        error.response?.data?.message || "Failed to load delivery districts."
  } finally {
    loadingDistricts.value = false
  }
}

// Only loads the list. It never touches form.area_id.
const loadAreas = async (districtId) => {
  areas.value = []

  if (!districtId) return

  try {
    loadingAreas.value = true

    const response = await api.get("/delivery-areas", {
      params: { district_id: districtId }
    })

    areas.value = response.data.data || []
  } catch (error) {
    console.error("Area loading error:", error)

    errorMessage.value =
        error.response?.data?.message || "Failed to load delivery areas."
  } finally {
    loadingAreas.value = false
  }
}

// Reacts to user changes only, not to the edit form being filled
watch(
    () => form.value.district_id,
    async (newDistrictId) => {
      if (hydrating) return

      form.value.area_id = ""
      await loadAreas(newDistrictId)
    }
)

/* =========================
   LOAD ADDRESS (EDIT)
   ========================= */

const loadAddress = async () => {
  try {
    loadingAddress.value = true
    hydrating = true

    const res = await customerAddressApi.getAddressById(addressId)
    const a = res.data // API returns { message, data }

    if (!a) {
      throw new Error("Address not found")
    }

    form.value = {
      ...form.value,
      customer_id: a.customer_id ?? routeCustomerId ?? "",
      address_type: a.address_type || "shipping",
      recipient_name: a.recipient_name || "",
      phone: a.phone || "",
      address_line_1: a.address_line_1 || "",
      address_line_2: a.address_line_2 || "",
      district_id: a.district_id ?? "",
      area_id: "",
      city: a.city || "",
      province: a.state || "",
      postal_code: a.postal_code || "",
      country: a.country || "Sri Lanka",
      is_default: Boolean(a.is_default)
    }

    // Load areas for the saved district first, then select the saved area
    await loadAreas(a.district_id)
    form.value.area_id = a.area_id ?? ""

    // Let the district watcher run while hydrating is still true
    await nextTick()
  } catch (error) {
    console.error("Failed to load address:", error)

    errorMessage.value =
        error.response?.data?.message ||
        error.message ||
        "Failed to load address."
  } finally {
    hydrating = false
    loadingAddress.value = false
  }
}

/* =========================
   VALIDATION
   ========================= */

const validateForm = () => {
  if (!form.value.customer_id) {
    errorMessage.value = "Please select a customer."
    return false
  }

  if (!form.value.recipient_name.trim()) {
    errorMessage.value = "Recipient name is required."
    return false
  }

  if (!form.value.phone.trim()) {
    errorMessage.value = "Phone number is required."
    return false
  }

  if (!form.value.address_line_1.trim()) {
    errorMessage.value = "Address line 1 is required."
    return false
  }

  if (!form.value.district_id) {
    errorMessage.value = "Please select a district."
    return false
  }

  if (!form.value.area_id) {
    errorMessage.value = "Please select an exact delivery area."
    return false
  }

  if (!form.value.city.trim()) {
    errorMessage.value = "City is required."
    return false
  }

  if (!form.value.country.trim()) {
    errorMessage.value = "Country is required."
    return false
  }

  return true
}

/* =========================
   SAVE
   ========================= */

const submitForm = async () => {
  errorMessage.value = ""
  successMessage.value = ""

  if (!validateForm()) return

  try {
    loading.value = true

    const payload = {
      recipient_name: form.value.recipient_name.trim(),
      address_type: form.value.address_type,
      address_line_1: form.value.address_line_1.trim(),
      address_line_2: (form.value.address_line_2 || "").trim() || null,
      district_id: form.value.district_id,
      area_id: form.value.area_id,
      city: form.value.city.trim(),
      state: (form.value.province || "").trim() || null,
      postal_code: (form.value.postal_code || "").toString().trim() || null,
      country: form.value.country.trim(),
      phone: form.value.phone.trim(),
      is_default: form.value.is_default
    }

    if (isEdit.value) {
      const response = await customerAddressApi.updateAddress(
          form.value.customer_id,
          addressId,
          payload
      )

      successMessage.value =
          response?.message || "Customer address updated successfully."
    } else {
      const response = await customerAddressApi.createAddress(
          form.value.customer_id,
          payload
      )

      successMessage.value =
          response?.message || "Customer address created successfully."
    }

    setTimeout(() => {
      router.push(LIST_ROUTE)
    }, 700)
  } catch (error) {
    console.error(
        isEdit.value ? "Update address error:" : "Create address error:",
        error
    )

    errorMessage.value =
        error.response?.data?.message || "Failed to save customer address."
  } finally {
    loading.value = false
  }
}

/* =========================
   CANCEL
   ========================= */

const cancelForm = () => {
  router.push(LIST_ROUTE)
}

/* =========================
   INIT
   ========================= */

onMounted(async () => {
  await Promise.all([loadCustomers(), loadDistricts()])

  if (isEdit.value) {
    await loadAddress()
  }
})
</script>



<template>
  <div class="address-form-page">

    <!-- Header -->
    <div class="form-header">
      <div>
        <h1>{{ isEdit ? "Edit Customer Address" : "Add Customer Address" }}</h1>

        <p>
          {{
            isEdit
                ? "Update the customer's saved address."
                : "Add a shipping or billing address for a customer."
          }}
        </p>
      </div>

      <button
          type="button"
          class="btn-secondary"
          :disabled="loading"
          @click="cancelForm"
      >
        Cancel
      </button>
    </div>

    <!-- Messages (shown above the form so the form never disappears) -->
    <div v-if="errorMessage" class="error-message">
      {{ errorMessage }}
    </div>

    <div v-if="successMessage" class="success-message">
      {{ successMessage }}
    </div>

    <!-- Loading -->
    <div v-if="loadingAddress" class="loading-message">
      Loading address...
    </div>

    <!-- Form -->
    <form v-else class="address-form" @submit.prevent="submitForm">

      <!-- Customer & Contact -->
      <section class="form-section">

        <div class="section-header">
          <h2>Customer &amp; Contact</h2>
          <p>Choose the customer and who will receive the delivery.</p>
        </div>

        <div class="form-grid">

          <div class="form-group full-width">
            <label>
              Customer
              <span class="required">*</span>
            </label>

            <SearchableSelect
                v-model="form.customer_id"
                :options="customerOptions"
                :placeholder="loadingCustomers ? 'Loading customers...' : 'Search customer...'"
                :disabled="loadingCustomers || isEdit || loading"
            />

            <small v-if="isEdit">
              The customer can't be changed after the address is created.
            </small>
          </div>

          <div class="form-group">
            <label for="recipient_name">
              Recipient Name
              <span class="required">*</span>
            </label>

            <input
                id="recipient_name"
                v-model="form.recipient_name"
                type="text"
                placeholder="Who will receive the delivery?"
                :disabled="loading"
            />
          </div>

          <div class="form-group">
            <label for="phone">
              Phone
              <span class="required">*</span>
            </label>

            <input
                id="phone"
                v-model="form.phone"
                type="tel"
                placeholder="e.g. 0771234567"
                :disabled="loading"
            />
          </div>

        </div>

      </section>

      <!-- Address -->
      <section class="form-section">

        <div class="section-header">
          <h2>Address</h2>
          <p>Enter the complete address and pick the delivery area.</p>
        </div>

        <div class="form-grid">

          <!-- Address type toggle -->
          <div class="form-group full-width">
            <label>
              Address Type
              <span class="required">*</span>
            </label>

            <div class="type-toggle" role="radiogroup" aria-label="Address type">
              <button
                  type="button"
                  role="radio"
                  class="type-option"
                  :class="{ active: form.address_type === 'shipping' }"
                  :aria-checked="form.address_type === 'shipping'"
                  :disabled="loading"
                  @click="form.address_type = 'shipping'"
              >
                <strong>Shipping</strong>
                <span>Where orders are delivered</span>
              </button>

              <button
                  type="button"
                  role="radio"
                  class="type-option"
                  :class="{ active: form.address_type === 'billing' }"
                  :aria-checked="form.address_type === 'billing'"
                  :disabled="loading"
                  @click="form.address_type = 'billing'"
              >
                <strong>Billing</strong>
                <span>Used on invoices</span>
              </button>
            </div>
          </div>

          <div class="form-group full-width">
            <label for="address_line_1">
              Address Line 1
              <span class="required">*</span>
            </label>

            <input
                id="address_line_1"
                v-model="form.address_line_1"
                type="text"
                placeholder="House number, street name"
                :disabled="loading"
            />
          </div>

          <div class="form-group full-width">
            <label for="address_line_2">Address Line 2</label>

            <input
                id="address_line_2"
                v-model="form.address_line_2"
                type="text"
                placeholder="Apartment, building, floor (optional)"
                :disabled="loading"
            />
          </div>

          <!-- District -->
          <div class="form-group">
            <label>
              District
              <span class="required">*</span>
            </label>

            <SearchableSelect
                v-model="form.district_id"
                :options="districtOptions"
                :placeholder="loadingDistricts ? 'Loading districts...' : 'Search district...'"
                :disabled="loadingDistricts || loading"
            />
          </div>

          <!-- Area -->
          <div class="form-group">
            <label>
              Area
              <span class="required">*</span>
            </label>

            <SearchableSelect
                v-model="form.area_id"
                :options="areaOptions"
                :placeholder="loadingAreas ? 'Loading areas...' : 'Search area...'"
                :disabled="!form.district_id || loadingAreas || loading"
            />

            <small v-if="!form.district_id">
              Select a district first.
            </small>
          </div>

          <div class="delivery-notice">
            <strong>Important:</strong>
            Select the exact district and area. Delivery charges are calculated
            from the selected area, so a wrong choice can give a wrong charge.
          </div>

          <div class="form-group">
            <label for="city">
              City
              <span class="required">*</span>
            </label>

            <input
                id="city"
                v-model="form.city"
                type="text"
                placeholder="Enter city"
                :disabled="loading"
            />
          </div>

          <div class="form-group">
            <label for="province">Province</label>

            <input
                id="province"
                v-model="form.province"
                type="text"
                placeholder="Enter province"
                :disabled="loading"
            />
          </div>

          <div class="form-group">
            <label for="postal_code">Postal Code</label>

            <input
                id="postal_code"
                v-model="form.postal_code"
                type="text"
                placeholder="Enter postal code"
                :disabled="loading"
            />
          </div>

          <div class="form-group">
            <label for="country">
              Country
              <span class="required">*</span>
            </label>

            <input
                id="country"
                v-model="form.country"
                type="text"
                placeholder="Enter country"
                :disabled="loading"
            />
          </div>

        </div>

      </section>

      <!-- Default -->
      <section class="form-section">

        <label class="default-option">
          <input
              v-model="form.is_default"
              type="checkbox"
              :disabled="loading"
          />

          <div>
            <strong>Set as default address</strong>
            <span>Use this address first when creating orders for this customer.</span>
          </div>
        </label>

      </section>

      <!-- Actions -->
      <div class="form-actions">
        <button
            type="button"
            class="btn-secondary"
            :disabled="loading"
            @click="cancelForm"
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
                ? "Saving..."
                : isEdit
                    ? "Save Changes"
                    : "Save Address"
          }}
        </button>
      </div>

    </form>

  </div>
</template>


<style scoped>
.address-form-page {
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

.address-form {
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
  margin-left: 2px;
  color: var(--color-danger);
}

.form-group input {
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

.form-group input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-light);
}

.form-group input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.form-group small {
  font-size: var(--font-size-xs);
  line-height: 1.5;
  color: var(--color-text-muted);
}

/* =========================
   Address Type Toggle
   ========================= */

.type-toggle {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--spacing-md);
}

.type-option {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: var(--spacing-md) var(--spacing-lg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color var(--transition-fast),
  background var(--transition-fast),
  box-shadow var(--transition-fast);
}

.type-option strong {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.type-option span {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.type-option:hover:not(:disabled):not(.active) {
  background: var(--color-hover-bg);
}

.type-option.active {
  border-color: var(--color-primary);
  background: var(--color-primary-light);
  box-shadow: 0 0 0 3px var(--color-primary-light);
}

.type-option:focus-visible {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-light);
}

.type-option:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* =========================
   Delivery Notice
   ========================= */

.delivery-notice {
  grid-column: 1 / -1;
  padding: var(--spacing-md) var(--spacing-lg);
  border-radius: var(--radius-lg);
  background: var(--color-info-bg);
  color: var(--color-info);
  font-size: var(--font-size-sm);
  line-height: 1.5;
}

.delivery-notice strong {
  font-weight: var(--font-weight-semibold);
}

/* =========================
   Default Address
   ========================= */

.default-option {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-md);
  cursor: pointer;
}

.default-option input {
  width: 18px;
  height: 18px;
  margin-top: 2px;
  flex-shrink: 0;
  cursor: pointer;
  accent-color: var(--color-primary);
}

.default-option strong {
  display: block;
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.default-option span {
  display: block;
  margin-top: 2px;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
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

  .form-grid,
  .type-toggle {
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
