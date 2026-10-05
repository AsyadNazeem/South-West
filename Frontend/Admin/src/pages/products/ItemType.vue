<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '../../api/axios'

const router = useRouter()

const itemTypes = ref([])
const loading = ref(true)
const errorMessage = ref('')

const searchQuery = ref('')
const statusFilter = ref('all')

const loadItemTypes = async () => {
  try {
    loading.value = true
    errorMessage.value = ''

    const response = await api.get('/item-types')

    itemTypes.value = response.data.data || []

  } catch (error) {
    console.error('Failed to load item types:', error)

    errorMessage.value =
        error.response?.data?.message ||
        'Failed to load item types.'

  } finally {
    loading.value = false
  }
}

const filteredItemTypes = computed(() => {
  let result = [...itemTypes.value]

  // Search
  if (searchQuery.value.trim()) {
    const search = searchQuery.value.toLowerCase()

    result = result.filter(itemType =>
        itemType.name?.toLowerCase().includes(search) ||
        itemType.code?.toLowerCase().includes(search) ||
        itemType.description?.toLowerCase().includes(search)
    )
  }

  // Status filter
  if (statusFilter.value === 'active') {
    result = result.filter(itemType => itemType.is_active)
  }

  if (statusFilter.value === 'inactive') {
    result = result.filter(itemType => !itemType.is_active)
  }

  return result
})

const goToCreate = () => {
  router.push('/admin/products/item-types/create')
}

const editItemType = (id) => {
  router.push(`/admin/products/item-types/${id}/edit`)
}

const toggleStatus = async (itemType) => {
  const newStatus = !itemType.is_active

  const action = newStatus ? 'activate' : 'deactivate'

  if (!confirm(`Are you sure you want to ${action} this item type?`)) {
    return
  }

  try {
    await api.put(`/item-types/${itemType.id}`, {
      is_active: newStatus
    })

    itemType.is_active = newStatus

  } catch (error) {
    console.error('Failed to update item type:', error)

    alert(
        error.response?.data?.message ||
        'Failed to update item type.'
    )
  }
}

const deleteItemType = async (itemType) => {
  if (
      !confirm(
          `Are you sure you want to delete "${itemType.name}"?`
      )
  ) {
    return
  }

  try {
    await api.delete(`/item-types/${itemType.id}`)

    itemTypes.value = itemTypes.value.filter(
        item => item.id !== itemType.id
    )

  } catch (error) {
    console.error('Failed to delete item type:', error)

    alert(
        error.response?.data?.message ||
        'Failed to delete item type.'
    )
  }
}

const clearFilters = () => {
  searchQuery.value = ''
  statusFilter.value = 'all'
}

onMounted(loadItemTypes)
</script>


