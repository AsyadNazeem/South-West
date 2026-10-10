<script setup>
import { ref, computed, onMounted } from "vue"
import { useRoute, useRouter } from "vue-router"
import api from "../../api/axios"

const route = useRoute()
const router = useRouter()

/*
|--------------------------------------------------------------------------
| Mode
|--------------------------------------------------------------------------
*/

const isEdit = computed(() => !!route.params.id)

/*
|--------------------------------------------------------------------------
| Form
|--------------------------------------------------------------------------
*/

const form = ref({
  id: null,
  customer_code: "",
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  is_active: true
})

/*
|--------------------------------------------------------------------------
| State
|--------------------------------------------------------------------------
*/

const loading = ref(false)
const saving = ref(false)
const errorMessage = ref("")
const successMessage = ref("")

/*
|--------------------------------------------------------------------------
| Load Customer
|--------------------------------------------------------------------------
*/

const loadCustomer = async () => {
  if (!isEdit.value) {
    loading.value = false
    return
  }

  try {
    loading.value = true
    errorMessage.value = ""

    const customerId = route.params.id

    const response = await api.get(`/customers/${customerId}`)

    form.value = {
      id: response.data.data.id,
      customer_code: response.data.data.customer_code || "",
      first_name: response.data.data.first_name || "",
      last_name: response.data.data.last_name || "",
      email: response.data.data.email || "",
      phone: response.data.data.phone || "",
      is_active: !!response.data.data.is_active
    }

  } catch (error) {
    console.error("Customer loading error:", error)

    errorMessage.value =
        error.response?.data?.message ||
        "Failed to load customer."

  } finally {
    loading.value = false
  }
}

/*
|--------------------------------------------------------------------------
| Validate Form
|--------------------------------------------------------------------------
*/

const validateForm = () => {
  if (
      !form.value.customer_code.trim() ||
      !form.value.first_name.trim() ||
      !form.value.last_name.trim() ||
      !form.value.phone.trim()
  ) {
    errorMessage.value =
        "Customer code, first name, last name and phone are required."

    return false
  }

  return true
}

/*
|--------------------------------------------------------------------------
| Submit
|--------------------------------------------------------------------------
*/

const submitCustomer = async () => {
  errorMessage.value = ""
  successMessage.value = ""

  if (!validateForm()) {
    return
  }

  try {
    saving.value = true

    const payload = {
      customer_code: form.value.customer_code.trim(),
      first_name: form.value.first_name.trim(),
      last_name: form.value.last_name.trim(),
      email: form.value.email.trim() || null,
      phone: form.value.phone.trim()
    }

    /*
    |--------------------------------------------------------------------------
    | CREATE
    |--------------------------------------------------------------------------
    */

    if (!isEdit.value) {

      const response = await api.post(
          "/customers",
          payload
      )

      successMessage.value =
          response.data.message ||
          "Customer created successfully."

      setTimeout(() => {
        router.push("/admin/customers/all-customers")
      }, 800)

      return
    }

    /*
    |--------------------------------------------------------------------------
    | UPDATE
    |--------------------------------------------------------------------------
    */

    const customerId = route.params.id

    const updatePayload = {
      ...payload,
      is_active: form.value.is_active
    }

    const response = await api.put(
        `/customers/${customerId}`,
        updatePayload
    )

    form.value = {
      id: response.data.data.id,
      customer_code: response.data.data.customer_code || "",
      first_name: response.data.data.first_name || "",
      last_name: response.data.data.last_name || "",
      email: response.data.data.email || "",
      phone: response.data.data.phone || "",
      is_active: !!response.data.data.is_active
    }

    successMessage.value =
        response.data.message ||
        "Customer updated successfully."

  } catch (error) {
    console.error(
        isEdit.value
            ? "Customer update error:"
            : "Customer create error:",
        error
    )

    errorMessage.value =
        error.response?.data?.message ||
        "Failed to save customer."

  } finally {
    saving.value = false
  }
}

/*
|--------------------------------------------------------------------------
| Toggle Customer Status
|--------------------------------------------------------------------------
*/

