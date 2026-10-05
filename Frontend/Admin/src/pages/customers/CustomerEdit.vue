<script setup>
import { ref, onMounted } from "vue"
import { useRoute, useRouter } from "vue-router"
import api from "../../api/axios"

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const saving = ref(false)
const errorMessage = ref("")
const successMessage = ref("")

const customer = ref({
  id: null,
  customer_code: "",
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  is_active: true
})

const loadCustomer = async () => {
  try {
    loading.value = true
    errorMessage.value = ""

    const customerId = route.params.id

    const response = await api.get(`/customers/${customerId}`)

    customer.value = response.data.data

  } catch (error) {
    console.error("Customer loading error:", error)

    errorMessage.value =
        error.response?.data?.message ||
        "Failed to load customer."
  } finally {
    loading.value = false
  }
}


const updateCustomer = async () => {
  try {
    saving.value = true
    errorMessage.value = ""
    successMessage.value = ""

    const customerId = route.params.id

    const payload = {
      customer_code: customer.value.customer_code,
      first_name: customer.value.first_name,
      last_name: customer.value.last_name,
      email: customer.value.email,
      phone: customer.value.phone,
      is_active: customer.value.is_active
    }

    const response = await api.put(
        `/customers/${customerId}`,
        payload
    )

    customer.value = response.data.data

    successMessage.value =
        response.data.message ||
        "Customer updated successfully."

  } catch (error) {
    console.error("Customer update error:", error)

    errorMessage.value =
        error.response?.data?.message ||
        "Failed to update customer."
  } finally {
    saving.value = false
  }
}


const toggleCustomerStatus = async () => {

  const customerId = route.params.id

  const newStatus = !customer.value.is_active

  const action = newStatus
      ? "reactivate"
      : "deactivate"

  const confirmed = confirm(
      `Are you sure you want to ${action} this customer?`
  )

  if (!confirmed) {
    return
  }

  try {
    saving.value = true
    errorMessage.value = ""
    successMessage.value = ""

    const response = await api.put(
        `/customers/${customerId}`,
        {
          is_active: newStatus
        }
    )

    customer.value = response.data.data

    successMessage.value =
        newStatus
            ? "Customer reactivated successfully."
            : "Customer deactivated successfully."

  } catch (error) {
    console.error(
        "Customer status update error:",
        error
    )

    errorMessage.value =
        error.response?.data?.message ||
        `Failed to ${action} customer.`
  } finally {
    saving.value = false
  }
}


const cancelEdit = () => {
  router.push(`/admin/customers/view/${route.params.id}`)
}


const goBack = () => {
  router.push("/admin/customers/all-customers")
}


onMounted(loadCustomer)
</script>


<template>

  <div class="page-container">

    <!-- Header -->
    <div class="page-header">

      <div>
        <h1>
          Edit Customer
        </h1>

        <p>
          Update customer information and account status.
        </p>
      </div>

      <div class="header-actions">

        <button
            type="button"
            class="secondary-button"
            @click="goBack"
        >
          Back
        </button>

        <button
            type="button"
            class="secondary-button"
            @click="cancelEdit"
        >
          Cancel
        </button>

      </div>

    </div>


    <!-- Loading -->
    <div
        v-if="loading"
        class="empty-state"
    >
      Loading customer...
    </div>


    <!-- Error -->
    <div
        v-else-if="errorMessage"
        class="error-state"
    >
      {{ errorMessage }}
    </div>


    <!-- Form -->
    <form
        v-else
        class="form-card"
        @submit.prevent="updateCustomer"
    >

      <!-- Customer Information -->
      <div class="section">

        <div class="section-header">

          <div>
            <h2>Customer Information</h2>

            <p>
              Update the customer's basic information.
            </p>
          </div>

        </div>


        <div class="form-grid">

          <!-- Customer Code -->
          <div class="form-group">

            <label for="customer_code">
              Customer Code
            </label>

            <input
                id="customer_code"
                v-model="customer.customer_code"
                type="text"
                placeholder="CUS-0001"
                required
            />

          </div>


          <!-- Status -->
          <div class="form-group">

            <label>
              Account Status
            </label>

            <div class="status-display">

                            <span
                                class="status-badge"
                                :class="customer.is_active
                                    ? 'active'
                                    : 'inactive'"
                            >
                                {{
                                customer.is_active
                                    ? "Active"
                                    : "Inactive"
                              }}
                            </span>

            </div>

          </div>


          <!-- First Name -->
          <div class="form-group">

            <label for="first_name">
              First Name
            </label>

            <input
                id="first_name"
                v-model="customer.first_name"
                type="text"
                placeholder="First name"
                required
            />

          </div>


          <!-- Last Name -->
          <div class="form-group">

            <label for="last_name">
              Last Name
            </label>

            <input
                id="last_name"
                v-model="customer.last_name"
                type="text"
                placeholder="Last name"
                required
            />

          </div>


          <!-- Email -->
          <div class="form-group">

            <label for="email">
              Email
            </label>

            <input
                id="email"
                v-model="customer.email"
                type="email"
                placeholder="customer@example.com"
                required
            />

          </div>


          <!-- Phone -->
          <div class="form-group">

            <label for="phone">
              Phone
            </label>

            <input
                id="phone"
                v-model="customer.phone"
                type="text"
                placeholder="0771234567"
            />

          </div>

        </div>

      </div>


      <!-- Account Status -->
      <div class="section status-section">

        <div>

          <h2>
            Account Status
          </h2>

          <p>
            Deactivating a customer prevents the account
            from being treated as active.
          </p>

        </div>


        <div class="status-action">

          <div>

            <strong>
              {{
                customer.is_active
                    ? "Customer is Active"
                    : "Customer is Inactive"
              }}
            </strong>

            <p>
              {{
                customer.is_active
                    ? "This customer is currently active."
                    : "This customer is currently inactive."
              }}
            </p>

          </div>


          <button
              type="button"
              :class="
                            customer.is_active
                                ? 'danger-button'
                                : 'activate-button'
                        "
              :disabled="saving"
              @click="toggleCustomerStatus"
          >

            {{
              customer.is_active
                  ? "Deactivate Customer"
                  : "Reactivate Customer"
            }}

          </button>

        </div>

      </div>


      <!-- Messages -->
      <div
          v-if="successMessage"
          class="success-state"
      >
        {{ successMessage }}
      </div>


      <div
          v-if="errorMessage"
          class="error-state"
      >
        {{ errorMessage }}
      </div>


      <!-- Form Actions -->
      <div class="form-actions">

        <button
            type="button"
            class="secondary-button"
            :disabled="saving"
            @click="cancelEdit"
        >
          Cancel
        </button>


        <button
            type="submit"
            class="primary-button"
            :disabled="saving"
        >

          {{
            saving
                ? "Saving..."
                : "Save Changes"
          }}

        </button>

      </div>

    </form>

  </div>