<template>
  <div class="item-types-page">

    <!-- Header -->
    <div class="page-header">

      <div>
        <h1>Item Types</h1>

        <p>
          Manage the types of items available in the system.
        </p>
      </div>

      <router-link
          to="/admin/products/item-types/create"
          class="primary-button"
      >
        + Create Type
      </router-link>

    </div>


    <!-- Error -->
    <div
        v-if="errorMessage"
        class="error-message"
    >
      {{ errorMessage }}

      <button
          type="button"
          @click="loadItemTypes"
      >
        Try Again
      </button>
    </div>


    <!-- Filters -->
    <div class="filter-card">

      <div class="search-box">

        <input
            v-model="searchQuery"
            type="text"
            placeholder="Search item types..."
        />

      </div>

      <div class="filter-group">

        <select v-model="statusFilter">

          <option value="all">
            All Status
          </option>

          <option value="active">
            Active
          </option>

          <option value="inactive">
            Inactive
          </option>

        </select>

      </div>

      <button
          v-if="searchQuery || statusFilter !== 'all'"
          type="button"
          class="btn-clear"
          @click="clearFilters"
      >
        Clear Filters
      </button>

    </div>


    <!-- Table Card -->
    <div class="table-card">

      <!-- Loading -->
      <div
          v-if="loading"
          class="loading-state"
      >
        Loading item types...
      </div>


      <!-- Empty -->
      <div
          v-else-if="filteredItemTypes.length === 0"
          class="empty-state"
      >

        <div class="empty-icon">
          📦
        </div>

        <h3>No item types found</h3>

        <p>
          {{
            searchQuery || statusFilter !== 'all'
                ? 'Try changing your search or filter.'
                : 'Create your first item type to get started.'
          }}
        </p>

        <button
            v-if="!searchQuery && statusFilter === 'all'"
            type="button"
            class="btn-primary"
            @click="goToCreate"
        >
          + Add Item Type
        </button>

      </div>


      <!-- Table -->
      <div
          v-else
          class="table-wrapper"
      >

        <table>

          <thead>
          <tr>
            <th>#</th>
            <th>
              Name
            </th>

            <th>
              Code
            </th>

            <th>
              Description
            </th>

            <th>
              Status
            </th>

            <th class="actions-column">
              Actions
            </th>

          </tr>
          </thead>

          <tbody>

          <tr
              v-for="(itemType,index) in filteredItemTypes"
              :key="itemType.id"
          >
            <td>
              {{ index + 1 }}
            </td>

            <!-- Name -->
            <td>

              <div class="item-type-name">
                {{ itemType.name }}
              </div>

            </td>


            <!-- Code -->
            <td>

                <span class="code-badge">
                  {{ itemType.code }}
                </span>

            </td>


            <!-- Description -->
            <td>

                <span
                    v-if="itemType.description"
                    class="description"
                >
                  {{ itemType.description }}
                </span>

              <span
                  v-else
                  class="no-description"
              >
                  No description
                </span>

            </td>


            <!-- Status -->
            <td>

                <span
                    class="status-badge"
                    :class="
                    itemType.is_active
                      ? 'status-active'
                      : 'status-inactive'
                  "
                >
                  {{
                    itemType.is_active
                        ? 'Active'
                        : 'Inactive'
                  }}
                </span>

            </td>


            <!-- Actions -->
            <td>

              <div class="actions">

                <router-link
                    :to="`/admin/products/item-types/${itemType.id}/edit`"
                    class="action-button edit"
                >
                  Edit
                </router-link>

                <button
                    type="button"
                    class="action-btn status-btn"
                    @click="toggleStatus(itemType)"
                >
                  {{
                    itemType.is_active
                        ? 'Deactivate'
                        : 'Activate'
                  }}
                </button>

                <button
                    type="button"
                    class="action-btn delete-btn"
                    @click="deleteItemType(itemType)"
                >
                  Delete
                </button>

              </div>

            </td>

          </tr>

          </tbody>

        </table>

      </div>

    </div>


    <!-- Footer Count -->
    <div
        v-if="!loading"
        class="table-footer"
    >
      Showing
      <strong>{{ filteredItemTypes.length }}</strong>
      of
      <strong>{{ itemTypes.length }}</strong>
      item types
    </div>

  </div>
</template>


<style scoped>
.item-types-page {
  width: 100%;
  max-width: 1900px;
  margin: 0 auto;
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
   Buttons
   ========================= */

.primary-button,
.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 10px var(--spacing-lg);
  border: none;
  border-radius: var(--radius-lg);
  background: var(--color-primary);
  color: var(--color-text-light);
  font-family: inherit;
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  text-decoration: none;
  white-space: nowrap;
  cursor: pointer;
  transition: background var(--transition-fast);
}

.primary-button:hover,
.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.action-button {
  display: inline-flex;
  align-items: center;
  padding: 6px var(--spacing-md);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  font-family: inherit;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  text-decoration: none;
  white-space: nowrap;
  cursor: pointer;
  transition: background var(--transition-fast),
  color var(--transition-fast),
  border-color var(--transition-fast);
}