const toggleCustomerStatus = async () => {

  if (!isEdit.value) {
    return
  }

  const customerId = route.params.id

  const newStatus = !form.value.is_active

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

    form.value = {
      ...form.value,
      ...response.data.data,
      is_active: !!response.data.data.is_active
    }

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

/*
|--------------------------------------------------------------------------
| Navigation
|--------------------------------------------------------------------------
*/

const cancel = () => {
  if (isEdit.value) {
    router.push(`/admin/customers/view/${route.params.id}`)
  } else {
    router.push("/admin/customers/all-customers")
  }
}

const goBack = () => {
  router.push("/admin/customers/all-customers")
}

/*
|--------------------------------------------------------------------------
| Page Load
|--------------------------------------------------------------------------
*/

onMounted(loadCustomer)
</script>


<template>

  <div class="page-container">

    <!-- Header -->
    <div class="page-header">

      <div>
        <h1>
          {{ isEdit ? "Edit Customer" : "Create Customer" }}
        </h1>

        <p>
          {{
            isEdit
                ? "Update customer information and account status."
                : "Enter the customer's basic account information."
          }}
        </p>
      </div>

      <div class="header-actions">

        <button
            v-if="isEdit"
            type="button"
            class="secondary-button"
            @click="goBack"
        >
          Back
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
        v-else-if="errorMessage && isEdit && !form.id"
        class="error-state"
    >
      {{ errorMessage }}
    </div>


    <!-- Form -->
    <form
        v-else
        class="form-card"
        @submit.prevent="submitCustomer"
    >

      <!-- Customer Information -->
      <div class="section">

        <div class="section-header">

          <div>
            <h2>
              Customer Information
            </h2>

            <p>
              {{
                isEdit
                    ? "Update the customer's basic information."
                    : "Enter the customer's basic account information."
              }}
            </p>
          </div>

        </div>


        <div class="form-grid">

          <!-- Customer Code -->
          <div class="form-group">

            <label for="customer_code">
              Customer Code
              <span>*</span>
            </label>

            <input
                id="customer_code"
                v-model="form.customer_code"
                type="text"
                placeholder="CUS-00001"
                maxlength="50"
                required
                :disabled="saving"
            />

            <small>
              A unique code used to identify the customer.
            </small>

          </div>


          <!-- Account Status -->
          <div
              v-if="isEdit"
              class="form-group"
          >

            <label>
              Account Status
            </label>

            <div class="status-display">

                            <span
                                class="status-badge"
                                :class="
                                    form.is_active
                                        ? 'active'
                                        : 'inactive'
                                "
                            >
                                {{
                                form.is_active
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
              <span>*</span>
            </label>

            <input
                id="first_name"
                v-model="form.first_name"
                type="text"
                placeholder="First name"
                maxlength="100"
                required
                :disabled="saving"
            />

          </div>


          <!-- Last Name -->
          <div class="form-group">

            <label for="last_name">
              Last Name
              <span>*</span>
            </label>

            <input
                id="last_name"
                v-model="form.last_name"
                type="text"
                placeholder="Last name"
                maxlength="100"
                required
                :disabled="saving"
            />

          </div>


          <!-- Email -->
          <div class="form-group">

            <label for="email">
              Email Address
            </label>

            <input
                id="email"
                v-model="form.email"
                type="email"
                placeholder="customer@example.com"
                maxlength="150"
                :disabled="saving"
            />

          </div>


          <!-- Phone -->
          <div class="form-group">

            <label for="phone">
              Phone Number
              <span>*</span>
            </label>

            <input
                id="phone"
                v-model="form.phone"
                type="tel"
                placeholder="0771234567"
                maxlength="30"
                required
                :disabled="saving"
            />

          </div>

        </div>

      </div>


      <!-- Account Status -->
      <div
          v-if="isEdit"
          class="section status-section"
      >

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
                form.is_active
                    ? "Customer is Active"
                    : "Customer is Inactive"
              }}
            </strong>

            <p>
              {{
                form.is_active
                    ? "This customer is currently active."
                    : "This customer is currently inactive."
              }}
            </p>

          </div>


          <button
              type="button"
              :class="
                            form.is_active
                                ? 'danger-button'
                                : 'activate-button'
                        "
              :disabled="saving"
              @click="toggleCustomerStatus"
          >

            {{
              form.is_active
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
            @click="cancel"
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
                ? (isEdit ? "Saving..." : "Creating...")
                : (isEdit ? "Save Changes" : "Create Customer")
          }}

        </button>

      </div>

    </form>

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
  margin: 0;
}

.page-header p {
  margin-top: 5px;
  font-size: var(--font-size-md);
  color: var(--color-text-secondary);
}


/* =========================
   Header Actions
   ========================= */

.header-actions {
  display: flex;
  gap: var(--spacing-md);
}


/* =========================
   Card
   ========================= */

.form-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}


/* =========================
   Section
   ========================= */

.section {
  padding: var(--spacing-xl);
  border-bottom: 1px solid var(--color-border-light);
}

.section-header {
  margin-bottom: var(--spacing-xl);
}

.section-header h2,
.section h2 {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0 0 5px;
}

.section-header p,
.section p {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  margin: 0;
}


/* =========================
   Form Grid
   ========================= */

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--spacing-xl);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.form-group label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.form-group label span {
  margin-left: 2px;
  color: var(--color-danger);
}

.form-group input {
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
  transition:
      border-color var(--transition-fast),
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
  background: var(--color-hover-bg);
  cursor: not-allowed;
}

.form-group small {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}


/* =========================
   Status
   ========================= */

.status-display {
  min-height: 42px;
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
  background: var(--color-success-bg);
  color: var(--color-success);
}

.status-badge.inactive {
  background: var(--color-danger-bg);
  color: var(--color-danger);
}

.status-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--spacing-xl);
}

.status-action {
  display: flex;
  align-items: center;
  gap: var(--spacing-xl);
}

.status-action strong {
  display: block;
  margin-bottom: 4px;
}

.status-action p {
  font-size: var(--font-size-sm);
}


/* =========================
   Form Actions
   ========================= */

.form-actions {
  padding: var(--spacing-xl);
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-md);
}


/* =========================
   Buttons
   ========================= */

.primary-button,
.secondary-button,
.danger-button,
.activate-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 10px var(--spacing-lg);
  border-radius: var(--radius-lg);
  font-family: inherit;
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  white-space: nowrap;
  cursor: pointer;
  transition:
      background var(--transition-fast),
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

.danger-button {
  border: 1px solid var(--color-danger);
  background: var(--color-danger);
  color: var(--color-text-light);
}

.activate-button {
  border: 1px solid var(--color-success);
  background: var(--color-success);
  color: var(--color-text-light);
}

.primary-button:disabled,
.secondary-button:disabled,
.danger-button:disabled,
.activate-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}


/* =========================
   Messages
   ========================= */

.error-state,
.success-state {
  margin: var(--spacing-lg) var(--spacing-xl) 0;
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
   Loading
   ========================= */

.empty-state {
  padding: 40px;
  text-align: center;
  color: var(--color-text-secondary);
}


/* =========================
   Responsive
   ========================= */

@media (max-width: 768px) {

  .page-header {
    flex-direction: column;
    align-items: flex-start;
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

  .form-actions {
    flex-direction: column-reverse;
  }

  .form-actions button {
    width: 100%;
  }
}

</style>