</template>


<style scoped>

.page-container {
  padding: 24px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
}

.page-header h1 {
  margin: 0 0 6px;
  font-size: 28px;
}

.page-header p {
  margin: 0;
  color: #6b7280;
}

.header-actions {
  display: flex;
  gap: 10px;
}

.form-card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  overflow: hidden;
}

.section {
  padding: 24px;
  border-bottom: 1px solid #e5e7eb;
}

.section-header {
  margin-bottom: 22px;
}

.section h2 {
  margin: 0 0 5px;
  font-size: 19px;
}

.section p {
  margin: 0;
  color: #6b7280;
  font-size: 14px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.form-group label {
  font-size: 14px;
  font-weight: 500;
  color: #374151;
}

.form-group input {
  width: 100%;
  box-sizing: border-box;
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  outline: none;
}

.form-group input:focus {
  border-color: #111827;
}

.status-display {
  min-height: 40px;
  display: flex;
  align-items: center;
}

.status-badge {
  display: inline-flex;
  padding: 5px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
}

.status-badge.active {
  background: #dcfce7;
  color: #166534;
}

.status-badge.inactive {
  background: #fee2e2;
  color: #991b1b;
}

.status-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
}

.status-action {
  display: flex;
  align-items: center;
  gap: 20px;
}

.status-action strong {
  display: block;
  margin-bottom: 4px;
}

.status-action p {
  font-size: 13px;
}

.primary-button,
.secondary-button,
.danger-button,
.activate-button {
  border: none;
  border-radius: 6px;
  padding: 10px 15px;
  font-size: 14px;
  cursor: pointer;
}

.primary-button {
  background: #111827;
  color: white;
}

.secondary-button {
  background: #e5e7eb;
  color: #111827;
}

.danger-button {
  background: #dc2626;
  color: white;
}

.activate-button {
  background: #16a34a;
  color: white;
}

.primary-button:disabled,
.secondary-button:disabled,
.danger-button:disabled,
.activate-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.form-actions {
  padding: 20px 24px;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.success-state {
  margin: 20px 24px 0;
  padding: 12px 15px;
  border-radius: 6px;
  background: #dcfce7;
  color: #166534;
}

.error-state {
  margin: 20px 24px;
  padding: 12px 15px;
  border-radius: 6px;
  background: #fee2e2;
  color: #991b1b;
}

.empty-state {
  padding: 40px;
  text-align: center;
  color: #6b7280;
}

@media (max-width: 768px) {

  .page-header {
    flex-direction: column;
    gap: 15px;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }

  .status-section {
    flex-direction: column;
    align-items: flex-start;
  }

  .status-action {
    width: 100%;
    flex-direction: column;
    align-items: flex-start;
  }

  .status-action button {
    width: 100%;
  }

}

</style>