.action-button.edit:hover {
  background: var(--color-primary-light);
  border-color: var(--color-primary-light);
  color: var(--color-primary);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-clear {
  height: 40px;
  padding: 0 var(--spacing-lg);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  font-family: inherit;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  white-space: nowrap;
  cursor: pointer;
  transition: background var(--transition-fast),
  color var(--transition-fast);
}

.btn-clear:hover {
  background: var(--color-hover-bg);
  color: var(--color-text-primary);
}

/* =========================
   Filters
   ========================= */

.filter-card {
  display: flex;
  align-items: center;
  gap: var(--spacing-lg);
  margin-bottom: var(--spacing-lg);
  padding: var(--spacing-xl);
  background: var(--color-surface);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.search-box {
  flex: 1;
  max-width: 420px;
}

.search-box input,
.filter-group select {
  height: 40px;
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

.search-box input {
  width: 100%;
  padding: 0 var(--spacing-lg);
}

.search-box input::placeholder {
  color: var(--color-text-muted);
}

.filter-group select {
  min-width: 160px;
  padding: 0 var(--spacing-md);
  color: var(--color-text-secondary);
  cursor: pointer;
}

.search-box input:focus,
.filter-group select:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-light);
}

/* =========================
   Table
   ========================= */

.table-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}

.table-wrapper {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th {
  padding: var(--spacing-md) var(--spacing-lg);
  text-align: left;
  white-space: nowrap;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-text-secondary);
  background: var(--color-hover-bg);
  border-bottom: 1px solid var(--color-border-light);
}

td {
  padding: 14px var(--spacing-lg);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  border-bottom: 1px solid var(--color-border-light);
  vertical-align: middle;
}

tbody tr {
  transition: background var(--transition-fast);
}

tbody tr:hover {
  background: var(--color-surface-hover);
}

tbody tr:last-child td {
  border-bottom: none;
}

/* =========================
   Cell Content
   ========================= */

.item-type-name {
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.code-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: var(--radius-md);
  background: var(--color-hover-bg);
  color: var(--color-text-primary);
  font-family: monospace;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
}

.description {
  color: var(--color-text-secondary);
}

.no-description {
  color: var(--color-text-muted);
  font-style: italic;
}

/* =========================
   Status Badges
   ========================= */

.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  white-space: nowrap;
}

.status-active {
  background: var(--color-success-bg);
  color: var(--color-success);
}

.status-inactive {
  background: var(--color-hover-bg);
  color: var(--color-text-secondary);
}

/* =========================
   Actions
   ========================= */

.actions-column {
  width: 220px;
}

.actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  white-space: nowrap;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  padding: 6px var(--spacing-md);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  font-family: inherit;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition: background var(--transition-fast),
  color var(--transition-fast),
  border-color var(--transition-fast);
}

.action-btn:hover {
  background: var(--color-hover-bg);
  color: var(--color-text-primary);
}

.edit-btn:hover {
  background: var(--color-primary-light);
  border-color: var(--color-primary-light);
  color: var(--color-primary);
}

.status-btn:hover {
  background: var(--color-success-bg);
  border-color: var(--color-success-bg);
  color: var(--color-success);
}

.delete-btn:hover {
  background: var(--color-danger-bg);
  border-color: var(--color-danger-light);
  color: var(--color-danger);
}

/* =========================
   States
   ========================= */

.loading-state {
  padding: 50px var(--spacing-xl);
  text-align: center;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.empty-state {
  padding: 60px var(--spacing-xl);
  text-align: center;
}

.empty-icon {
  margin-bottom: var(--spacing-lg);
  font-size: 36px;
}

.empty-state h3 {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.empty-state p {
  margin: 6px 0 var(--spacing-xl);
  font-size: var(--font-size-md);
  color: var(--color-text-secondary);
}

.error-message {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-lg);
  margin-bottom: var(--spacing-lg);
  padding: var(--spacing-md) var(--spacing-lg);
  border-radius: var(--radius-lg);
  background: var(--color-danger-bg);
  color: var(--color-danger);
  font-size: var(--font-size-sm);
}

.error-message button {
  border: none;
  background: transparent;
  color: var(--color-danger);
  font-family: inherit;
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
}

/* =========================
   Footer
   ========================= */

.table-footer {
  padding: var(--spacing-md) 2px;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.table-footer strong {
  color: var(--color-text-primary);
}

/* =========================
   Responsive
   ========================= */

@media (max-width: 900px) {
  .filter-card {
    flex-wrap: wrap;
  }

  .search-box {
    flex-basis: 100%;
    max-width: none;
  }
}

@media (max-width: 800px) {
  .page-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .filter-card {
    flex-direction: column;
    align-items: stretch;
  }

  .filter-group select,
  .btn-clear {
    width: 100%;
  }

  .actions {
    flex-wrap: wrap;
  }
}
</style>
