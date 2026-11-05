<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '@/api/axios'
import {
  hasPermission as authorization,
  ensureAuthorization
} from '@/auth/authorization.js'

// Base path of the inventory location pages in your router
const LOCATION_BASE = '/admin/inventory/locations'

const locations = ref([])
const loading = ref(true)
const errorMessage = ref('')
const forbidden = ref(false)
const busyId = ref(null)

const search = ref('')
const typeFilter = ref('all')
const statusFilter = ref('all')

const showActions = computed(() =>
    authorization('inventory.update') ||
    authorization('inventory.delete')
)

const filteredLocations = computed(() => {
  const term = search.value.toLowerCase().trim()

  return locations.value.filter((location) => {
    const matchesSearch =
        !term ||
        String(location.code || '').toLowerCase().includes(term) ||
        String(location.name || '').toLowerCase().includes(term) ||
        String(location.address || '').toLowerCase().includes(term)

    const matchesType =
        typeFilter.value === 'all' ||
        location.location_type === typeFilter.value

    const matchesStatus =
        statusFilter.value === 'all' ||
        (statusFilter.value === 'active' && location.is_active) ||
        (statusFilter.value === 'inactive' && !location.is_active)

    return matchesSearch && matchesType && matchesStatus
  })
})

const loadLocations = async () => {
  try {
    loading.value = true
    errorMessage.value = ''

    const response = await api.get('/inventory-locations')

    locations.value = response.data.data || []
  } catch (error) {
    console.error('Failed to load inventory locations:', error)

    errorMessage.value =
        error.response?.data?.message ||
        'Failed to load inventory locations.'
  } finally {
    loading.value = false
  }
}

const toggleStatus = async (location) => {
  const makeActive = !location.is_active

  if (
      !makeActive &&
      !confirm(`Are you sure you want to deactivate "${location.name}"?`)
  ) {
    return
  }

  try {
    busyId.value = location.id

    await api.put(`/inventory-locations/${location.id}`, {
      is_active: makeActive
    })

    await loadLocations()
  } catch (error) {
    console.error('Status update error:', error)

    alert(
        error.response?.data?.message ||
        'Failed to update location status.'
    )
  } finally {
    busyId.value = null
  }
}

const formatLocationType = (type) => {
  if (!type) return 'Unknown'

  return type.charAt(0).toUpperCase() + type.slice(1)
}

onMounted(async () => {
  // Wait for the user's permissions before checking them
  try {
    await ensureAuthorization()
  } catch (error) {
    console.error('Failed to load authorization:', error)
  }

  if (!authorization('inventory.view')) {
    forbidden.value = true
    loading.value = false
    errorMessage.value =
        'You do not have permission to view inventory locations.'
    return
  }

  loadLocations()
})
</script>

