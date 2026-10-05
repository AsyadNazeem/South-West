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

            <th>#</th>

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

          <tr
              v-for="(price,index) in filteredPrices"
              :key="price.id"
          >

            <td>{{index+1}}</td>
            <!-- Product -->
            <td>

              <strong>
                {{ price.item?.item_name || "-" }}
              </strong>

            </td>


            <!-- Code -->
            <td>

              {{ price.item?.item_code || "-" }}

            </td>


            <!-- Price Type -->
            <td>

                                <span
                                    class="type-badge"
                                    :class="price.price_type?.toLowerCase()"
                                >
                                    {{ price.price_type || "-" }}
                                </span>

            </td>


            <!-- Price -->
            <td>

              <strong>
                {{ formatPrice(price.price) }}
              </strong>

            </td>


            <!-- Currency -->
            <td>

              {{ price.currency || "LKR" }}

            </td>


            <!-- Status -->
            <td>

                                <span
                                    class="status-badge"
                                    :class="
                                        price.is_active
                                            ? 'active'
                                            : 'inactive'
                                    "
                                >
                                    {{
                                    price.is_active
                                        ? "Active"
                                        : "Inactive"
                                  }}
                                </span>

            </td>


            <!-- Actions -->
            <td>

              <div class="action-buttons">

                <!-- Edit -->
                <router-link
                    :to="`/admin/products/item-prices/edit/${price.id}`"
                    class="action-button edit"
                >
                  Edit
                </router-link>


                <!-- Delete -->
                <button
                    class="action-button delete"
                    @click="deletePrice(price.id)"
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
</style>
