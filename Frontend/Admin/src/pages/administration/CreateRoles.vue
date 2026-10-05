<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import api from '../../api/axios'

const router = useRouter()
const route = useRoute()

// List page of the roles section in your router
const LIST_ROUTE = '/admin/administration/roles'

const isEditMode = computed(() => Boolean(route.params.id))
const roleId = computed(() => route.params.id)

const loading = ref(false)
const pageLoading = ref(false)
const loadFailed = ref(false)
const errorMessage = ref('')

const form = ref({
  name: '',
  description: '',
  is_active: true
})

/*
|--------------------------------------------------------------------------
| Load Existing Role
|--------------------------------------------------------------------------
*/

const findRole = async () => {
  // Preferred: single role endpoint
  try {
    const response = await api.get(`/roles/${roleId.value}`)

    if (response.data.data) {
      return response.data.data
    }
  } catch (error) {
    // Fall back to the list if there is no single-role endpoint
    if (error.response?.status !== 404) {
      throw error
    }
  }

  const listResponse = await api.get('/roles')

  return (listResponse.data.data || []).find(
      role => Number(role.id) === Number(roleId.value)
  )
}

const loadRole = async () => {
  try {
    pageLoading.value = true
    loadFailed.value = false
    errorMessage.value = ''

    const role = await findRole()

    if (!role) {
      loadFailed.value = true
      errorMessage.value = 'Role not found.'
      return
    }

    form.value = {
      name: role.name || '',
      description: role.description || '',
      is_active: Boolean(role.is_active)
    }
  } catch (error) {
    console.error('Failed to load role:', error)

    loadFailed.value = true

    errorMessage.value =
        error.response?.data?.message ||
        error.message ||
        'Failed to load role.'
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

    if (!name) {
      errorMessage.value = 'Role name is required.'
      return
    }

    const payload = {
      name,
      description: form.value.description.trim() || null,
      is_active: isEditMode.value ? form.value.is_active : true
    }

    if (isEditMode.value) {
      await api.put(`/roles/${roleId.value}`, payload)

      alert('Role updated successfully.')
    } else {
      await api.post('/roles', payload)

      alert('Role created successfully.')
    }

    router.push(LIST_ROUTE)
  } catch (error) {
    console.error(
        isEditMode.value
            ? 'Failed to update role:'
            : 'Failed to create role:',
        error
    )

    errorMessage.value =
        error.response?.data?.message ||
        error.message ||
        (
            isEditMode.value
                ? 'Failed to update role.'
                : 'Failed to create role.'
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
    loadRole()
  }
})

watch(roleId, (id) => {
  if (id) loadRole()
})
</script>

<template>
  <div class="role-form-page">

    <!-- Header -->
    <div class="form-header">
      <div>
        <h1>
          {{ isEditMode ? 'Edit Role' : 'Create Role' }}
        </h1>

        <p>
          {{
            isEditMode
                ? 'Update role information.'
                : 'Create a new system role.'
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
      Loading role...
    </div>

    <!-- Form -->
    <form
        v-else-if="!loadFailed"
        class="role-form"
        @submit.prevent="submitForm"
    >

      <!-- Role Information -->
      <section class="form-section">

        <div class="section-header">
          <h2>Role Information</h2>

          <p>
            Define the name and responsibilities of this role.
          </p>
        </div>

        <div class="form-group">

          <label for="name">
            Role Name
            <span>*</span>
          </label>

          <input
              id="name"
              v-model="form.name"
              type="text"
              placeholder="e.g. Sales Manager"
              maxlength="100"
              required
              :disabled="loading"
          />

        </div>

        <div class="form-group full-width">

          <label for="description">
            Description
          </label>

          <textarea
              id="description"
              v-model="form.description"
              rows="4"
              placeholder="Describe what this role is responsible for..."
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
            Configure whether this role can be assigned to users.
          </p>
        </div>

        <div class="checkbox-group">

          <label>
            <input
                v-model="form.is_active"
                type="checkbox"
                :disabled="loading"
            />

            <span>Role is active</span>
          </label>

          <small>
            Inactive roles cannot be assigned to new users.
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
                : (isEditMode ? 'Update Role' : 'Create Role')
          }}
        </button>

      </div>

    </form>

  </div>
</template>

<style scoped>
.role-form-page {
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

.role-form {
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
  transition: border-color var(--transition-fast),
  box-shadow var(--transition-fast);
}

.form-group input {
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
.form-group textarea:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-light);
}

.form-group input:disabled,
.form-group textarea:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

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
