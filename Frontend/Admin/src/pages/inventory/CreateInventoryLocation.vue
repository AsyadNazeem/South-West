<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import api from '@/api/axios'
import {
  hasPermission as authorization,
  ensureAuthorization
} from '@/auth/authorization.js'

const router = useRouter()
const route = useRoute()

// List page of the inventory locations section in your router
const LIST_ROUTE = '/admin/inventory/locations'

const isEditMode = computed(() => Boolean(route.params.id))
const locationId = computed(() => route.params.id)

const loading = ref(false)
const pageLoading = ref(false)
const loadFailed = ref(false)
const forbidden = ref(false)
const errorMessage = ref('')

const locationTypes = [
  { value: 'store', label: 'Store' },
  { value: 'warehouse', label: 'Warehouse' },
  { value: 'online', label: 'Online' },
  { value: 'service', label: 'Service' }
]

const form = ref({
  code: '',
  name: '',
  location_type: 'store',
  address: '',
  is_active: true
})

/*
|--------------------------------------------------------------------------
| Load Existing Location
|--------------------------------------------------------------------------
*/

const loadLocation = async () => {
  try {
    pageLoading.value = true
    loadFailed.value = false
    errorMessage.value = ''

    const response = await api.get(`/inventory-locations/${locationId.value}`)

    const location = response.data.data

    if (!location) {
      loadFailed.value = true
      errorMessage.value = 'Inventory location not found.'
      return
    }

    form.value = {
      code: location.code || '',
      name: location.name || '',
      location_type: location.location_type || 'store',
      address: location.address || '',
      is_active: Boolean(location.is_active)
    }
  } catch (error) {
    console.error('Failed to load inventory location:', error)

    loadFailed.value = true

    errorMessage.value =
        error.response?.data?.message ||
        error.message ||
        'Failed to load inventory location.'
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
    const code = form.value.code.trim().toUpperCase()
    const name = form.value.name.trim()

    if (!name) {
      errorMessage.value = 'Location name is required.'
      return
    }

    if (isEditMode.value && !code) {
      errorMessage.value = 'Location code is required.'
      return
    }

    const payload = {
      name,
      location_type: form.value.location_type,
      address: form.value.address.trim() || null
    }

    if (isEditMode.value) {
      payload.code = code
      payload.is_active = form.value.is_active

      await api.put(
        `/inventory-locations/${locationId.value}`,
        payload
      )

      alert('Inventory location updated successfully.')
    } else {
      // The backend generates the location code.
      await api.post('/inventory-locations', payload)

      alert('Inventory location created successfully.')
    }

    router.push(LIST_ROUTE)
  } catch (error) {
    console.error(
      isEditMode.value
        ? 'Failed to update inventory location:'
        : 'Failed to create inventory location:',
      error
    )

    errorMessage.value =
      error.response?.data?.message ||
      error.message ||
      (
        isEditMode.value
          ? 'Failed to update inventory location.'
          : 'Failed to create inventory location.'
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

onMounted(async () => {
  // Wait for the user's permissions before checking them
  try {
    await ensureAuthorization()
  } catch (error) {
    console.error('Failed to load authorization:', error)
  }

  const required = isEditMode.value
      ? 'inventory.update'
      : 'inventory.create'

  if (!authorization(required)) {
    forbidden.value = true
    errorMessage.value =
        'You do not have permission to ' +
        (isEditMode.value ? 'edit' : 'create') +
        ' inventory locations.'
    return
  }

  if (isEditMode.value) {
    loadLocation()
  }
})

watch(locationId, (id) => {
  if (id && !forbidden.value) loadLocation()
})
</script>

<template>
  <div class="location-form-page">

    <!-- Header -->
    <div class="form-header">
      <div>
        <h1>
          {{ isEditMode ? 'Edit Location' : 'Add Location' }}
        </h1>

        <p>
          {{
            isEditMode
                ? 'Update this inventory location.'
                : 'Add a warehouse, store or other inventory location.'
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
      Loading inventory location...
    </div>

    <!-- Form -->
    <form
        v-else-if="!forbidden && !loadFailed"
        class="location-form"
        @submit.prevent="submitForm"
    >

      <!-- Location Information -->
      <section class="form-section">

        <div class="section-header">
          <h2>Location Information</h2>

          <p>
            Define the code, name and type of the location.
          </p>
        </div>

        <div class="form-grid">

          <!-- Code -->
          <div class="form-group">

            <label for="code">
              Location Code
              <span>*</span>
            </label>

          
<input
  id="code"
  v-model="form.code"
  type="text"
  :placeholder="isEditMode ? 'Location code' : 'Generated automatically'"
  maxlength="50"
  :required="isEditMode"
  :disabled="loading || !isEditMode"
/>

<small>
  {{
    isEditMode
      ? 'The existing location code is preserved when editing.'
      : 'A unique location code will be generated automatically.'
  }}
</small>


          </div>

          <!-- Name -->
          <div class="form-group">

            <label for="name">
              Location Name
              <span>*</span>
            </label>

            <input
                id="name"
                v-model="form.name"
                type="text"
                placeholder="e.g. Main Warehouse"
                maxlength="150"
                required
                :disabled="loading"
            />

          </div>

          <!-- Type -->
          <div class="form-group">

            <label for="location_type">
              Location Type
              <span>*</span>
            </label>

            <select
                id="location_type"
                v-model="form.location_type"
                required
                :disabled="loading"
            >
              <option
                  v-for="type in locationTypes"
                  :key="type.value"
                  :value="type.value"
              >
                {{ type.label }}
              </option>
            </select>

          </div>

        </div>

        <!-- Address -->
        <div class="form-group full-width">

          <label for="address">
            Address
          </label>

          <textarea
              id="address"
              v-model="form.address"
              rows="4"
              placeholder="Enter the physical address of this location..."
              :disabled="loading"
          ></textarea>

        </div>

      </section>

      <!-- Settings (edit only) -->
      <section
          v-if="isEditMode"
          class="form-section"
      >

        <div class="section-header">
          <h2>Settings</h2>

          <p>
            Configure whether this location can be used for stock.
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
            Inactive locations will not be available for stock operations.
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
                : (isEditMode ? 'Update Location' : 'Create Location')
          }}
        </button>

      </div>

    </form>

  </div>
</template>

<style scoped>
.location-form-page {
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

.location-form {
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
