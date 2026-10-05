<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import api from '../../api/axios'

const router = useRouter()
const route = useRoute()

const loading = ref(false)
const loadingUnit = ref(false)
const errorMessage = ref('')

const form = ref({
  name: '',
  code: '',
  description: '',
  is_active: true
})

const isEditMode = computed(() => !!route.params.id)

const pageTitle = computed(() =>
    isEditMode.value ? 'Edit Unit' : 'Create Unit'
)

const pageDescription = computed(() =>
    isEditMode.value
        ? 'Update the unit of measure details.'
        : 'Add a new unit of measure that can be assigned to products.'
)

const submitButtonText = computed(() =>
    isEditMode.value ? 'Update Unit' : 'Create Unit'
)

const loadUnit = async () => {
  if (!isEditMode.value) return

  loadingUnit.value = true
  errorMessage.value = ''

  try {
    const response = await api.get(`/units/${route.params.id}`)

    const unit = response.data.data || response.data

    form.value = {
      name: unit.name || '',
      code: unit.code || '',
      description: unit.description || '',
      is_active: unit.is_active ?? true
    }
  } catch (error) {
    console.error('Failed to load unit:', error)

    errorMessage.value =
        error.response?.data?.message ||
        error.message ||
        'Failed to load unit.'
  } finally {
    loadingUnit.value = false
  }
}

const submitForm = async () => {
  errorMessage.value = ''

  if (!form.value.name.trim()) {
    errorMessage.value = 'Unit name is required.'
    return
  }

  if (!form.value.code.trim()) {
    errorMessage.value = 'Unit code is required.'
    return
  }

  loading.value = true

  try {
    const payload = {
      name: form.value.name.trim(),
      code: form.value.code.trim().toUpperCase(),
      description: form.value.description.trim() || null,
      is_active: form.value.is_active
    }

    if (isEditMode.value) {
      await api.put(`/units/${route.params.id}`, payload)

      alert('Unit updated successfully.')
    } else {
      await api.post('/units', payload)

      alert('Unit created successfully.')
    }

    router.push('/units')
  } catch (error) {
    console.error(
        isEditMode.value
            ? 'Failed to update unit:'
            : 'Failed to create unit:',
        error
    )

    errorMessage.value =
        error.response?.data?.message ||
        error.message ||
        (isEditMode.value
            ? 'Failed to update unit.'
            : 'Failed to create unit.')
  } finally {
    loading.value = false
  }
}

const goBack = () => {
  router.push('/admin/products/units')
}

onMounted(() => {
  loadUnit()
})
</script>

<template>
  <div class="unit-form-page">

    <!-- Header -->
    <div class="form-header">
      <div>
        <h1>{{ pageTitle }}</h1>

        <p>
          {{ pageDescription }}
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

    <!-- Loading -->
    <div
        v-if="loadingUnit"
        class="loading-message"
    >
      Loading unit...
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
        v-if="!loadingUnit"
        class="unit-form"
        @submit.prevent="submitForm"
    >

      <!-- Unit Information -->
      <section class="form-section">

        <div class="section-header">
          <h2>Unit Information</h2>

          <p>
            Define the name, code and description of the unit.
          </p>
        </div>

        <div class="form-grid">

          <!-- Name -->
          <div class="form-group">

            <label for="name">
              Unit Name
              <span>*</span>
            </label>

            <input
                id="name"
                v-model="form.name"
                type="text"
                placeholder="e.g. Piece"
                maxlength="50"
                required
            />

          </div>

          <!-- Code -->
          <div class="form-group">

            <label for="code">
              Unit Code
              <span>*</span>
            </label>

            <input
                id="code"
                v-model="form.code"
                type="text"
                placeholder="e.g. PCS"
                maxlength="20"
                required
            />

            <small>
              A unique code used to identify this unit.
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
              placeholder="Describe this unit..."
          ></textarea>

        </div>

      </section>

      <!-- Settings -->
      <section class="form-section">

        <div class="section-header">

          <h2>Settings</h2>

          <p>
            Configure whether this unit can be used in the system.
          </p>

        </div>

        <div class="checkbox-group">

          <label>

            <input
                v-model="form.is_active"
                type="checkbox"
            />

            <span>Active</span>

          </label>

          <small>
            Inactive units will not be available when registering
            new items.
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
          {{ loading ? 'Saving...' : submitButtonText }}
        </button>

      </div>

    </form>

  </div>
</template>

<style scoped>

.unit-form-page {
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
   Loading
   ========================= */

.loading-message {
  padding: var(--spacing-lg);
  margin-bottom: var(--spacing-lg);
  text-align: center;
  color: var(--color-text-secondary);
}

/* =========================
   Form / Sections
   ========================= */

.unit-form {
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
  transition:
      border-color var(--transition-fast),
      box-shadow var(--transition-fast);
}

.form-group input {
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
.form-group textarea:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-light);
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
  transition:
      background var(--transition-fast),
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
