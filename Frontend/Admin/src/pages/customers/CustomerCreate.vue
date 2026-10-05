<script setup>
import { ref } from "vue"
import { useRouter } from "vue-router"
import api from "../../api/axios"

const router = useRouter()

const form = ref({
  customer_code: "",
  first_name: "",
  last_name: "",
  email: "",
  phone: ""
})

const loading = ref(false)
const errorMessage = ref("")
const successMessage = ref("")

const submitCustomer = async () => {
  errorMessage.value = ""
  successMessage.value = ""

  if (
      !form.value.customer_code ||
      !form.value.first_name ||
      !form.value.last_name ||
      !form.value.phone
  ) {
    errorMessage.value =
        "Customer code, first name, last name and phone are required."

    return
  }

  try {
    loading.value = true

    const response = await api.post("/customers", {
      customer_code: form.value.customer_code.trim(),
      first_name: form.value.first_name.trim(),
      last_name: form.value.last_name.trim(),
      email: form.value.email.trim() || null,
      phone: form.value.phone.trim()
    })

    successMessage.value =
        response.data.message || "Customer created successfully."

    setTimeout(() => {
      router.push("/admin/customers/all-customers")
    }, 800)

  } catch (error) {
    console.error("Create customer error:", error)

    errorMessage.value =
        error.response?.data?.message ||
        "Failed to create customer."

  } finally {
    loading.value = false
  }
}

const cancel = () => {
  router.push("/admin/customers/all-customers")
}
</script>

<template>
  <div class="page-container">

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

    <!-- Customer Form -->
    <div class="dashboard-card form-card">

      <div class="card-header">
        <div>
          <h2>Customer Information</h2>

          <p>
            Enter the customer's basic account information.
          </p>
        </div>
      </div>

      <form @submit.prevent="submitCustomer">

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
              placeholder="e.g. CUS-00001"
              maxlength="50"
              required
          />

          <small>
            A unique code used to identify the customer.
          </small>
        </div>

        <!-- Name Row -->
        <div class="form-row">

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
                placeholder="Enter first name"
                maxlength="100"
                required
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
                placeholder="Enter last name"
                maxlength="100"
                required
            />
          </div>

        </div>

        <!-- Contact Row -->
        <div class="form-row">

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
                placeholder="Enter phone number"
                maxlength="30"
                required
            />
          </div>

        </div>

        <!-- Form Actions -->
        <div class="form-actions">

          <button
              type="button"
              class="secondary-button"
              :disabled="loading"
              @click="cancel"
          >
            Cancel
          </button>

          <button
              type="submit"
              class="primary-button"
              :disabled="loading"
          >
            {{ loading ? "Creating..." : "Create Customer" }}
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
   Card
   ========================= */

.dashboard-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  padding: var(--spacing-xl);
}

.form-card {
  max-width: 1900px;
}

.card-header {
  padding-bottom: var(--spacing-lg);
  border-bottom: 1px solid var(--color-border-light);
}

.card-header h2 {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.card-header p {
  margin-top: var(--spacing-xs);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

/* =========================
   Form
   ========================= */

.form-card form {
  margin-top: var(--spacing-2xl);
}

.form-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--spacing-xl);
}

.form-group {
  display: flex;
  flex-direction: column;
  margin-bottom: var(--spacing-xl);
}

.form-group label {
  margin-bottom: var(--spacing-sm);
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

.form-group small {
  margin-top: 6px;
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-md);
  margin-top: var(--spacing-sm);
  padding-top: var(--spacing-xl);
  border-top: 1px solid var(--color-border-light);
}

/* =========================
   Buttons
   ========================= */

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

  .form-row {
    grid-template-columns: 1fr;
    gap: 0;
  }

  .form-actions {
    flex-direction: column-reverse;
  }

  .form-actions button {
    width: 100%;
  }
}
</style>
