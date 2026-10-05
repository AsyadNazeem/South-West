<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import api from '../../api/axios'

const router = useRouter()
const route = useRoute()

// ==========================================
// Mode
// ==========================================

const isEditMode = computed(() => !!route.params.id)

const userId = computed(() => route.params.id || null)

// ==========================================
// State
// ==========================================

const loading = ref(false)
const pageLoading = ref(true)
const rolesLoading = ref(true)
const errorMessage = ref('')

const roles = ref([])
const selectedRoleIds = ref([])

const showPasswords = ref(false)

// Set once the user exists (create mode), so a retry never creates a duplicate
const createdUserId = ref(null)

const form = ref({
  email: '',
  password: '',
  confirm_password: ''
})

// ==========================================
// Computed
// ==========================================

const accountLocked = computed(() => !!createdUserId.value)

const passwordMismatch = computed(
    () =>
        form.value.confirm_password !== '' &&
        form.value.password !== form.value.confirm_password
)

// ==========================================
// Roles
// ==========================================

const isRoleSelected = (roleId) =>
    selectedRoleIds.value.includes(Number(roleId))

const toggleRole = (roleId) => {
  const id = Number(roleId)

  selectedRoleIds.value = isRoleSelected(id)
      ? selectedRoleIds.value.filter(item => item !== id)
      : [...selectedRoleIds.value, id]
}

// Current role assignments for a user: [{ id, user_id, role_id }]
const fetchRoleLinks = async (id) => {
  const response = await api.get('/user-roles', {
    params: { user_id: id }
  })

  return (response.data.data || []).filter(
      link => String(link.user_id ?? link.user?.id) === String(id)
  )
}

// Makes the user's assigned roles match the selection
const syncRoles = async (id) => {
  const links = await fetchRoleLinks(id)

  const existing = new Map(
      links.map(link => [Number(link.role_id), link.id])
  )

  const selected = new Set(selectedRoleIds.value.map(Number))

  // Add first, so the user is never left without a role
  for (const roleId of selected) {
    if (!existing.has(roleId)) {
      await api.post('/user-roles', {
        user_id: Number(id),
        role_id: roleId
      })
    }
  }

  for (const [roleId, linkId] of existing) {
    if (!selected.has(roleId)) {
      await api.delete(`/user-roles/${linkId}`)
    }
  }
}

// ==========================================
// Load
// ==========================================

const loadRoles = async () => {
  try {
    rolesLoading.value = true

    const response = await api.get('/roles')

    roles.value = response.data.data || []
  } catch (error) {
    console.error('Failed to load roles:', error)

    errorMessage.value =
        error.response?.data?.message ||
        error.message ||
        'Failed to load roles.'
  } finally {
    rolesLoading.value = false
  }
}

const loadUser = async () => {
  try {
    const [userResponse, links] = await Promise.all([
      api.get(`/users/${userId.value}`),
      fetchRoleLinks(userId.value)
    ])

    const user = userResponse.data.data

    if (!user) {
      throw new Error('User not found.')
    }

    form.value.email = user.email ?? ''

    selectedRoleIds.value = links.map(link => Number(link.role_id))
  } catch (error) {
    console.error('Failed to load user:', error)

    errorMessage.value =
        error.response?.data?.message ||
        error.message ||
        'Failed to load user.'
  }
}

onMounted(async () => {
  try {
    await Promise.all([
      loadRoles(),
      isEditMode.value ? loadUser() : Promise.resolve()
    ])
  } finally {
    pageLoading.value = false
  }
})

// ==========================================
// Submit
// ==========================================

const submitForm = async () => {
  loading.value = true
  errorMessage.value = ''

  try {
    // Validation
    if (!form.value.email.trim()) {
      errorMessage.value = 'Email is required.'
      return
    }

    const passwordRequired = !isEditMode.value
    const passwordEntered =
        form.value.password !== '' || form.value.confirm_password !== ''

    if (passwordRequired && !form.value.password) {
      errorMessage.value = 'Password is required.'
      return
    }

    if (passwordEntered && form.value.password !== form.value.confirm_password) {
      errorMessage.value = 'Password and confirm password do not match.'
      return
    }

    if (!selectedRoleIds.value.length) {
      errorMessage.value = 'Select at least one role.'
      return
    }

    let targetUserId = isEditMode.value ? userId.value : createdUserId.value

    // Step 1: create or update the account
    if (isEditMode.value) {
      const payload = { email: form.value.email.trim() }

      if (form.value.password) {
        payload.password = form.value.password
      }

      await api.put(`/users/${targetUserId}`, payload)
    } else if (!targetUserId) {
      const response = await api.post('/users', {
        email: form.value.email.trim(),
        password: form.value.password,
        role_id: Number(selectedRoleIds.value[0])
      })

      const data = response.data

      const created = data?.data || data?.user || data

      if (!created?.id) {
        throw new Error('User was created, but the API did not return its ID.')
      }

      createdUserId.value = created.id
      targetUserId = created.id
    }

    // Step 2: make the assigned roles match the selection
    await syncRoles(targetUserId)

    alert(
        isEditMode.value
            ? 'User updated successfully.'
            : 'User created successfully.'
    )

    router.push('/admin/administration/users')
  } catch (error) {
    console.error(
        isEditMode.value
            ? 'Failed to update user:'
            : 'Failed to create user:',
        error
    )

    const reason =
        error.response?.data?.message ||
        error.message ||
        (isEditMode.value
            ? 'Failed to update user.'
            : 'Failed to create user.')

    errorMessage.value = createdUserId.value
        ? `The user was created, but the roles could not be saved: ${reason} Submit again to retry.`
        : reason
  } finally {
    loading.value = false
  }
}

const goBack = () => {
  router.push('/admin/administration/users')
}
</script>

