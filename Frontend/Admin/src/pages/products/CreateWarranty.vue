<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import api from '../../api/axios'

const router = useRouter()
const route = useRoute()

const LIST_ROUTE = '/admin/products/warranty'

const isEditMode = computed(() => Boolean(route.params.id))
const warrantyId = computed(() => route.params.id)

const loading = ref(false)
const pageLoading = ref(false)
const errorMessage = ref('')

const form = ref({
  name: '',
  code: '',
  duration_value: 12,
  duration_unit: 'Months',
  description: '',
  is_active: true
})

/*
|--------------------------------------------------------------------------
| Load Existing Warranty
|--------------------------------------------------------------------------
*/

const loadWarranty = async () => {
  try {
    pageLoading.value = true
    errorMessage.value = ''

    const response = await api.get(`/warranties/${warrantyId.value}`)

    const warranty = response.data.data

    if (!warranty) {
      errorMessage.value = 'Warranty not found.'
      return
    }

    form.value = {
      name: warranty.name || '',
      code: warranty.code || '',
      duration_value: warranty.duration_value ?? 0,
      duration_unit: warranty.duration_unit || 'Months',
      description: warranty.description || '',
      is_active: Boolean(warranty.is_active)
    }
  } catch (error) {
    console.error('Failed to load warranty:', error)

    errorMessage.value =
        error.response?.data?.message ||
        error.message ||
        'Failed to load warranty.'
  } finally {
    pageLoading.value = false
  }
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
    const name = form.value.name.trim()
    const code = form.value.code.trim().toUpperCase()
    const durationValue = Number(form.value.duration_value)

    if (!name) {
      errorMessage.value = 'Warranty name is required.'
      return
    }

    if (!code) {
      errorMessage.value = 'Warranty code is required.'
      return
    }

    if (
        form.value.duration_value === '' ||
        !Number.isInteger(durationValue) ||
        durationValue < 0
    ) {
      errorMessage.value = 'Duration must be a whole number of 0 or more.'
      return
    }

    const payload = {
      name,
      code,
      duration_value: durationValue,
      duration_unit: form.value.duration_unit,
      description: form.value.description.trim() || null,
      is_active: form.value.is_active
    }

    if (isEditMode.value) {
      await api.put(`/warranties/${warrantyId.value}`, payload)

      alert('Warranty updated successfully.')
    } else {
      await api.post('/warranties', payload)

      alert('Warranty created successfully.')
    }

    router.push(LIST_ROUTE)
  } catch (error) {
    console.error(
        isEditMode.value
            ? 'Failed to update warranty:'
            : 'Failed to create warranty:',
        error
    )

    errorMessage.value =
        error.response?.data?.message ||
        error.message ||
        (
            isEditMode.value
                ? 'Failed to update warranty.'
                : 'Failed to create warranty.'
        )
  } finally {
    loading.value = false
  }
}

/*
|--------------------------------------------------------------------------
| Navigation
|--------------------------------------------------------------------------
*/

const goBack = () => {
  router.push(LIST_ROUTE)
}

onMounted(() => {
  if (isEditMode.value) {
    loadWarranty()
  }
})
</script>

<template>
  <div class="warranty-form-page">

    <!-- Header -->
    <div class="form-header">
      <div>
        <h1>
          {{ isEditMode ? 'Edit Warranty' : 'Create Warranty' }}
        </h1>

        <p>
          {{
            isEditMode
                ? 'Update this warranty plan.'
                : 'Add a warranty plan that can be assigned to products.'
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

    <!-- Error -->
    <div
        v-if="errorMessage"
        class="error-message"
    >
      {{ errorMessage }}
    </div>

    <!-- Loading -->
    <div
        v-if="pageLoading"
        class="loading-message"
    >
      Loading warranty...
    </div>

    <!-- Form -->
    <form
        v-else
        class="warranty-form"
        @submit.prevent="submitForm"
    >

      <!-- Warranty Information -->
      <section class="form-section">

        <div class="section-header">
          <h2>Warranty Information</h2>

          <p>
            Define the name, code and description of the warranty.
          </p>
        </div>

        <div class="form-grid">

          <!-- Name -->
          <div class="form-group">

            <label for="name">
              Warranty Name
              <span>*</span>
            </label>

            <input
                id="name"
                v-model="form.name"
                type="text"
                placeholder="e.g. 1 Year Manufacturer Warranty"
                maxlength="100"
                required
                :disabled="loading"
            />

          </div>

          <!-- Code -->
          <div class="form-group">

            <label for="code">
              Warranty Code
              <span>*</span>
            </label>

            <input
                id="code"
                v-model="form.code"
                type="text"
                placeholder="e.g. WAR-1Y"
                maxlength="50"
                required
                :disabled="loading"
            />

            <small>
              A unique code used to identify this warranty.
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
              rows="4"
              placeholder="Describe what this warranty covers..."
              :disabled="loading"
          ></textarea>

        </div>

      </section>

      <!-- Duration -->
      <section class="form-section">

        <div class="section-header">
          <h2>Duration</h2>

          <p>
            Set how long the warranty lasts. Use 0 for no warranty.
          </p>
        </div>

        <div class="form-grid">

          <!-- Duration Value -->
          <div class="form-group">

            <label for="duration_value">
              Duration
              <span>*</span>
            </label>

            <input
                id="duration_value"
                v-model="form.duration_value"
                type="number"
                step="1"
                min="0"
                placeholder="e.g. 12"
                required
                :disabled="loading"
            />

          </div>

          <!-- Duration Unit -->
          <div class="form-group">

            <label for="duration_unit">
              Unit
              <span>*</span>
            </label>

            <select
                id="duration_unit"
                v-model="form.duration_unit"
                required
                :disabled="loading"
            >
              <option value="Days">
                Days
              </option>

              <option value="Months">
                Months
              </option>

              <option value="Years">
                Years
              </option>
            </select>

          </div>

        </div>

      </section>

      <!-- Settings -->
      <section class="form-section">

        <div class="section-header">
          <h2>Settings</h2>

          <p>
            Configure whether this warranty can be assigned to products.
          </p>
        </div>

        <div class="checkbox-group">

          <label>
            <input
                v-model="form.is_active"
                type="checkbox"
                :disabled="loading"
            />

            <span>Active</span>
          </label>

          <small>
            Inactive warranties will not be available when registering items.
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
                : (isEditMode ? 'Update Warranty' : 'Create Warranty')
          }}
        </button>

      </div>

    </form>

  </div>
</template>

<style scoped>
.warranty-form-page {
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

.warranty-form {
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
  min-height: 110px;
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

.form-group small,
.checkbox-group small {
  font-size: var(--font-size-xs);
  line-height: 1.5;
  color: var(--color-text-muted);
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
}
</style>
