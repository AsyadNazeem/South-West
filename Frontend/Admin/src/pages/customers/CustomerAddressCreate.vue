<script setup>
import { ref, onMounted } from "vue"
import { useRouter } from "vue-router"
import api from "../../api/axios"

const router = useRouter()

const loading = ref(false)
const loadingCustomers = ref(true)
const errorMessage = ref("")
const successMessage = ref("")

const customers = ref([])

const form = ref({
  customer_id: "",
  recipient_name: "",
  address_type: "shipping",
  address_line_1: "",
  address_line_2: "",
  city: "",
  province: "",
  postal_code: "",
  country: "Sri Lanka",
  phone: "",
  is_default: false
})

const loadCustomers = async () => {
  try {
    loadingCustomers.value = true

    const response = await api.get("/customers")

    customers.value = response.data.data || []
  } catch (error) {
    console.error("Customer loading error:", error)

    errorMessage.value =
        error.response?.data?.message ||
        "Failed to load customers."
  } finally {
    loadingCustomers.value = false
  }
}

const submitForm = async () => {
  errorMessage.value = ""
  successMessage.value = ""

  if (!form.value.customer_id) {
    errorMessage.value = "Please select a customer."
    return
  }

  if (!form.value.recipient_name.trim()) {
    errorMessage.value = "Recipient name is required."
    return
  }

  if (!form.value.phone.trim()) {
    errorMessage.value = "Phone number is required."
    return
  }

  if (!form.value.address_line_1.trim()) {
    errorMessage.value = "Address line 1 is required."
    return
  }

  if (!form.value.city.trim()) {
    errorMessage.value = "City is required."
    return
  }

  if (!form.value.country.trim()) {
    errorMessage.value = "Country is required."
    return
  }

  try {
    loading.value = true

    await api.post(`/customers/${form.value.customer_id}/addresses`, {
      recipient_name: form.value.recipient_name.trim(),
      address_type: form.value.address_type,
      address_line_1: form.value.address_line_1.trim(),
      address_line_2: form.value.address_line_2.trim() || null,
      city: form.value.city.trim(),
      state: form.value.province.trim() || null,
      postal_code: form.value.postal_code.trim() || null,
      country: form.value.country.trim(),
      phone: form.value.phone.trim(),
      is_default: form.value.is_default
    })

    successMessage.value = "Customer address created successfully."

    setTimeout(() => {
      router.push("/admin/customers/addresses")
    }, 700)

  } catch (error) {
    console.error("Create address error:", error)

    errorMessage.value =
        error.response?.data?.message ||
        "Failed to create customer address."
  } finally {
    loading.value = false
  }
}

const cancelForm = () => {
  router.push("/admin/customers/addresses")
}

onMounted(loadCustomers)
</script>

<template>
  <div class="page-container">

    <!-- Header -->
    <div class="page-header">
      <div>
        <h1>Add Customer Address</h1>

        <p>
          Add a shipping or billing address for a customer.
        </p>
      </div>
    </div>


    <!-- Error -->
    <div
        v-if="errorMessage"
        class="error-state"
    >
      {{ errorMessage }}
    </div>


    <!-- Success -->
    <div
        v-if="successMessage"
        class="success-state"
    >
      {{ successMessage }}
    </div>


    <!-- Form Card -->
    <div class="form-card">

      <form @submit.prevent="submitForm">

        <!-- Customer Information -->
        <div class="form-section">

          <div class="form-grid">

            <!-- Customer -->
            <div class="form-group full-width">

              <label for="customer">
                Customer
                <span class="required">*</span>
              </label>

              <select
                  id="customer"
                  v-model="form.customer_id"
                  :disabled="loadingCustomers"
              >
                <option value="">
                  {{
                    loadingCustomers
                        ? "Loading customers..."
                        : "Select customer"
                  }}
                </option>

                <option
                    v-for="customer in customers"
                    :key="customer.id"
                    :value="customer.id"
                >
                  {{ customer.first_name }}
                  {{ customer.last_name }}
                  -
                  {{ customer.customer_code }}
                </option>
              </select>

            </div>


            <!-- Recipient -->
            <div class="form-group">

              <label for="recipient_name">
                Recipient Name
                <span class="required">*</span>
              </label>

              <input
                  id="recipient_name"
                  v-model="form.recipient_name"
                  type="text"
                  placeholder="Enter recipient name"
              />

            </div>


            <!-- Phone -->
            <div class="form-group">

              <label for="phone">
                Phone
                <span class="required">*</span>
              </label>

              <input
                  id="phone"
                  v-model="form.phone"
                  type="text"
                  placeholder="Enter phone number"
              />

            </div>

          </div>

        </div>


        <!-- Address Type -->
        <div class="form-section">

          <div class="form-section-header">
            <h2>Address Type</h2>

            <p>
              Specify how this address will be used.
            </p>
          </div>


          <div class="form-grid">

            <div class="form-group">

              <label for="address_type">
                Address Type
                <span class="required">*</span>
              </label>

              <select
                  id="address_type"
                  v-model="form.address_type"
              >
                <option value="shipping">
                  Shipping
                </option>

                <option value="billing">
                  Billing
                </option>
              </select>

            </div>

          </div>

        </div>


        <!-- Address Details -->
        <div class="form-section">

          <div class="form-section-header">
            <h2>Address Details</h2>

            <p>
              Enter the complete customer address.
            </p>
          </div>


          <div class="form-grid">

            <!-- Address Line 1 -->
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
              />

            </div>


            <!-- Address Line 2 -->
            <div class="form-group full-width">

              <label for="address_line_2">
                Address Line 2
              </label>

              <input
                  id="address_line_2"
                  v-model="form.address_line_2"
                  type="text"
                  placeholder="Apartment, building, floor, etc."
              />

            </div>


            <!-- City -->
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
              />

            </div>


            <!-- Province -->
            <div class="form-group">

              <label for="province">
                Province
              </label>

              <input
                  id="province"
                  v-model="form.province"
                  type="text"
                  placeholder="Enter province"
              />

            </div>


            <!-- Postal Code -->
            <div class="form-group">

              <label for="postal_code">
                Postal Code
              </label>

              <input
                  id="postal_code"
                  v-model="form.postal_code"
                  type="text"
                  placeholder="Enter postal code"
              />

            </div>


            <!-- Country -->
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
              />

            </div>

          </div>

        </div>


        <!-- Default Address -->
        <div class="form-section">

          <div class="form-section-header">
            <h2>Default Address</h2>

            <p>
              Choose whether this address should be used as
              the customer's default address.
            </p>
          </div>


          <div class="checkbox-group">
            <label class="checkbox-label">
              <input
                  v-model="form.is_default"
                  type="checkbox"
              />

              <span>
      Set as default address
    </span>
            </label>
          </div>

        </div>


        <!-- Actions -->
        <div class="form-actions">

          <button
              type="button"
              class="secondary-button"
              @click="cancelForm"
              :disabled="loading"
          >
            Cancel
          </button>

          <button
              type="submit"
              class="primary-button"
              :disabled="loading"
          >
            {{ loading ? "Saving..." : "Save Address" }}
          </button>

        </div>

      </form>

    </div>

  </div>
