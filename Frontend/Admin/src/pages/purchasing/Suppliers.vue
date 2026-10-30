<template>
  <div class="page-container">

    <!-- Header -->
    <div class="page-header">

      <div>
        <h1>Suppliers</h1>

        <p>
          Manage your suppliers.
        </p>
      </div>

      <button
          v-if="hasPermission('products.create')"
          type="button"
          class="primary-button"
          @click="goToCreate"
      >
        + Add Supplier
      </button>

    </div>


    <!-- Error -->
    <div
        v-if="errorMessage"
        class="error-state"
    >
      {{ errorMessage }}
    </div>


    <!-- Filters -->
    <div class="filter-card">

      <div class="search-box">

        <input
            v-model="search"
            type="text"
            placeholder="Search supplier code, company, contact, email..."
        />

      </div>


      <select v-model="statusFilter">

        <option value="">
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
        Loading suppliers...
      </div>


      <!-- Empty -->
      <div
          v-else-if="!filteredSuppliers.length"
          class="empty-state"
      >
        No suppliers found.
      </div>


      <!-- Table -->
      <div
          v-else
          class="table-container"
      >

        <table>

          <thead>

          <tr>

            <th>
              Supplier Code
            </th>

            <th>
              Company Name
            </th>

            <th>
              Contact Person
            </th>

            <th>
              Email
            </th>

            <th>
              Phone
            </th>

            <th>
              Payment Terms
            </th>

            <th>
              Status
            </th>

            <th>
              Actions
            </th>

          </tr>

          </thead>


          <tbody>

          <tr
              v-for="supplier in filteredSuppliers"
              :key="supplier.id"
          >

            <!-- Code -->
            <td>

              <strong>
                {{ supplier.supplier_code }}
              </strong>

            </td>


            <!-- Company -->
            <td>
              {{ supplier.company_name }}
            </td>


            <!-- Contact -->
            <td>
              {{ supplier.contact_person || '-' }}
            </td>


            <!-- Email -->
            <td>
              {{ supplier.email || '-' }}
            </td>


            <!-- Phone -->
            <td>
              {{ supplier.phone || '-' }}
            </td>


            <!-- Payment Terms -->
            <td>
              {{ supplier.payment_terms || '-' }}
            </td>


            <!-- Status -->
            <td>

              <span
                  class="status-badge"
                  :class="supplier.is_active ? 'active' : 'inactive'"
              >
                {{ supplier.is_active ? 'Active' : 'Inactive' }}
              </span>

            </td>


            <!-- Actions -->
            <td>

              <div class="action-buttons">

                <!-- View -->
                <button
                    type="button"
                    class="action-button"
                    @click="viewSupplier(supplier.id)"
                >
                  View
                </button>


                <!-- Edit -->
                <button
                    v-if="
                      supplier.is_active &&
                      hasPermission('products.update')
                    "
                    type="button"
                    class="action-button edit"
                    @click="editSupplier(supplier.id)"
                >
                  Edit
                </button>


                <!-- Activate -->
                <button
                    v-if="
                      !supplier.is_active &&
                      hasPermission('products.update')
                    "
                    type="button"
                    class="action-button activate"
                    :disabled="isBusy('activate', supplier)"
                    @click="activateSupplier(supplier)"
                >
                  {{ isBusy('activate', supplier) ? 'Activating...' : 'Activate' }}
                </button>


                <!-- Deactivate -->
                <button
                    v-if="
                      supplier.is_active &&
                      hasPermission('products.delete')
                    "
                    type="button"
                    class="action-button delete"
                    :disabled="isBusy('deactivate', supplier)"
                    @click="deactivateSupplier(supplier)"
                >
                  {{ isBusy('deactivate', supplier) ? 'Deactivating...' : 'Deactivate' }}
                </button>

              </div>

            </td>

          </tr>

          </tbody>

        </table>

      </div>

    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import supplierApi from '../../api/supplierApi.js'
import { hasPermission } from '../../auth/authorization.js'

const router = useRouter()

const CREATE_ROUTE = '/admin/purchasing/suppliers/create'
const DETAIL_ROUTE = '/admin/purchasing/suppliers'

const suppliers = ref([])
const loading = ref(false)
const errorMessage = ref('')

const search = ref('')
const statusFilter = ref('')

const busyAction = ref(null)

const fetchSuppliers = async () => {
  loading.value = true
  errorMessage.value = ''

  try {
    const response = await supplierApi.getSuppliers()

    suppliers.value = response?.data || []
  } catch (error) {
    console.error('Failed to load suppliers:', error)

    errorMessage.value =
        error.response?.data?.message ||
        'Failed to load suppliers.'
  } finally {
    loading.value = false
  }
}

const filteredSuppliers = computed(() => {
  const searchText = search.value.trim().toLowerCase()

  return suppliers.value.filter(supplier => {

    const matchesSearch =
        !searchText ||
        supplier.supplier_code
            ?.toLowerCase()
            .includes(searchText) ||
        supplier.company_name
            ?.toLowerCase()
            .includes(searchText) ||
        supplier.contact_person
            ?.toLowerCase()
            .includes(searchText) ||
        supplier.email
            ?.toLowerCase()
            .includes(searchText)

    const matchesStatus =
        !statusFilter.value ||
        (statusFilter.value === 'active' && supplier.is_active) ||
        (statusFilter.value === 'inactive' && !supplier.is_active)

    return matchesSearch && matchesStatus
  })
})

const goToCreate = () => {
  router.push(CREATE_ROUTE)
}

const viewSupplier = (id) => {
  router.push(`${DETAIL_ROUTE}/${id}`)
}

const editSupplier = (id) => {
  router.push(`${DETAIL_ROUTE}/edit/${id}`)
}

const isBusy = (action, supplier) => {
  return busyAction.value === `${action}-${supplier.id}`
}

const deactivateSupplier = async (supplier) => {
  const confirmed = window.confirm(
      `Are you sure you want to deactivate ${supplier.company_name}?`
  )

  if (!confirmed) return

  busyAction.value = `deactivate-${supplier.id}`

  try {
    await supplierApi.deleteSupplier(supplier.id)

    supplier.is_active = false
  } catch (error) {
    console.error('Failed to deactivate supplier:', error)

    alert(
        error.response?.data?.message ||
        'Failed to deactivate supplier.'
    )
  } finally {
    busyAction.value = null
  }
}

const activateSupplier = async (supplier) => {
  const confirmed = window.confirm(
      `Activate ${supplier.company_name}?`
  )

  if (!confirmed) return

  busyAction.value = `activate-${supplier.id}`

  try {
    await supplierApi.updateSupplier(supplier.id, {
      is_active: true
    })

    supplier.is_active = true
  } catch (error) {
    console.error('Failed to activate supplier:', error)

    alert(
        error.response?.data?.message ||
        'Failed to activate supplier.'
    )
  } finally {
    busyAction.value = null
  }
}

onMounted(fetchSuppliers)
</script>

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

.action-button.activate:hover:not(:disabled) {
  background: var(--color-success-bg);
  border-color: var(--color-success-bg);
  color: var(--color-success);
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
  white-space: nowrap;
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

/* =========================
   Status Badge
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
