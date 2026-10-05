<script setup>
import { ref, computed, onMounted } from "vue"
import api from "../../api/axios"

const items = ref([])
const loading = ref(true)
const errorMessage = ref("")
const search = ref("")
const statusFilter = ref("all")
const conditionFilter = ref("all")

const filteredItems = computed(() => {
  const term = search.value.toLowerCase().trim()

  return items.value.filter((item) => {
    const matchesSearch =
        !term ||
        `${item.item_code || ""}`.toLowerCase().includes(term) ||
        `${item.item_name || ""}`.toLowerCase().includes(term) ||
        `${item.category?.name || ""}`.toLowerCase().includes(term) ||
        `${item.brand?.name || ""}`.toLowerCase().includes(term)

    const matchesStatus =
        statusFilter.value === "all" ||
        (statusFilter.value === "active" && item.is_active) ||
        (statusFilter.value === "inactive" && !item.is_active)

    const matchesCondition =
        conditionFilter.value === "all" ||
        `${item.condition || ""}`.toLowerCase() ===
        conditionFilter.value

    return (
        matchesSearch &&
        matchesStatus &&
        matchesCondition
    )
  })
})

const loadItems = async () => {
  try {
    loading.value = true
    errorMessage.value = ""

    const response = await api.get("/items")

    items.value = response.data.data || []

  } catch (error) {
    console.error("Item loading error:", error)

    errorMessage.value =
        error.response?.data?.message ||
        "Failed to load items."
  } finally {
    loading.value = false
  }
}

const toggleStatus = async (item) => {
  const makeActive = !item.is_active

  console.log("Changing item status:", {
    id: item.id,
    currentStatus: item.is_active,
    newStatus: makeActive
  })

  try {
    await api.put(`/items/${item.id}`, {
      is_active: makeActive
    })

    await loadItems()

  } catch (error) {
    console.error("Status update error:", error)

    alert(
        error.response?.data?.message ||
        "Failed to update item status."
    )
  }
}

const deleteItem = async (id) => {
  if (!confirm("Are you sure you want to delete this item?")) {
    return
  }

  try {
    await api.delete(`/items/${id}`)

    await loadItems()

  } catch (error) {
    console.error("Delete item error:", error)

    alert(
        error.response?.data?.message ||
        "Failed to delete item."
    )
  }
}

onMounted(loadItems)
</script>

<template>
  <div class="page-container">

    <!-- Header -->
    <div class="page-header">

      <div>
        <h1>Items</h1>

        <p>
          Manage products and items available in the system.
        </p>
      </div>

      <router-link
          to="/admin/products/items/create"
          class="primary-button"
      >
        + Add Item
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
            placeholder="Search by item code, name, category, brand..."
        />

      </div>

      <!-- Condition -->
      <select v-model="conditionFilter">

        <option value="all">
          All Conditions
        </option>

        <option value="new">
          New
        </option>

        <option value="used">
          Used
        </option>

        <option value="refurbished">
          Refurbished
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
        Loading items...
      </div>

      <!-- Empty -->
      <div
          v-else-if="!filteredItems.length"
          class="empty-state"
      >
        No items found.
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
            <th>Item Code</th>
            <th>Item Name</th>
            <th>Category</th>
            <th>Brand</th>
            <th>Condition</th>
            <th>Serialized</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>

          </thead>

          <tbody>

          <tr
              v-for="(item, index) in filteredItems"
              :key="item.id"
          >

            <td>
              {{ index + 1 }}
            </td>

            <!-- Item Code -->
            <td>
              <strong>
                {{ item.item_code }}
              </strong>
            </td>

            <!-- Item Name -->
            <td>
              {{ item.item_name }}
            </td>

            <!-- Category -->
            <td>
              {{ item.category?.name || "-" }}
            </td>

            <!-- Brand -->
            <td>
              {{ item.brand?.name || "-" }}
            </td>

            <!-- Condition -->
            <td>

                <span
                    class="condition-badge"
                    :class="item.condition?.toLowerCase()"
                >
                  {{ item.condition || "-" }}
                </span>

            </td>

            <!-- Serialized -->
            <td>

                <span
                    class="serialized-badge"
                    :class="item.is_serialized ? 'yes' : 'no'"
                >
                  {{ item.is_serialized ? "Yes" : "No" }}
                </span>

            </td>

            <!-- Status -->
            <td>

                <span
                    class="status-badge"
                    :class="item.is_active ? 'active' : 'inactive'"
                >
                  {{ item.is_active ? "Active" : "Inactive" }}
                </span>

            </td>

            <!-- Actions -->
            <td>

              <div class="action-buttons">

                <router-link
                    :to="`/admin/products/items/view/${item.id}`"
                    class="action-button"
                >
                  View
                </router-link>

                <router-link
                    :to="`/admin/products/items/edit/${item.id}`"
                    class="action-button edit"
                >
                  Edit
                </router-link>

                <button
                    type="button"
                    class="action-button"
                    @click="toggleStatus(item)"
                >
                  {{
                    item.is_active
                        ? "Deactivate"
                        : "Activate"
                  }}
                </button>

                <button
                    class="action-button delete"
                    @click="deleteItem(item.id)"
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

.action-button:hover {
  background: var(--color-hover-bg);
  color: var(--color-text-primary);
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

/* =========================
   Badges
   ========================= */

.condition-badge,
.serialized-badge,
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

/* Condition */

.condition-badge {
  background: var(--color-hover-bg);
  color: var(--color-text-secondary);
}

.condition-badge.new {
  background: var(--color-success-bg);
  color: var(--color-success);
}

.condition-badge.used {
  background: var(--color-warning-bg);
  color: var(--color-warning);
}

.condition-badge.refurbished {
  background: var(--color-info-bg);
  color: var(--color-info);
}

/* Serialized */

.serialized-badge.yes {
  background: var(--color-primary-light);
  color: var(--color-primary);
}

.serialized-badge.no {
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
