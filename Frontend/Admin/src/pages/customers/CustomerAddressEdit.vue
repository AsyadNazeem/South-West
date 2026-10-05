<script setup>
import { ref, onMounted } from "vue"
import { useRoute, useRouter } from "vue-router"
import api from "../../api/axios"

const route = useRoute()
const router = useRouter()

const customerId = route.params.customerId
const addressId = route.params.addressId

const loading = ref(true)
const saving = ref(false)
const errorMessage = ref("")
const successMessage = ref("")

const form = ref({
  address_type: "shipping",
  recipient_name: "",
  phone: "",
  address_line_1: "",
  address_line_2: "",
  city: "",
  state: "",
  postal_code: "",
  country: "Sri Lanka",
  is_default: false
})

const loadAddress = async () => {
  try {
    loading.value = true
    errorMessage.value = ""

    const response = await api.get(
        `/customers/${customerId}/addresses`
    )

    const addresses = response.data.data || []

    const address = addresses.find(
        (item) => String(item.id) === String(addressId)
    )

    if (!address) {
      errorMessage.value = "Customer address not found."
      return
    }

    form.value = {
      address_type: address.address_type || "shipping",
      recipient_name: address.recipient_name || "",
      phone: address.phone || "",
      address_line_1: address.address_line_1 || "",
      address_line_2: address.address_line_2 || "",
      city: address.city || "",
      state: address.state || address.province || "",
      postal_code: address.postal_code || "",
      country: address.country || "Sri Lanka",
      is_default: Boolean(address.is_default)
    }

  } catch (error) {
    console.error("Load address error:", error)

    errorMessage.value =
        error.response?.data?.message ||
        "Failed to load address."
  } finally {
    loading.value = false
  }
}

const updateAddress = async () => {
  try {
    saving.value = true
    errorMessage.value = ""
    successMessage.value = ""

    if (
        !form.value.recipient_name ||
        !form.value.phone ||
        !form.value.address_line_1 ||
        !form.value.city
    ) {
      errorMessage.value =
          "Recipient name, phone, address line 1 and city are required."

      return
    }

    await api.put(
        `/customers/${customerId}/addresses/${addressId}`,

        form.value
    )

    successMessage.value =
        "Customer address updated successfully."

    setTimeout(() => {
      router.push("/customers/addresses")
    }, 1000)

  } catch (error) {
    console.error("Update address error:", error)

    errorMessage.value =
        error.response?.data?.message ||
        "Failed to update customer address."
  } finally {
    saving.value = false
  }
}

const cancelEdit = () => {
  router.push("/admin/customers/addresses")
}

onMounted(loadAddress)
</script>

<template>
  <div class="page-container">

    <!-- Header -->
    <div class="page-header">
      <div>
        <h1>Edit Customer Address</h1>

        <p>
          Update the customer's address information.
        </p>
      </div>

      <button
          class="secondary-button"
          @click="cancelEdit"
      >
        Back
      </button>
    </div>

    <!-- Loading -->
    <div
        v-if="loading"
        class="empty-state"
    >
      Loading address...
    </div>

    <template v-else>

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

      <!-- Form -->
      <div class="form-card">

        <!-- Address Type -->
        <div class="form-group">
          <label>
            Address Type
          </label>

          <select v-model="form.address_type">
            <option value="shipping">
              Shipping
            </option>

            <option value="billing">
              Billing
            </option>
          </select>
        </div>

        <!-- Recipient -->
        <div class="form-group">
          <label>
            Recipient Name
          </label>

          <input
              v-model="form.recipient_name"
              type="text"
              placeholder="Enter recipient name"
          />
        </div>

        <!-- Phone -->
        <div class="form-group">
          <label>
            Phone
          </label>

          <input
              v-model="form.phone"
              type="text"
              placeholder="Enter phone number"
          />
        </div>

        <!-- Address Line 1 -->
        <div class="form-group">
          <label>
            Address Line 1
          </label>

          <input
              v-model="form.address_line_1"
              type="text"
              placeholder="House number, street name"
          />
        </div>

        <!-- Address Line 2 -->
        <div class="form-group">
          <label>
            Address Line 2
          </label>

          <input
              v-model="form.address_line_2"
              type="text"
              placeholder="Apartment, building, landmark"
          />
        </div>

        <!-- City -->
        <div class="form-group">
          <label>
            City
          </label>

          <input
              v-model="form.city"
              type="text"
              placeholder="Enter city"
          />
        </div>

        <!-- State -->
        <div class="form-group">
          <label>
            Province / State
          </label>

          <input
              v-model="form.state"
              type="text"
              placeholder="Enter province or state"
          />
        </div>

        <!-- Postal Code -->
        <div class="form-group">
          <label>
            Postal Code
          </label>

          <input
              v-model="form.postal_code"
              type="text"
              placeholder="Enter postal code"
          />
        </div>

        <!-- Country -->
        <div class="form-group">
          <label>
            Country
          </label>

          <input
              v-model="form.country"
              type="text"
              placeholder="Enter country"
          />
        </div>

        <!-- Default -->
        <div class="checkbox-group">
          <label>
            <input
                v-model="form.is_default"
                type="checkbox"
            />

            Set as default address
          </label>
        </div>

        <!-- Buttons -->
        <div class="form-actions">

          <button
              type="button"
              class="secondary-button"
              @click="cancelEdit"
          >
            Cancel
          </button>

          <button
              type="button"
              class="primary-button"
              :disabled="saving"
              @click="updateAddress"
          >
            {{ saving ? "Updating..." : "Update Address" }}
          </button>

        </div>

      </div>

    </template>

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
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--spacing-xl);
  background: var(--color-surface);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  padding: var(--spacing-xl);
}

/* =========================
   Form Fields
   ========================= */

.form-group {
  display: flex;
  flex-direction: column;
}

.form-group label {
  margin-bottom: var(--spacing-sm);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
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

/* =========================
   Checkbox
   ========================= */

.checkbox-group {
  grid-column: 1 / -1;
}

.checkbox-group label {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-size: var(--font-size-md);
  color: var(--color-text-secondary);
  cursor: pointer;
}

.checkbox-group input {
  width: 16px;
  height: 16px;
  accent-color: var(--color-primary);
  cursor: pointer;
}

/* =========================
   Actions
   ========================= */

.form-actions {
  grid-column: 1 / -1;
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-md);
  padding-top: var(--spacing-xl);
  border-top: 1px solid var(--color-border-light);
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

.empty-state {
  padding: 50px var(--spacing-xl);
  text-align: center;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

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

  .form-card {
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
