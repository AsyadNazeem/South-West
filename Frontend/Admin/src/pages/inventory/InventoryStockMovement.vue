<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '@/api/axios'
import {
  hasPermission as authorization,
  ensureAuthorization
} from '@/auth/authorization.js'

// Base path of inventory stock movement pages
const MOVEMENT_BASE = '/admin/inventory/movements'

const movements = ref([])
const loading = ref(true)
const errorMessage = ref('')
const forbidden = ref(false)
const busyId = ref(null)

const search = ref('')
const movementTypeFilter = ref('all')
const statusFilter = ref('all')

const movementTypes = [
  { value: 'purchase', label: 'Purchase' },
  { value: 'sale', label: 'Sale' },
  { value: 'customer_return', label: 'Customer Return' },
  { value: 'supplier_return', label: 'Supplier Return' },
  { value: 'adjustment', label: 'Adjustment' },
  { value: 'transfer_in', label: 'Transfer In' },
  { value: 'transfer_out', label: 'Transfer Out' }
]

const showActions = computed(() => authorization('inventory.update'))

// Records without an is_active value are treated as active
const isActive = (movement) => movement.is_active !== false && movement.is_active !== 0

const filteredMovements = computed(() => {
  const term = search.value.toLowerCase().trim()

  return movements.value.filter((movement) => {
    const matchesSearch =
        !term ||
        String(movement.item?.item_code || '')
            .toLowerCase()
            .includes(term) ||
        String(movement.item?.item_name || '')
            .toLowerCase()
            .includes(term) ||
        String(movement.location?.code || '')
            .toLowerCase()
            .includes(term) ||
        String(movement.location?.name || '')
            .toLowerCase()
            .includes(term) ||
        String(movement.reference_type || '')
            .toLowerCase()
            .includes(term) ||
        String(movement.reference_id || '')
            .toLowerCase()
            .includes(term) ||
        String(movement.creator?.email || '')
            .toLowerCase()
            .includes(term)

    const matchesType =
        movementTypeFilter.value === 'all' ||
        movement.movement_type === movementTypeFilter.value

    const matchesStatus =
        statusFilter.value === 'all' ||
        (statusFilter.value === 'active' && isActive(movement)) ||
        (statusFilter.value === 'inactive' && !isActive(movement))

    return matchesSearch && matchesType && matchesStatus
  })
})

const loadMovements = async () => {
  try {
    loading.value = true
    errorMessage.value = ''

    const response = await api.get('/inventory-stock-movements')

    movements.value = response.data.data || []
  } catch (error) {
    console.error(
        'Failed to load inventory stock movements:',
        error
    )

    const status = error.response?.status

    errorMessage.value =
        error.response?.data?.message ||
        (status === 404
            ? 'Inventory stock movements endpoint not found (404). Check that the backend mounts /api/inventory-stock-movements.'
            : 'Failed to load inventory stock movements.')
  } finally {
    loading.value = false
  }
}

const toggleStatus = async (movement) => {
  const makeActive = !isActive(movement)

  if (
      !makeActive &&
      !confirm(
          `Are you sure you want to deactivate this movement for "${movement.item?.item_name || 'this item'}"?`
      )
  ) {
    return
  }

  try {
    busyId.value = movement.id

    await api.put(`/inventory-stock-movements/${movement.id}`, {
      is_active: makeActive
    })

    await loadMovements()
  } catch (error) {
    console.error('Status update error:', error)

    alert(
        error.response?.data?.message ||
        'Failed to update movement status.'
    )
  } finally {
    busyId.value = null
  }
}

const getMovementLabel = (type) => {
  const movement = movementTypes.find(
      item => item.value === type
  )

  return movement?.label || type || '-'
}

const getMovementClass = (type) => {
  switch (type) {
    case 'purchase':
    case 'customer_return':
    case 'transfer_in':
      return 'in'

    case 'sale':
    case 'supplier_return':
    case 'transfer_out':
      return 'out'

    case 'adjustment':
      return 'adjustment'

    default:
      return 'adjustment'
  }
}

const isIncomingMovement = (type) => {
  return [
    'purchase',
    'customer_return',
    'transfer_in'
  ].includes(type)
}

const formatQuantity = (quantity) => {
  const value = Number(quantity || 0)

  return Number.isInteger(value)
      ? value.toString()
      : value.toFixed(3)
}

const formatMovementQuantity = (movement) => {
  const quantity = formatQuantity(movement.quantity)

  if (isIncomingMovement(movement.movement_type)) {
    return `+${quantity}`
  }

  if (
      [
        'sale',
        'supplier_return',
        'transfer_out'
      ].includes(movement.movement_type)
  ) {
    return `-${quantity}`
  }

  return quantity
}

const formatDateTime = (date) => {
  if (!date) {
    return '-'
  }

  const parsedDate = new Date(date)

  if (Number.isNaN(parsedDate.getTime())) {
    return '-'
  }

  return parsedDate.toLocaleString()
}

const getReference = (movement) => {
  if (
      movement.reference_type &&
      movement.reference_id
  ) {
    return `${movement.reference_type} #${movement.reference_id}`
  }

  if (movement.reference_type) {
    return movement.reference_type
  }

  if (movement.reference_id) {
    return `#${movement.reference_id}`
  }

  return '-'
}

onMounted(async () => {
  // Wait for the user's permissions before checking them
  try {
    await ensureAuthorization()
  } catch (error) {
    console.error(
        'Failed to load authorization:',
        error
    )
  }

  if (!authorization('inventory.view')) {
    forbidden.value = true
    loading.value = false

    errorMessage.value =
        'You do not have permission to view inventory stock movements.'

    return
  }

  loadMovements()
})
</script>