</template>

<style scoped>
.page-container {
  width: 100%;
  font-family: var(--font-family);
}

/* =========================
   Page Header
   ========================= */

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--spacing-lg);
  margin-bottom: var(--spacing-2xl);
}

.page-header h1 {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
}

.page-header p {
  margin-top: 5px;
  font-size: var(--font-size-md);
  color: var(--color-text-secondary);
}

/* =========================
   Form Card
   ========================= */

.form-card {
  max-width: 1900px;
  background: var(--color-surface);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  padding: var(--spacing-xl);
}

.form-section {
  padding-bottom: var(--spacing-xl);
  margin-bottom: var(--spacing-xl);
  border-bottom: 1px solid var(--color-border-light);
}

.form-section-header {
  margin-bottom: var(--spacing-lg);
}

.form-section-header h2 {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.form-section-header p {
  margin-top: var(--spacing-xs);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

/* =========================
   Form Fields
   ========================= */

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--spacing-xl);
}

.form-group {
  display: flex;
  flex-direction: column;
}

.form-group.full-width {
  grid-column: 1 / -1;
}

.form-group label {
  margin-bottom: var(--spacing-sm);
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
  height: 42px;
  padding: 0 var(--spacing-lg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  color: var(--color-text-primary);
  font-family: inherit;
  font-size: var(--font-size-md);
  box-sizing: border-box;
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

.form-group select:disabled {
  background: var(--color-hover-bg);
  color: var(--color-text-muted);
  cursor: not-allowed;
}

/* =========================
   Checkbox
   ========================= */

.checkbox-group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.checkbox-label {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-size: var(--font-size-md);
  color: var(--color-text-secondary);
  cursor: pointer;
}

.checkbox-label input {
  width: 16px;
  height: 16px;
  accent-color: var(--color-primary);
  cursor: pointer;
}

/* =========================
   Actions
   ========================= */

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-md);
}

.primary-button,
.secondary-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 10px var(--spacing-lg);
  border-radius: var(--radius-lg);
  font-family: inherit;
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  text-decoration: none;
  white-space: nowrap;
  cursor: pointer;
  transition: background var(--transition-fast),
  border-color var(--transition-fast),
  color var(--transition-fast);
}

.primary-button {
  border: 1px solid var(--color-primary);
  background: var(--color-primary);
  color: var(--color-text-light);
}

.primary-button:hover:not(:disabled) {
  border-color: var(--color-primary-hover);
  background: var(--color-primary-hover);
}

.secondary-button {
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text-secondary);
}

.secondary-button:hover:not(:disabled) {
  background: var(--color-hover-bg);
  color: var(--color-text-primary);
}

.primary-button:disabled,
.secondary-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* =========================
   States
   ========================= */

.error-state,
.success-state {
  margin-bottom: var(--spacing-lg);
  padding: var(--spacing-md) var(--spacing-lg);
  border-radius: var(--radius-lg);
  font-size: var(--font-size-sm);
}

.error-state {
  background: var(--color-danger-bg);
  color: var(--color-danger);
}

.success-state {
  background: var(--color-success-bg);
  color: var(--color-success);
}

/* =========================
   Responsive
   ========================= */

@media (max-width: 700px) {
  .page-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .form-grid {
    grid-template-columns: 1fr;
    gap: var(--spacing-lg);
  }

  .form-actions {
    flex-direction: column-reverse;
  }

  .form-actions button {
    width: 100%;
  }
}
</style>
