<script setup>
import { ref, computed, onMounted } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import api from '../../api/axios'
import { refreshAuthorization } from '../../auth/authorization'

// ==========================================
// State
// ==========================================

const roles = ref([])
const permissions = ref([])
const route = useRoute()
const router = useRouter()

const selectedRoleId = ref('')
const selectedPermissionIds = ref([])
const originalPermissionIds = ref([])

const pageLoading = ref(true)
const loading = ref(false)
const saving = ref(false)
const errorMessage = ref('')

const search = ref('')
const filter = ref('all') // all | selected | unselected
const collapsed = ref(new Set())

// ==========================================
// Computed
// ==========================================

const selectedRoleName = computed(() => {
  const role = roles.value.find(
      item => String(item.id) === String(selectedRoleId.value)
  )

  return role ? role.name : ''
})

const selectedSet = computed(() => new Set(selectedPermissionIds.value))

const hasChanges = computed(() => {
  const current = [...selectedPermissionIds.value].sort((a, b) => a - b)
  const original = [...originalPermissionIds.value].sort((a, b) => a - b)

  return (
      current.length !== original.length ||
      current.some((id, index) => id !== original[index])
  )
})

const searchTerm = computed(() => search.value.trim().toLowerCase())

// Modules with all their permissions and the ones matching search / filter
const modules = computed(() => {
  const map = new Map()

  permissions.value.forEach(permission => {
    const name = permission.module || 'Other'

    if (!map.has(name)) {
      map.set(name, { name, all: [], visible: [] })
    }

    map.get(name).all.push(permission)
  })

  const term = searchTerm.value

  map.forEach(module => {
    module.visible = module.all.filter(permission => {
      const matchesSearch =
          !term ||
          permission.name?.toLowerCase().includes(term) ||
          permission.description?.toLowerCase().includes(term) ||
          module.name.toLowerCase().includes(term)

      const isSelected = selectedSet.value.has(permission.id)

      const matchesFilter =
          filter.value === 'all' ||
          (filter.value === 'selected' && isSelected) ||
          (filter.value === 'unselected' && !isSelected)

      return matchesSearch && matchesFilter
    })
  })

  return [...map.values()]
      .filter(module => module.visible.length)
      .sort((a, b) => {
        if (a.name === 'Other') return 1
        if (b.name === 'Other') return -1

        return a.name.localeCompare(b.name)
      })
})

// ==========================================
// Helpers
// ==========================================

const moduleSelectedCount = (module) =>
    module.all.filter(permission => selectedSet.value.has(permission.id)).length

const isModuleOpen = (name) => !!searchTerm.value || !collapsed.value.has(name)

const toggleCollapsed = (name) => {
  if (collapsed.value.has(name)) {
    collapsed.value.delete(name)
  } else {
    collapsed.value.add(name)
  }
}

const expandAll = () => collapsed.value.clear()

const collapseAll = () => {
  modules.value.forEach(module => collapsed.value.add(module.name))
}

const isVisibleFullySelected = (module) =>
    module.visible.length > 0 &&
    module.visible.every(permission => selectedSet.value.has(permission.id))

// Select / unselect every permission currently visible in the module
const toggleModule = (module) => {
  const visibleIds = module.visible.map(permission => permission.id)

  if (isVisibleFullySelected(module)) {
    selectedPermissionIds.value = selectedPermissionIds.value.filter(
        id => !visibleIds.includes(id)
    )
  } else {
    const merged = new Set([...selectedPermissionIds.value, ...visibleIds])

    selectedPermissionIds.value = [...merged]
  }
}

const clearSearch = () => {
  search.value = ''
}

// ==========================================
// Load
// ==========================================

const loadInitialData = async () => {
  try {
    const [rolesResponse, permissionsResponse] = await Promise.all([
      api.get('/roles'),
      api.get('/permissions')
    ])

    roles.value = rolesResponse.data.data || []
    permissions.value = permissionsResponse.data.data || []
  } catch (error) {
    console.error('Failed to load roles and permissions:', error)

    errorMessage.value =
        error.response?.data?.message ||
        'Failed to load roles and permissions.'
  } finally {
    pageLoading.value = false
  }
}

onMounted(loadInitialData)

