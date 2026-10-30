<script setup>
import { ref, computed, onMounted } from "vue"
import api from "../../api/axios"

const prices = ref([])
const loading = ref(true)
const errorMessage = ref("")

const search = ref("")
const typeFilter = ref("all")
const statusFilter = ref("all")

// Filter prices
const filteredPrices = computed(() => {
  const term = search.value.toLowerCase().trim()

  return prices.value.filter((price) => {
    const itemName = price.item?.item_name || ""
    const itemCode = price.item?.item_code || ""
    const priceType = price.price_type || ""

    const matchesSearch =
        !term ||
        itemName.toLowerCase().includes(term) ||
        itemCode.toLowerCase().includes(term) ||
        priceType.toLowerCase().includes(term)

    const matchesType =
        typeFilter.value === "all" ||
        priceType.toLowerCase() === typeFilter.value.toLowerCase()

    const matchesStatus =
        statusFilter.value === "all" ||
        (statusFilter.value === "active" && price.is_active) ||
        (statusFilter.value === "inactive" && !price.is_active)

    return matchesSearch && matchesType && matchesStatus
  })
})

// Group filtered price records by item.
const groupedPrices = computed(() => {
  const groups = new Map()

  for (const price of filteredPrices.value) {
    const itemId = price.item_id ?? price.item?.id
    const key = itemId != null
      ? String(itemId)
      : `unknown-${price.item?.item_code || price.item?.item_name || price.id}`

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        itemId,
        itemName: price.item?.item_name || "Unknown item",
        itemCode: price.item?.item_code || "-",
        prices: []
      })
    }

    groups.get(key).prices.push(price)
  }

  return Array.from(groups.values())
})

const expandedGroups = ref({})

const isGroupExpanded = (key) => expandedGroups.value[key] !== false

const toggleGroup = (key) => {
  expandedGroups.value[key] = !isGroupExpanded(key)
}

// Load prices
const loadPrices = async () => {
  try {
    loading.value = true
    errorMessage.value = ""

    const response = await api.get("/item-prices")

    prices.value = response.data.data || []
  } catch (error) {
    console.error("Product price loading error:", error)

    errorMessage.value =
        error.response?.data?.message ||
        "Failed to load product prices."
  } finally {
    loading.value = false
  }
}

// Delete price
const deletePrice = async (id) => {
  if (!confirm("Are you sure you want to delete this price?")) {
    return
  }

  try {
    await api.delete(`/item-prices/${id}`)

    await loadPrices()
  } catch (error) {
    console.error("Delete price error:", error)

    alert(
        error.response?.data?.message ||
        "Failed to delete product price."
    )
  }
}

// Format price
const formatPrice = (price) => {
  if (
      price === null ||
      price === undefined ||
      price === ""
  ) {
    return "-"
  }

  return Number(price).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

// Load data when page opens
onMounted(loadPrices)
</script>


<template>

  <div class="page-container">

    <!-- Header -->
    <div class="page-header">

      <div>
        <h1>Product Prices</h1>

        <p>
          Manage product selling prices and pricing information.
        </p>
      </div>

      <router-link
          to="/admin/products/item-prices/create"
          class="primary-button"
      >
        + Add Price
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
            placeholder="Search by product, code or price type..."
        />

      </div>


      <!-- Price Type -->
      <select v-model="typeFilter">

        <option value="all">
          All Price Types
        </option>

        <option value="selling">
          Selling
        </option>

        <option value="retail">
          Retail
        </option>

        <option value="wholesale">
          Wholesale
        </option>

        <option value="cost">
          Cost
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
        Loading product prices...
      </div>


      <!-- Empty -->
      <div
          v-else-if="!filteredPrices.length"
          class="empty-state"
      >
        No product prices found.
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
              Product
            </th>

            <th>
              Code
            </th>

            <th>
              Price Type
            </th>

            <th>
              Price
            </th>

            <th>
              Currency
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
          <template v-for="group in groupedPrices" :key="group.key">
            <tr class="item-group-row">
              <td colspan="7">
                <div class="group-heading-row">
<button
                  type="button"
                  class="group-toggle"
                  :aria-expanded="isGroupExpanded(group.key)"
                  @click="toggleGroup(group.key)"
                >
                  <span
                    class="group-chevron"
                    :class="{ expanded: isGroupExpanded(group.key) }"
                  >&#9656;</span>

                  <span class="group-item-details">
                    <strong>{{ group.itemName }}</strong>
                    <span class="group-item-code">Code: {{ group.itemCode }}</span>
                  </span>

                  <span class="group-count">
                    {{ group.prices.length }}
                    {{ group.prices.length === 1 ? 'price' : 'prices' }}
                  </span>
                </button>
                <router-link
                  v-if="group.itemId"
                  class="action-button edit group-edit-all"
                  :to="`/admin/products/item-prices/edit-all/${group.itemId}`"
                >
                  Edit All
                </router-link>
                </div>
              </td>
            </tr>

            <template v-if="isGroupExpanded(group.key)">
              <tr
                v-for="(price, index) in group.prices"
                :key="price.id"
                class="item-price-row"
              >
                <td>{{ index + 1 }}</td>

                <td>
                  <strong>{{ price.item?.item_name || '-' }}</strong>
                </td>

                <td>
                  <strong>
                    {{ price.variant?.variant_sku || price.item?.item_code || '-' }}
                  </strong>
                </td>

                <td>
                  <span
                    class="type-badge"
                    :class="price.price_type?.toLowerCase()"
                  >
                    {{ price.price_type || '-' }}
                  </span>
                </td>

                <td>
                  <strong>{{ formatPrice(price.price) }}</strong>
                </td>

                <td>{{ price.currency || 'LKR' }}</td>

                <td>
                  <span
                    class="status-badge"
                    :class="price.is_active ? 'active' : 'inactive'"
                  >
                    {{ price.is_active ? 'Active' : 'Inactive' }}
                  </span>
                </td>

                <td>
                  <div class="action-buttons">
                    <router-link
                      :to="`/admin/products/item-prices/edit/${price.id}`"
                      class="action-button edit"
                    >
                      Edit
                    </router-link>

                    <button
                      type="button"
                      class="action-button delete"
                      @click="deletePrice(price.id)"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            </template>
          </template>
        </tbody>

        </table>

      </div>

    </div>

  </div>

</template>


<style scoped>
.group-heading-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.group-edit-all {
  flex-shrink: 0;
  margin-right: 12px;
}


.bulk-edit-table-wrap {
  width: 100%;
  overflow-x: auto;
}

.bulk-edit-table {
  min-width: 1050px;
}

.bulk-edit-table input:not([type="checkbox"]),
.bulk-edit-table select {
  width: 130px;
  min-width: 100px;
  height: 38px;
  padding: 0 8px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text-primary);
  font: inherit;
}

