<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import api from '../../api/axios'

const router = useRouter()
const route = useRoute()

const loading = ref(false)
const errorMessage = ref('')

const isEditMode = ref(false)
const specificationId = ref(null)

const form = ref({
  name: '',
  code: '',
  data_type: 'text',
  unit: '',
  description: '',
  is_required: false,
  is_active: true
})

/*
|--------------------------------------------------------------------------
| Load Existing Specification
|--------------------------------------------------------------------------
*/

const loadSpecification = async () => {
  try {
    loading.value = true
    errorMessage.value = ''

    const response = await api.get(
        `/item-specifications/${specificationId.value}`
    )

    const specification = response.data.data

    if (!specification) {
      errorMessage.value = 'Specification not found.'
      return
    }

    form.value = {
      name: specification.name || '',
      code: specification.code || '',
      data_type: specification.data_type || 'text',
      unit: specification.unit || '',
      description: specification.description || '',
      is_required: Boolean(specification.is_required),
      is_active: Boolean(specification.is_active)
    }
  } catch (error) {
    console.error('Failed to load specification:', error)

    errorMessage.value =
        error.response?.data?.message ||
        error.message ||
        'Failed to load specification.'
  } finally {
    loading.value = false
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
    if (!form.value.name.trim()) {
      errorMessage.value = 'Specification name is required.'
      return
    }

    if (!form.value.code.trim()) {
      errorMessage.value = 'Specification code is required.'
      return
    }

    if (!form.value.data_type) {
      errorMessage.value = 'Data type is required.'
      return
    }

    const payload = {
      name: form.value.name.trim(),
      code: form.value.code.trim().toUpperCase(),
      data_type: form.value.data_type,
      unit: form.value.unit.trim() || null,
      description: form.value.description.trim() || null,
      is_required: form.value.is_required,
      is_active: form.value.is_active
    }

    if (isEditMode.value) {
      await api.put(
          `/item-specifications/${specificationId.value}`,
          payload
      )

      alert('Specification updated successfully.')
    } else {
      await api.post(
          '/item-specifications',
          payload
      )

      alert('Specification created successfully.')
    }

    router.push('/admin/products/item-specifications')
  } catch (error) {
    console.error(
        isEditMode.value
            ? 'Failed to update specification:'
            : 'Failed to create specification:',
        error
    )

    errorMessage.value =
        error.response?.data?.message ||
        error.message ||
        (
            isEditMode.value
                ? 'Failed to update specification.'
                : 'Failed to create specification.'
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
  router.push('/admin/products/item-specifications')
}

/*
|--------------------------------------------------------------------------
| Page Initialization
|--------------------------------------------------------------------------
*/

onMounted(async () => {
  if (route.params.id) {
    isEditMode.value = true
    specificationId.value = route.params.id

    await loadSpecification()
  }
})
</script>

<template>
  <div class="specification-form-page">

    <!-- Header -->
    <div class="form-header">
      <div>

        <h1>
          {{ isEditMode ? 'Edit Specification' : 'Create Specification' }}
        </h1>

        <p>
          {{
            isEditMode
                ? 'Update the details of this item specification.'
                : 'Add a new specification that can be assigned to item types.'
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

    <!-- Form -->
    <form
        class="specification-form"
        @submit.prevent="submitForm"
    >

      <!-- Specification Information -->
      <section class="form-section">

        <div class="section-header">
          <h2>Specification Information</h2>

          <p>
            Define the name, code, data type and unit of the specification.
          </p>
        </div>

        <div class="form-grid">

          <!-- Name -->
          <div class="form-group">

            <label for="name">
              Specification Name
              <span>*</span>
            </label>

            <input
                id="name"
                v-model="form.name"
                type="text"
                placeholder="e.g. RAM Capacity"
                maxlength="100"
                :disabled="loading"
                required
            />

          </div>

          <!-- Code -->
          <div class="form-group">

            <label for="code">
              Specification Code
              <span>*</span>
            </label>

            <input
                id="code"
                v-model="form.code"
                type="text"
                placeholder="e.g. RAM"
                maxlength="50"
                :disabled="loading"
                required
            />

            <small>
              A unique code used to identify this specification.
            </small>

          </div>

          <!-- Data Type -->
          <div class="form-group">

            <label for="data_type">
              Data Type
              <span>*</span>
            </label>

            <select
                id="data_type"
                v-model="form.data_type"
                :disabled="loading"
                required
            >
              <option value="text">
                Text
              </option>

              <option value="number">
                Number
              </option>

              <option value="decimal">
                Decimal
              </option>

              <option value="boolean">
                Boolean
              </option>

              <option value="date">
                Date
              </option>

              <option value="select">
                Select
              </option>
            </select>

          </div>

          <!-- Unit -->
          <div class="form-group">

            <label for="unit">
              Unit
            </label>

            <input
                id="unit"
                v-model="form.unit"
                type="text"
                placeholder="e.g. GB"
                maxlength="20"
                :disabled="loading"
            />

            <small>
              Optional. Shown next to the value when entering item details.
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
              rows="5"
              maxlength="255"
              placeholder="Describe this specification..."
              :disabled="loading"
          ></textarea>

        </div>

      </section>

      <!-- Settings -->
      <section class="form-section">

        <div class="section-header">
          <h2>Settings</h2>

          <p>
            Configure how this specification behaves when used with items.
          </p>
        </div>

        <div class="settings-list">

          <!-- Required -->
          <div class="checkbox-group">

            <label>
              <input
                  v-model="form.is_required"
                  type="checkbox"
                  :disabled="loading"
              />

              <span>Required</span>
            </label>

            <small>
              A value must be entered for this specification when
              registering items.
            </small>

          </div>

          <!-- Active -->
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
              Inactive specifications will not be available when
              assigning to item types.
            </small>

          </div>

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
                : (
                    isEditMode
                        ? 'Update Specification'
                        : 'Create Specification'
                )
          }}
        </button>

      </div>

    </form>

  </div>
</template>

<style scoped>
.specification-form-page {
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

.specification-form {
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

.form-group small,
.checkbox-group small {
  font-size: var(--font-size-xs);
  line-height: 1.5;
  color: var(--color-text-muted);
}

/* =========================
   Checkbox
   ========================= */

.settings-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xl);
}

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
   Error
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