<template>
  <div class="user-form-page">

    <!-- Header -->
    <div class="form-header">
      <div>
        <h1>
          {{ isEditMode ? 'Edit User' : 'Create User' }}
        </h1>

        <p>
          {{
            isEditMode
                ? 'Update the user account and the roles assigned to it.'
                : 'Create a new administrator or staff user and assign roles.'
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
        class="error-message"
    >
      {{ errorMessage }}
    </div>

    <!-- Loading -->
    <div
        v-if="pageLoading"
        class="loading-state"
    >
      Loading...
    </div>

    <!-- Form -->
    <form
        v-else
        class="user-form"
        @submit.prevent="submitForm"
    >

      <!-- Account Information -->
      <section class="form-section">

        <div class="section-header">
          <h2>Account Information</h2>
          <p>Enter the login email and password for this user.</p>
        </div>

        <div class="form-grid">

          <!-- Email -->
          <div class="form-group full-span">
            <label for="email">
              Email
              <span>*</span>
            </label>

            <input
                id="email"
                v-model="form.email"
                type="email"
                placeholder="user@southwest.lk"
                autocomplete="email"
                :disabled="accountLocked"
                required
            />
          </div>

          <!-- Password -->
          <div class="form-group">
            <label for="password">
              Password
              <span v-if="!isEditMode">*</span>
            </label>

            <input
                id="password"
                v-model="form.password"
                :type="showPasswords ? 'text' : 'password'"
                :placeholder="
                  isEditMode
                      ? 'Enter a new password'
                      : 'Enter password'
                "
                autocomplete="new-password"
                :disabled="accountLocked"
                :required="!isEditMode"
            />

            <small v-if="isEditMode">
              Leave blank to keep the current password.
            </small>
          </div>

          <!-- Confirm Password -->
          <div class="form-group">
            <label for="confirm_password">
              Confirm Password
              <span v-if="!isEditMode">*</span>
            </label>

            <input
                id="confirm_password"
                v-model="form.confirm_password"
                :type="showPasswords ? 'text' : 'password'"
                placeholder="Re-enter password"
                autocomplete="new-password"
                :class="{ 'input-invalid': passwordMismatch }"
                :disabled="accountLocked"
                :required="!isEditMode || form.password !== ''"
            />

            <small
                v-if="passwordMismatch"
                class="field-error"
            >
              Passwords do not match.
            </small>
          </div>

        </div>

        <label class="show-passwords">
          <input
              v-model="showPasswords"
              type="checkbox"
          />

          <span>Show passwords</span>
        </label>

      </section>

      <!-- Roles -->
      <section class="form-section">

        <div class="section-header">
          <h2>Roles</h2>
          <p>
            Choose one or more roles. The user gets the permissions of
            every selected role.
          </p>
        </div>

        <div
            v-if="rolesLoading"
            class="muted-state"
        >
          Loading roles...
        </div>

        <div
            v-else-if="!roles.length"
            class="muted-state"
        >
          No roles available.
        </div>

        <template v-else>

          <div class="role-grid">
            <label
                v-for="role in roles"
                :key="role.id"
                class="role-card"
                :class="{ selected: isRoleSelected(role.id) }"
            >
              <input
                  type="checkbox"
                  :checked="isRoleSelected(role.id)"
                  :disabled="loading"
                  @change="toggleRole(role.id)"
              />

              <span class="role-text">
                <strong>{{ role.name }}</strong>

                <small v-if="role.description">
                  {{ role.description }}
                </small>
              </span>
            </label>
          </div>

          <p class="role-summary">
            {{ selectedRoleIds.length }}
            {{ selectedRoleIds.length === 1 ? 'role' : 'roles' }} selected
          </p>

        </template>

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
                ? (isEditMode ? 'Updating...' : 'Saving...')
                : (isEditMode ? 'Update User' : 'Create User')
          }}
        </button>

      </div>

    </form>

  </div>
</template>

<style scoped>
.user-form-page {
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

.user-form {
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

.form-group input {
  width: 100%;
  box-sizing: border-box;
  height: 40px;
  padding: 0 var(--spacing-lg);
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

.form-group input::placeholder {
  color: var(--color-text-muted);
}

.form-group input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-light);
}

.form-group input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.form-group input.input-invalid,
.form-group input.input-invalid:focus {
  border-color: var(--color-danger);
  box-shadow: none;
}

.form-group small {
  font-size: var(--font-size-xs);
  line-height: 1.5;
  color: var(--color-text-muted);
}

.form-group small.field-error {
  color: var(--color-danger);
}

.show-passwords {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-lg);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  cursor: pointer;
}

.show-passwords input {
  width: 16px;
  height: 16px;
  cursor: pointer;
  accent-color: var(--color-primary);
}

/* =========================
   Roles
   ========================= */

.role-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: var(--spacing-md);
}

.role-card {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-md);
  padding: var(--spacing-md) var(--spacing-lg);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  cursor: pointer;
  transition: background var(--transition-fast),
  border-color var(--transition-fast),
  box-shadow var(--transition-fast);
}

.role-card:hover {
  background: var(--color-hover-bg);
}

.role-card.selected {
  border-color: var(--color-primary);
  background: var(--color-primary-light);
  box-shadow: 0 0 0 1px var(--color-primary);
}

.role-card input[type="checkbox"] {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  margin-top: 2px;
  cursor: pointer;
  accent-color: var(--color-primary);
}

.role-text {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.role-text strong {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.role-text small {
  font-size: var(--font-size-xs);
  line-height: 1.5;
  color: var(--color-text-muted);
}

.role-summary {
  margin-top: var(--spacing-lg);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.muted-state {
  padding: var(--spacing-lg);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-lg);
  text-align: center;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
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