<template>
  <div class="page-container">

    <!-- Header -->
    <div class="page-header">

      <div>
        <h1>Inventory Stock Movements</h1>

        <p>
          View the history of stock movements across inventory locations.
        </p>
      </div>

      <router-link
          v-if="authorization('inventory.create')"
          :to="`${MOVEMENT_BASE}/create`"
          class="primary-button"
      >
        + Add Movement
      </router-link>

    </div>


    <!-- Error -->
    <div
        v-if="errorMessage"
        class="error-state"
    >
      <span>{{ errorMessage }}</span>

      <button
          v-if="!forbidden"
          type="button"
          class="action-button"
          @click="loadMovements"
      >
        Try Again
      </button>
    </div>


    <template v-if="!forbidden">

      <!-- Filters -->
      <div class="filter-card">

        <div class="search-box">
          <input
              v-model="search"
              type="text"
              placeholder="Search item, location, reference..."
          />
        </div>

        <select v-model="movementTypeFilter">
          <option value="all">
            All Movement Types
          </option>

          <option
              v-for="type in movementTypes"
              :key="type.value"
              :value="type.value"
          >
            {{ type.label }}
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

        <button
            type="button"
            class="action-button refresh"
            :disabled="loading"
            @click="loadMovements"
        >
          Refresh
        </button>

      </div>


      <!-- Table -->
      <div class="table-card">

        <!-- Loading -->
        <div
            v-if="loading"
            class="empty-state"
        >
          Loading stock movements...
        </div>


        <!-- Empty -->
        <div
            v-else-if="!filteredMovements.length"
            class="empty-state"
        >
          No stock movements found.
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
                Item
              </th>

              <th>
                Location
              </th>

              <th>
                Movement
              </th>

              <th>
                Quantity
              </th>

              <th>
                Reference
              </th>

              <th>
                Created By
              </th>

              <th>
                Date
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
                v-for="(movement, index) in filteredMovements"
                :key="movement.id"
                :class="{ 'row-inactive': !isActive(movement) }"
            >

              <!-- # -->
              <td>
                {{ index + 1 }}
              </td>


              <!-- Item -->
              <td>

                <div class="cell-info">

                  <strong>
                    {{ movement.item?.item_code || '-' }}
                  </strong>

                  <small>
                    {{ movement.item?.item_name || 'Unknown Item' }}
                  </small>

                </div>

              </td>


              <!-- Location -->
              <td>

                <div class="cell-info">

                  <strong>
                    {{ movement.location?.code || '-' }}
                  </strong>

                  <small>
                    {{ movement.location?.name || 'Unknown Location' }}
                  </small>

                </div>

              </td>


              <!-- Movement -->
              <td>

                <span
                    class="movement-badge"
                    :class="getMovementClass(movement.movement_type)"
                >
                  {{ getMovementLabel(movement.movement_type) }}
                </span>

              </td>


              <!-- Quantity -->
              <td>

                <span
                    class="quantity-badge"
                    :class="getMovementClass(movement.movement_type)"
                >
                  {{ formatMovementQuantity(movement) }}
                </span>

              </td>


              <!-- Reference -->
              <td>

                <span class="reference">
                  {{ getReference(movement) }}
                </span>

              </td>


              <!-- Created By -->
              <td>

                <span class="creator">
                  {{ movement.creator?.email || '-' }}
                </span>

              </td>


              <!-- Date -->
              <td>

                <span class="date">
                  {{ formatDateTime(movement.created_at) }}
                </span>

              </td>


              <!-- Status -->
              <td>

                <span
                    class="status-badge"
                    :class="isActive(movement) ? 'active' : 'inactive'"
                >
                  {{ isActive(movement) ? 'Active' : 'Inactive' }}
                </span>

              </td>


              <!-- Actions -->
              <td v-if="showActions">

                <div class="action-buttons">

                  <router-link
                      :to="`${MOVEMENT_BASE}/edit/${movement.id}`"
                      class="action-button edit"
                  >
                    Edit
                  </router-link>


                  <button
                      type="button"
                      class="action-button"
                      :class="{ delete: isActive(movement) }"
                      :disabled="busyId === movement.id"
                      @click="toggleStatus(movement)"
                  >
                    {{ isActive(movement) ? 'Deactivate' : 'Activate' }}
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
  transition:
      background var(--transition-fast),
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

.action-button.refresh {
  height: 40px;
  padding: 0 var(--spacing-lg);
  border-radius: var(--radius-lg);
  font-size: var(--font-size-md);
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
  transition:
      border-color var(--transition-fast),
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

/* Deactivated movements are dimmed but still readable */
tbody tr.row-inactive td:not(:last-child) {
  opacity: 0.6;
}


/* =========================
   Cell Information
   ========================= */

.cell-info {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.cell-info small {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}


/* =========================
   Badges
   ========================= */

.movement-badge,
.quantity-badge,
.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  white-space: nowrap;
}


/* Incoming */

.movement-badge.in,
.quantity-badge.in,
.status-badge.active {
  background: var(--color-success-bg);
  color: var(--color-success);
}


/* Outgoing */

.movement-badge.out,
.quantity-badge.out {
  background: var(--color-danger-bg);
  color: var(--color-danger);
}


/* Adjustment */

.movement-badge.adjustment,
.quantity-badge.adjustment {
  background: var(--color-warning-bg, #fef3c7);
  color: var(--color-warning, #92400e);
}


/* Inactive */

.status-badge.inactive {
  background: var(--color-hover-bg);
  color: var(--color-text-secondary);
}


/* =========================
   Reference / Creator / Date
   ========================= */

.reference {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.creator {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.date {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  white-space: nowrap;
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

  .error-state {
    flex-direction: column;
    align-items: flex-start;
  }
}

</style>