<template>
  <div class="page-container">

    <!-- Header -->
    <div class="page-header">

      <div>
        <h1>Inventory Locations</h1>

        <p>
          Manage warehouses, stores and other inventory locations.
        </p>
      </div>

      <router-link
          v-if="authorization('inventory.create')"
          :to="`${LOCATION_BASE}/create`"
          class="primary-button"
      >
        + Add Location
      </router-link>

    </div>


    <!-- Error -->
    <div
        v-if="errorMessage"
        class="error-state"
    >
      {{ errorMessage }}
    </div>


    <template v-if="!forbidden">

      <!-- Filters -->
      <div class="filter-card">

        <div class="search-box">

          <input
              v-model="search"
              type="text"
              placeholder="Search code, name, address..."
          />

        </div>


        <select v-model="typeFilter">

          <option value="all">
            All Types
          </option>

          <option value="store">
            Store
          </option>

          <option value="warehouse">
            Warehouse
          </option>

          <option value="online">
            Online
          </option>

          <option value="service">
            Service
          </option>

        </select>


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


      <!-- Table -->
      <div class="table-card">

        <!-- Loading -->
        <div
            v-if="loading"
            class="empty-state"
        >
          Loading inventory locations...
        </div>


        <!-- Empty -->
        <div
            v-else-if="!filteredLocations.length"
            class="empty-state"
        >
          No inventory locations found.
        </div>


        <!-- Table -->
        <div
            v-else
            class="table-container"
        >

          <table>

            <thead>

            <tr>

              <th>#</th>

              <th>
                Code
              </th>

              <th>
                Name
              </th>

              <th>
                Type
              </th>

              <th>
                Address
              </th>

              <th>
                Status
              </th>

              <th v-if="showActions">
                Actions
              </th>

            </tr>

            </thead>


            <tbody>

            <tr
                v-for="(location, index) in filteredLocations"
                :key="location.id"
            >

              <td>{{ index + 1 }}</td>


              <!-- Code -->
              <td>

                <strong>
                  {{ location.code }}
                </strong>

              </td>


              <!-- Name -->
              <td>
                {{ location.name }}
              </td>


              <!-- Type -->
              <td>

                <span class="type-badge">
                  {{ formatLocationType(location.location_type) }}
                </span>

              </td>


              <!-- Address -->
              <td>

                <span class="description-column">
                  {{ location.address || '-' }}
                </span>

              </td>


              <!-- Status -->
              <td>

                <span
                    class="status-badge"
                    :class="location.is_active ? 'active' : 'inactive'"
                >
                  {{ location.is_active ? 'Active' : 'Inactive' }}
                </span>

              </td>


              <!-- Actions -->
              <td v-if="showActions">

                <div class="action-buttons">

                  <router-link
                      v-if="authorization('inventory.update')"
                      :to="`${LOCATION_BASE}/edit/${location.id}`"
                      class="action-button edit"
                  >
                    Edit
                  </router-link>


                  <button
                      v-if="authorization('inventory.update')"
                      type="button"
                      class="action-button"
                      :disabled="busyId === location.id"
                      @click="toggleStatus(location)"
                  >
                    {{ location.is_active ? 'Deactivate' : 'Activate' }}
                  </button>

                </div>

              </td>

            </tr>

            </tbody>

          </table>

        </div>

      </div>

    </template>

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
   Buttons
   ========================= */

.primary-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 10px var(--spacing-lg);
  border-radius: var(--radius-lg);
  background: var(--color-primary);
  color: var(--color-text-light);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  text-decoration: none;
  white-space: nowrap;
  transition: background var(--transition-fast);
}

.primary-button:hover {
  background: var(--color-primary-hover);
}

.action-buttons {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
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

.action-button:hover:not(:disabled) {
  background: var(--color-hover-bg);
  color: var(--color-text-primary);
}

.action-button.edit:hover:not(:disabled) {
  background: var(--color-primary-light);
  border-color: var(--color-primary-light);
  color: var(--color-primary);
}

.action-button.delete:hover:not(:disabled) {
  background: var(--color-danger-bg);
  border-color: var(--color-danger-light);
  color: var(--color-danger);
}

.action-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
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
.filter-card select {
  height: 40px;
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

.filter-card select {
  min-width: 150px;
  padding: 0 var(--spacing-md);
  color: var(--color-text-secondary);
  cursor: pointer;
}

.search-box input:focus,
.filter-card select:focus {
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

.table-container {
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

td strong {
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
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

.description-column {
  display: -webkit-box;
  min-width: 220px;
  max-width: 320px;
  line-height: 1.5;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* =========================
   Badges
   ========================= */

.type-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: var(--radius-full);
  background: var(--color-primary-light);
  color: var(--color-primary);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  white-space: nowrap;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  white-space: nowrap;
}

.status-badge.active {
  background: var(--color-success-bg);
  color: var(--color-success);
}

.status-badge.inactive {
  background: var(--color-hover-bg);
  color: var(--color-text-secondary);
}

/* =========================
   States
   ========================= */

.empty-state {
  padding: 50px var(--spacing-xl);
  text-align: center;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.error-state {
  margin-bottom: var(--spacing-lg);
  padding: var(--spacing-md) var(--spacing-lg);
  border-radius: var(--radius-lg);
  background: var(--color-danger-bg);
  color: var(--color-danger);
  font-size: var(--font-size-sm);
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

@media (max-width: 700px) {
  .page-header,
  .filter-card {
    flex-direction: column;
    align-items: stretch;
  }

  .page-header {
    align-items: flex-start;
  }

  .filter-card select {
    width: 100%;
  }
}
</style>