.bulk-edit-table td small {
  display: block;
  margin-top: 5px;
  color: var(--color-text-secondary);
}

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
   Item Groups
   ========================= */

.item-group-row td {
  padding: 0;
  background: var(--color-hover-bg);
  border-bottom: 1px solid var(--color-border-light);
}

.group-toggle {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 14px var(--spacing-lg);
  border: 0;
  background: transparent;
  color: var(--color-text-primary);
  text-align: left;
  font: inherit;
  cursor: pointer;
}

.group-toggle:hover {
  background: var(--color-surface-hover);
}

.group-chevron {
  display: inline-block;
  font-size: 20px;
  transition: transform var(--transition-fast);
}

.group-chevron.expanded {
  transform: rotate(90deg);
}

.group-item-details {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.group-item-code {
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
}

.group-count {
  padding: 4px 10px;
  border-radius: var(--radius-full);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  white-space: nowrap;
}

.item-price-row td:first-child {
  padding-left: 42px;
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

.type-badge,
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

.type-badge {
  background: var(--color-hover-bg);
  color: var(--color-text-secondary);
}

.type-badge.retail {
  background: var(--color-info-bg);
  color: var(--color-info);
}

.type-badge.wholesale {
  background: var(--color-primary-light);
  color: var(--color-primary);
}

.type-badge.cost {
  background: var(--color-warning-bg);
  color: var(--color-warning);
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

/* Bulk price editor */
.bulk-toolbar,
.bulk-editor-heading,
.bulk-toolbar-actions,
.bulk-editor-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
}

.bulk-toolbar,
.bulk-editor-card {
  margin-bottom: var(--spacing-lg);
  padding: var(--spacing-lg);
  background: var(--color-surface);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.bulk-editor-heading {
  margin-bottom: var(--spacing-lg);
}

.bulk-editor-heading h2 {
  font-size: var(--font-size-lg);
  color: var(--color-text-primary);
}

.bulk-editor-heading p {
  margin-top: 5px;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.bulk-fields-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--spacing-lg);
}

.bulk-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  color: var(--color-text-primary);
  font-size: var(--font-size-sm);
}

.bulk-field > span {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: var(--font-weight-semibold);
}

.bulk-field input:not([type="checkbox"]),
.bulk-field select {
  width: 100%;
  min-width: 0;
  height: 40px;
  padding: 0 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text-primary);
  font: inherit;
}

.bulk-field input:disabled,
.bulk-field select:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.bulk-editor-actions {
  justify-content: flex-end;
  margin-top: var(--spacing-lg);
}

.bulk-message {
  margin-bottom: var(--spacing-md);
  padding: var(--spacing-md);
  border-radius: var(--radius-md);
}

.success-message {
  color: var(--color-text-primary);
  background: var(--color-hover-bg);
}

.group-heading-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.group-heading-row > input,
.price-row-selection > input {
  flex: 0 0 auto;
}

.price-row-selection {
  display: flex;
  align-items: center;
  gap: 10px;
}

@media (max-width: 800px) {
  .bulk-fields-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 520px) {
  .bulk-fields-grid {
    grid-template-columns: 1fr;
  }

  .bulk-toolbar,
  .bulk-editor-heading {
    align-items: flex-start;
    flex-direction: column;
  }
}

</style>