const loadRolePermissions = async () => {
  if (!selectedRoleId.value) {
    selectedPermissionIds.value = []
    originalPermissionIds.value = []
    return
  }

  loading.value = true
  errorMessage.value = ''

  try {
    const response = await api.get(
        `/roles/${selectedRoleId.value}/permissions`
    )

    const role = response.data.data

    const ids = (role.permissions || []).map(permission => permission.id)

    selectedPermissionIds.value = [...ids]
    originalPermissionIds.value = [...ids]
  } catch (error) {
    console.error('Failed to load role permissions:', error)

    errorMessage.value =
        error.response?.data?.message ||
        'Failed to load role permissions.'

    selectedPermissionIds.value = []
    originalPermissionIds.value = []
  } finally {
    loading.value = false
  }
}

const onRoleChange = async (event) => {
  const newRoleId = event.target.value

  if (
      hasChanges.value &&
      !confirm('You have unsaved changes. Switch role and discard them?')
  ) {
    event.target.value = selectedRoleId.value
    return
  }

  selectedRoleId.value = newRoleId

  await loadRolePermissions()
}

// ==========================================
// Save / reset
// ==========================================

const resetChanges = () => {
  selectedPermissionIds.value = [...originalPermissionIds.value]
}

const savePermissions = async () => {
  if (!selectedRoleId.value) return

  saving.value = true
  errorMessage.value = ''

  try {
    await api.put(`/roles/${selectedRoleId.value}/permissions`, {
      permission_ids: selectedPermissionIds.value
    })

    alert('Permissions updated successfully.')

    await loadRolePermissions()
    await refreshAuthorization()
    await router.replace(route.fullPath)
  } catch (error) {
    console.error('Failed to update permissions:', error)

    errorMessage.value =
        error.response?.data?.message ||
        'Failed to update permissions.'
  } finally {
    saving.value = false
  }
}

onBeforeRouteLeave(() => {
  if (!hasChanges.value) return true

  return confirm('You have unsaved changes. Leave this page and discard them?')
})
</script>

