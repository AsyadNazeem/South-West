<script setup>
import { ref, computed, onMounted } from "vue"
import api from "../../api/axios"

const specifications = ref([])
const loading = ref(true)
const errorMessage = ref("")
const search = ref("")
const typeFilter = ref("all")
const statusFilter = ref("all")

const filteredSpecifications = computed(() => {
  const term = search.value.toLowerCase().trim()

  return specifications.value.filter((specification) => {
    const matchesSearch =
        !term ||
        `${specification.name || ""}`.toLowerCase().includes(term) ||
        `${specification.code || ""}`.toLowerCase().includes(term) ||
        `${specification.data_type || ""}`.toLowerCase().includes(term) ||
        `${specification.unit || ""}`.toLowerCase().includes(term)

    const matchesType =
        typeFilter.value === "all" ||
        `${specification.data_type || ""}`.toLowerCase() ===
        typeFilter.value.toLowerCase()

    const matchesStatus =
        statusFilter.value === "all" ||
        (statusFilter.value === "active" && specification.is_active) ||
        (statusFilter.value === "inactive" && !specification.is_active)

    return matchesSearch && matchesType && matchesStatus
  })
})

const loadSpecifications = async () => {
  try {
    loading.value = true
    errorMessage.value = ""

    const response = await api.get("/item-specifications")

    specifications.value = response.data.data || []
  } catch (error) {
    console.error("Specification loading error:", error)

    errorMessage.value =
        error.response?.data?.message ||
        "Failed to load item specifications."
  } finally {
    loading.value = false
  }
}

const deleteSpecification = async (id) => {
  if (
      !confirm(
          "Are you sure you want to delete this specification?"
      )
  ) {
    return
  }

  try {
    await api.delete(`/item-specifications/${id}`)

    await loadSpecifications()
  } catch (error) {
    console.error("Delete specification error:", error)

    alert(
        error.response?.data?.message ||
        "Failed to delete item specification."
    )
  }
}

const formatDataType = (type) => {
  if (!type) {
    return "-"
  }

  return type.charAt(0).toUpperCase() + type.slice(1)
}

onMounted(loadSpecifications)
</script>

<template>
  <div class="page-container">

    <!-- Header -->
    <div class="page-header">
      <div>
        <h1>Item Specifications</h1>

        <p>
          Manage specifications used to define product attributes.
        </p>
      </div>

      <router-link
          to="/admin/products/item-specifications/create"
          class="primary-button"
      >
        + Add Specification
      </router-link>
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

      <!-- Search -->
      <div class="search-box">
        <input
            v-model="search"
            type="text"
            placeholder="Search by name, code, type or unit..."
        />
      </div>

      <!-- Data Type -->
      <select v-model="typeFilter">
        <option value="all">
          All Data Types
        </option>

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

      <!-- Status -->
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
        Loading item specifications...
      </div>

      <!-- Empty -->
      <div
          v-else-if="!filteredSpecifications.length"
          class="empty-state"
      >
        No item specifications found.
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
            <th>Name</th>
            <th>Code</th>
            <th>Data Type</th>
            <th>Unit</th>
            <th>Required</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
          </thead>

          <tbody>

          <tr
              v-for="(specification,index) in filteredSpecifications"
              :key="specification.id"
          >
            <td>{{index+1}}</td>
            <!-- Name -->
            <td>
              <strong>
                {{ specification.name }}
              </strong>

              <div
                  v-if="specification.description"
                  class="description"
              >
                {{ specification.description }}
              </div>
            </td>

            <!-- Code -->
            <td>
              {{ specification.code }}
            </td>

            <!-- Data Type -->
            <td>
                <span
                    class="type-badge"
                    :class="specification.data_type"
                >
                  {{ formatDataType(specification.data_type) }}
                </span>
            </td>

            <!-- Unit -->
            <td>
              {{ specification.unit || "-" }}
            </td>

            <!-- Required -->
            <td>
                <span
                    class="required-badge"
                    :class="
                    specification.is_required
                      ? 'required'
                      : 'optional'
                  "
                >
                  {{
                    specification.is_required
                        ? "Required"
                        : "Optional"
                  }}
                </span>
            </td>

            <!-- Status -->
            <td>
                <span
                    class="status-badge"
                    :class="
                    specification.is_active
                      ? 'active'
                      : 'inactive'
                  "
                >
                  {{
                    specification.is_active
                        ? "Active"
                        : "Inactive"
                  }}
                </span>
            </td>

            <!-- Actions -->
            <td>

              <div class="action-buttons">

                <router-link
                    :to="`/admin/products/item-specifications/edit/${specification.id}`"
                    class="action-button edit"
                >
                  Edit
                </router-link>

                <button
                    class="action-button delete"
                    @click="
                      deleteSpecification(
                        specification.id
                      )
                    "
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

.action-button.edit:hover {
  background: var(--color-primary-light);
  border-color: var(--color-primary-light);
  color: var(--color-primary);
}

.action-button.delete:hover {
  background: var(--color-danger-bg);
  border-color: var(--color-danger-light);
  color: var(--color-danger);
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
  min-width: 160px;
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

.description {
  max-width: 260px;
  margin-top: 3px;
  font-size: var(--font-size-xs);
  line-height: 1.5;
  color: var(--color-text-muted);
}

/* =========================
   Badges
   ========================= */

.type-badge,
.required-badge,
.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  text-transform: capitalize;
  white-space: nowrap;
}

/* Data type */

.type-badge {
  background: var(--color-hover-bg);
  color: var(--color-text-secondary);
}

.type-badge.text {
  background: var(--color-info-bg);
  color: var(--color-info);
}

.type-badge.number,
.type-badge.decimal {
  background: var(--color-primary-light);
  color: var(--color-primary);
}

.type-badge.boolean {
  background: var(--color-success-bg);
  color: var(--color-success);
}

.type-badge.date {
  background: var(--color-warning-bg);
  color: var(--color-warning);
}

.type-badge.select {
  background: var(--color-submenu-active-bg);
  color: var(--color-accent);
}

/* Required */

.required-badge.required {
  background: var(--color-warning-bg);
  color: var(--color-warning);
}

.required-badge.optional {
  background: var(--color-hover-bg);
  color: var(--color-text-secondary);
}

/* Status */

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
