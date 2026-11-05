<script setup>
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '@/api/axios'

const router = useRouter()
const route = useRoute()

const LIST_ROUTE = '/admin/purchasing/suppliers'

const paymentTermsOptions = [
  'Cash',
  'COD',
  '7 Days',
  '15 Days',
  '30 Days',
  '60 Days',
  '90 Days'
]

// ==========================================
// Mode
// ==========================================

const isEditMode = computed(() => !!route.params.id)

const supplierId = computed(() => route.params.id || null)

// ==========================================
// State
// ==========================================

const saving = ref(false)
const pageLoading = ref(false)
const loadFailed = ref(false)
const errorMessage = ref('')
const errorBox = ref(null)

const form = reactive({
  supplier_code: '',
  company_name: '',
  contact_person: '',
  email: '',
  phone: '',
  address_line_1: '',
  address_line_2: '',
  city: '',
  state: '',
  postal_code: '',
  country: 'Sri Lanka',
  tax_number: '',
  payment_terms: '',
  notes: ''
})

const showError = async (message) => {
  errorMessage.value = message

  await nextTick()

  errorBox.value?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

// ==========================================
// Load (edit mode)
// ==========================================

const loadSupplier = async () => {
  try {
    pageLoading.value = true

    const response = await api.get(`/suppliers/${supplierId.value}`)

    const supplier = response.data.data

    if (!supplier) {
      throw new Error('Supplier not found.')
    }

    Object.assign(form, {
      supplier_code: supplier.supplier_code ?? '',
      company_name: supplier.company_name ?? '',
      contact_person: supplier.contact_person ?? '',
      email: supplier.email ?? '',
      phone: supplier.phone ?? '',
      address_line_1: supplier.address_line_1 ?? '',
      address_line_2: supplier.address_line_2 ?? '',
      city: supplier.city ?? '',
      state: supplier.state ?? '',
      postal_code: supplier.postal_code ?? '',
      country: supplier.country ?? 'Sri Lanka',
      tax_number: supplier.tax_number ?? '',
      payment_terms: supplier.payment_terms ?? '',
      notes: supplier.notes ?? ''
    })
  } catch (error) {
    console.error('Failed to load supplier:', error)

    loadFailed.value = true

    errorMessage.value =
        error.response?.data?.message ||
        error.message ||
        'Failed to load supplier.'
  } finally {
    pageLoading.value = false
  }
}

onMounted(() => {
  if (isEditMode.value) {
    loadSupplier()
  }
})

// ==========================================
// Submit
// ==========================================

const submitForm = async () => {
  errorMessage.value = ''

  if (!form.supplier_code.trim()) {
    await showError('Supplier code is required.')
    return
  }

  if (!form.company_name.trim()) {
    await showError('Company name is required.')
    return
  }

  saving.value = true

  try {
    const payload = {
      supplier_code: form.supplier_code.trim(),
      company_name: form.company_name.trim(),
      contact_person: form.contact_person.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      address_line_1: form.address_line_1.trim() || null,
      address_line_2: form.address_line_2.trim() || null,
      city: form.city.trim() || null,
      state: form.state.trim() || null,
      postal_code: form.postal_code.trim() || null,
      country: form.country.trim() || 'Sri Lanka',
      tax_number: form.tax_number.trim() || null,
      payment_terms: form.payment_terms || null,
      notes: form.notes.trim() || null
    }

    if (isEditMode.value) {
      await api.put(`/suppliers/${supplierId.value}`, payload)

      alert('Supplier updated successfully.')
    } else {
      await api.post('/suppliers', payload)

      alert('Supplier created successfully.')
    }

    router.push(LIST_ROUTE)
  } catch (error) {
    console.error(
        isEditMode.value
            ? 'Failed to update supplier:'
            : 'Failed to create supplier:',
        error
    )

    await showError(
        error.response?.data?.message ||
        (isEditMode.value
            ? 'Failed to update supplier.'
            : 'Failed to create supplier.')
    )
  } finally {
    saving.value = false
  }
}

const goBack = () => {
  router.push(LIST_ROUTE)
}
</script>

<template>
  <div class="supplier-form-page">

    <!-- Header -->
    <div class="form-header">
      <div>
        <h1>{{ isEditMode ? 'Edit Supplier' : 'Create Supplier' }}</h1>

        <p>
          {{
            isEditMode
                ? 'Update the supplier information.'
                : 'Add a new supplier to the system.'
          }}
        </p>
      </div>

      <button
          type="button"
          class="btn-secondary"
          @click="goBack"
      >
        Cancel
      </button>
    </div>

    <!-- Error -->
    <div
        v-if="errorMessage"
        ref="errorBox"
        class="error-message"
    >
      {{ errorMessage }}
    </div>

    <!-- Loading -->
    <div
        v-if="pageLoading"
        class="loading-state"
    >
      Loading supplier...
    </div>

    <!-- Form -->
    <form
        v-else-if="!loadFailed"
        class="supplier-form"
        @submit.prevent="submitForm"
    >

      <!-- Basic Information -->
      <section class="form-section">

        <div class="section-header">
          <h2>Basic Information</h2>
          <p>Enter the supplier code, company name and contact details.</p>
        </div>

        <div class="form-grid">

          <div class="form-group">
            <label for="supplier_code">
              Supplier Code
              <span>*</span>
            </label>

            <input
                id="supplier_code"
                v-model="form.supplier_code"
                type="text"
                placeholder="e.g. SUP-001"
                :disabled="saving"
                required
            />
          </div>

          <div class="form-group">
            <label for="company_name">
              Company Name
              <span>*</span>
            </label>

            <input
                id="company_name"
                v-model="form.company_name"
                type="text"
                placeholder="Company name"
                :disabled="saving"
                required
            />
          </div>

          <div class="form-group">
            <label for="contact_person">
              Contact Person
            </label>

            <input
                id="contact_person"
                v-model="form.contact_person"
                type="text"
                placeholder="Contact person"
                :disabled="saving"
            />
          </div>

          <div class="form-group">
            <label for="email">
              Email
            </label>

            <input
                id="email"
                v-model="form.email"
                type="email"
                placeholder="supplier@example.com"
                :disabled="saving"
            />
          </div>

          <div class="form-group">
            <label for="phone">
              Phone
            </label>

            <input
                id="phone"
                v-model="form.phone"
                type="text"
                placeholder="Phone number"
                :disabled="saving"
            />
          </div>

        </div>

      </section>

      <!-- Address -->
      <section class="form-section">

        <div class="section-header">
          <h2>Address</h2>
          <p>Where the supplier is located.</p>
        </div>

        <div class="form-grid">

          <div class="form-group full-span">
            <label for="address_line_1">
              Address Line 1
            </label>

            <input
                id="address_line_1"
                v-model="form.address_line_1"
                type="text"
                placeholder="Address"
                :disabled="saving"
            />
          </div>

          <div class="form-group full-span">
            <label for="address_line_2">
              Address Line 2
            </label>

            <input
                id="address_line_2"
                v-model="form.address_line_2"
                type="text"
                placeholder="Apartment, building, etc."
                :disabled="saving"
            />
          </div>

          <div class="form-group">
            <label for="city">
              City
            </label>

            <input
                id="city"
                v-model="form.city"
                type="text"
                placeholder="City"
                :disabled="saving"
            />
          </div>

          <div class="form-group">
            <label for="state">
              State / Province
            </label>

            <input
                id="state"
                v-model="form.state"
                type="text"
                placeholder="State"
                :disabled="saving"
            />
          </div>

          <div class="form-group">
            <label for="postal_code">
              Postal Code
            </label>

            <input
                id="postal_code"
                v-model="form.postal_code"
                type="text"
                placeholder="Postal code"
                :disabled="saving"
            />
          </div>

          <div class="form-group">
            <label for="country">
              Country
            </label>

            <input
                id="country"
                v-model="form.country"
                type="text"
                placeholder="Country"
                :disabled="saving"
            />
          </div>

        </div>

      </section>

      <!-- Commercial Information -->
      <section class="form-section">

        <div class="section-header">
          <h2>Commercial Information</h2>
          <p>Tax and payment details used on purchase orders.</p>
        </div>

        <div class="form-grid">

          <div class="form-group">
            <label for="tax_number">
              Tax Number
            </label>

            <input
                id="tax_number"
                v-model="form.tax_number"
                type="text"
                placeholder="Tax number"
                :disabled="saving"
            />
          </div>

          <div class="form-group">
            <label for="payment_terms">
              Payment Terms
            </label>

            <select
                id="payment_terms"
                v-model="form.payment_terms"
                :disabled="saving"
            >
              <option value="">Select payment terms</option>

              <option
                  v-for="term in paymentTermsOptions"
                  :key="term"
                  :value="term"
              >
                {{ term }}
              </option>

              <!-- Keeps an older value selectable when editing -->
              <option
                  v-if="form.payment_terms && !paymentTermsOptions.includes(form.payment_terms)"
                  :value="form.payment_terms"
              >
                {{ form.payment_terms }}
              </option>
            </select>
          </div>

          <div class="form-group full-span">
            <label for="notes">
              Notes
            </label>

            <textarea
                id="notes"
                v-model="form.notes"
                rows="4"
                placeholder="Additional notes..."
                :disabled="saving"
            ></textarea>
          </div>

        </div>

      </section>

      <!-- Actions -->
      <div class="form-actions">

        <button
            type="button"
            class="btn-secondary"
            :disabled="saving"
            @click="goBack"
        >
          Cancel
        </button>

        <button
            type="submit"
            class="btn-primary"
            :disabled="saving"
        >
          {{
            saving
                ? (isEditMode ? 'Updating...' : 'Saving...')
                : (isEditMode ? 'Update Supplier' : 'Create Supplier')
          }}
        </button>

      </div>

    </form>

  </div>
</template>

<style scoped>
.supplier-form-page {
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

.supplier-form {
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

.full-span {
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

.form-group input:disabled,
.form-group select:disabled,
.form-group textarea:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* =========================
   States
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

.loading-state {
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

  .form-grid {
    grid-template-columns: 1fr;
  }

  .full-span {
    grid-column: auto;
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