<template>
  <div class="permission-page">

    <!-- Header -->
    <div class="form-header">
      <div>
        <h1>Assign Permissions</h1>
        <p>Manage the permissions assigned to each system role.</p>
      </div>
    </div>

    <!-- Error -->
    <div
        v-if="errorMessage"
        class="error-message"
    >
      {{ errorMessage }}
    </div>

    <!-- Initial loading -->
    <div
        v-if="pageLoading"
        class="muted-state"
    >
      Loading...
    </div>

    <template v-else>

      <!-- Role selection -->
      <section class="form-section">

        <div class="section-header">
          <h2>Role</h2>
          <p>Choose the role whose permissions you want to manage.</p>
        </div>

        <div class="form-group role-select">
          <label for="role">
            Select Role
          </label>

          <select
              id="role"
              :value="selectedRoleId"
              :disabled="loading || saving"
              @change="onRoleChange"
          >
            <option value="">Select a role</option>

            <option
                v-for="role in roles"
                :key="role.id"
                :value="role.id"
            >
              {{ role.name }}
            </option>
          </select>
        </div>

      </section>

      <!-- Loading role permissions -->
      <div
          v-if="loading"
          class="muted-state"
      >
        Loading permissions...
      </div>

      <!-- Permissions -->
      <section
          v-else-if="selectedRoleId"
          class="form-section"
      >

        <div class="section-header permission-heading">
          <div>
            <h2>Permissions</h2>

            <p>
              Select the permissions for
              <strong>{{ selectedRoleName }}</strong>
            </p>
          </div>

          <div class="count-pill">
            {{ selectedPermissionIds.length }} of
            {{ permissions.length }} selected
          </div>
        </div>

        <!-- Toolbar -->
        <div class="toolbar">

          <div class="search-box">
            <input
                v-model="search"
                type="text"
                placeholder="Search permissions, descriptions or modules..."
            />

            <button
                v-if="search"
                type="button"
                class="clear-search"
                title="Clear search"
                @click="clearSearch"
            >
              ×
            </button>
          </div>

          <div class="segmented">
            <button
                type="button"
                :class="{ active: filter === 'all' }"
                @click="filter = 'all'"
            >
              All
            </button>

            <button
                type="button"
                :class="{ active: filter === 'selected' }"
                @click="filter = 'selected'"
            >
              Selected
            </button>

            <button
                type="button"
                :class="{ active: filter === 'unselected' }"
                @click="filter = 'unselected'"
            >
              Unselected
            </button>
          </div>

          <div class="toolbar-links">
            <button
                type="button"
                @click="expandAll"
            >
              Expand all
            </button>

            <button
                type="button"
                @click="collapseAll"
            >
              Collapse all
            </button>
          </div>

        </div>

        <!-- Modules -->
        <div
            v-if="modules.length"
            class="module-list"
        >
          <div
              v-for="module in modules"
              :key="module.name"
              class="module-card"
          >

            <div class="module-header">

              <button
                  type="button"
                  class="module-toggle"
                  @click="toggleCollapsed(module.name)"
              >
                <span
                    class="chevron"
                    :class="{ open: isModuleOpen(module.name) }"
                >
                  ›
                </span>

                <span class="module-title">
                  <strong>{{ module.name }}</strong>

                  <small>
                    {{ moduleSelectedCount(module) }} /
                    {{ module.all.length }} selected
                  </small>
                </span>
              </button>

              <button
                  type="button"
                  class="link-button"
                  @click="toggleModule(module)"
              >
                {{
                  isVisibleFullySelected(module)
                      ? 'Unselect all'
                      : 'Select all'
                }}
              </button>

            </div>

            <div
                v-show="isModuleOpen(module.name)"
                class="permission-list"
            >
              <label
                  v-for="permission in module.visible"
                  :key="permission.id"
                  class="permission-item"
                  :class="{ selected: selectedSet.has(permission.id) }"
              >
                <input
                    v-model="selectedPermissionIds"
                    type="checkbox"
                    :value="permission.id"
                />

                <span class="permission-info">
                  <strong>{{ permission.name }}</strong>

                  <small v-if="permission.description">
                    {{ permission.description }}
                  </small>
                </span>
              </label>
            </div>

          </div>
        </div>

        <div
            v-else
            class="muted-state"
        >
          No permissions match your search or filter.
        </div>

      </section>

      <!-- No role selected -->
      <div
          v-else
          class="muted-state empty-role"
      >
        <strong>Select a role</strong>

        <span>Choose a role above to manage its permissions.</span>
      </div>

      <!-- Save bar -->
      <div
          v-if="selectedRoleId && !loading"
          class="save-bar"
      >

        <div class="save-summary">
          <strong>{{ selectedPermissionIds.length }}</strong>
          permissions selected

          <span
              v-if="hasChanges"
              class="unsaved"
          >
            • Unsaved changes
          </span>
        </div>

        <div class="save-actions">
          <button
              type="button"
              class="btn-secondary"
              :disabled="!hasChanges || saving"
              @click="resetChanges"
          >
            Reset
          </button>

          <button
              type="button"
              class="btn-primary"
              :disabled="!hasChanges || saving"
              @click="savePermissions"
          >
            {{ saving ? 'Saving...' : 'Save Permissions' }}
          </button>
        </div>

      </div>

    </template>

  </div>
</template>

<style scoped>
.permission-page {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xl);
  width: 100%;
  max-width: 1100px;
  margin: 0 auto;
  font-family: var(--font-family);
}

/* =========================
   Header
   ========================= */

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
   Sections
   ========================= */

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

.permission-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--spacing-lg);
}

.count-pill {
  padding: 6px var(--spacing-md);
  border-radius: var(--radius-full);
  background: var(--color-primary-light);
  color: var(--color-primary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  white-space: nowrap;
}

/* =========================
   Role select
   ========================= */

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.role-select {
  max-width: 420px;
}

.form-group label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.form-group select {
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
  cursor: pointer;
  transition: border-color var(--transition-fast),
  box-shadow var(--transition-fast);
}

.form-group select:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-light);
}

.form-group select:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* =========================
   Toolbar
   ========================= */

.toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--spacing-lg);
  margin-bottom: var(--spacing-xl);
}

.search-box {
  position: relative;
  flex: 1;
  min-width: 240px;
  max-width: 440px;
}

.search-box input {
  width: 100%;
  box-sizing: border-box;
  height: 40px;
  padding: 0 40px 0 var(--spacing-lg);
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

.search-box input::placeholder {
  color: var(--color-text-muted);
}

.search-box input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-light);
}

.clear-search {
  position: absolute;
  top: 50%;
  right: 10px;
  transform: translateY(-50%);
  padding: 0 4px;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
}

.clear-search:hover {
  color: var(--color-text-primary);
}

.segmented {
  display: inline-flex;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}

.segmented button {
  height: 38px;
  padding: 0 var(--spacing-lg);
  border: none;
  border-right: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  font-family: inherit;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition: background var(--transition-fast),
  color var(--transition-fast);
}

.segmented button:last-child {
  border-right: none;
}

.segmented button:hover:not(.active) {
  background: var(--color-hover-bg);
  color: var(--color-text-primary);
}

.segmented button.active {
  background: var(--color-primary);
  color: var(--color-text-light);
}

.toolbar-links {
  display: flex;
  gap: var(--spacing-md);
  margin-left: auto;
}

.toolbar-links button,
.link-button {
  padding: 0;
  border: none;
  background: transparent;
  color: var(--color-primary);
  font-family: inherit;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
}

.toolbar-links button:hover,
.link-button:hover {
  text-decoration: underline;
}

/* =========================
   Modules
   ========================= */

.module-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.module-card {
  overflow: hidden;
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}

.module-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
  padding: var(--spacing-md) var(--spacing-lg);
  background: var(--color-hover-bg);
}

.module-toggle {
  display: flex;
  align-items: center;
  flex: 1;
  gap: var(--spacing-md);
  padding: 0;
  border: none;
  background: transparent;
  text-align: left;
  font-family: inherit;
  cursor: pointer;
}

.chevron {
  display: inline-block;
  width: 16px;
  color: var(--color-text-secondary);
  font-size: 20px;
  line-height: 1;
  transition: transform var(--transition-fast);
}

.chevron.open {
  transform: rotate(90deg);
}

.module-title {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.module-title strong {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  text-transform: capitalize;
}

.module-title small {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.permission-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.permission-item {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-md);
  padding: var(--spacing-md) var(--spacing-lg);
  border-top: 1px solid var(--color-border-light);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.permission-item:hover {
  background: var(--color-hover-bg);
}

.permission-item.selected {
  background: var(--color-primary-light);
}

.permission-item input[type="checkbox"] {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  margin-top: 2px;
  cursor: pointer;
  accent-color: var(--color-primary);
}

.permission-info {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.permission-info strong {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  word-break: break-word;
}

.permission-info small {
  font-size: var(--font-size-xs);
  line-height: 1.5;
  color: var(--color-text-muted);
}

/* =========================
   Save bar
   ========================= */

.save-bar {
  position: sticky;
  bottom: var(--spacing-lg);
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-lg);
  padding: var(--spacing-md) var(--spacing-xl);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
}

.save-summary {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.save-summary strong {
  color: var(--color-text-primary);
}

.unsaved {
  color: var(--color-danger);
  font-weight: var(--font-weight-semibold);
}

.save-actions {
  display: flex;
  gap: var(--spacing-md);
}

/* =========================
   States
   ========================= */

.error-message {
  padding: var(--spacing-md) var(--spacing-lg);
  border: 1px solid var(--color-danger-light);
  border-radius: var(--radius-lg);
  background: var(--color-danger-bg);
  color: var(--color-danger);
  font-size: var(--font-size-sm);
}

.muted-state {
  padding: var(--spacing-2xl) var(--spacing-xl);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-lg);
  text-align: center;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.empty-role {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.empty-role strong {
  font-size: var(--font-size-md);
  color: var(--color-text-primary);
}

/* =========================
   Buttons
   ========================= */

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
  .form-section {
    padding: var(--spacing-xl);
  }

  .permission-heading {
    flex-direction: column;
  }

  .toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .search-box {
    max-width: none;
  }

  .segmented button {
    flex: 1;
  }

  .toolbar-links {
    margin-left: 0;
  }

  .permission-list {
    grid-template-columns: 1fr;
  }

  .save-bar {
    flex-direction: column;
    align-items: stretch;
    gap: var(--spacing-md);
  }

  .save-actions {
    flex-direction: column-reverse;
  }

  .btn-primary,
  .btn-secondary {
    width: 100%;
  }
}
</style>
