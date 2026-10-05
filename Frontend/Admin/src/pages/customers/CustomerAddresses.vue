<script setup>
import { ref, computed, onMounted } from "vue"
import api from "../../api/axios"

const addresses = ref([])
const loading = ref(true)
const errorMessage = ref("")
const search = ref("")
const typeFilter = ref("all")

const filteredAddresses = computed(() => {
  const term = search.value.toLowerCase().trim()

  return addresses.value.filter((address) => {
    const matchesSearch =
        !term ||
        `${address.recipient_name || ""}`.toLowerCase().includes(term) ||
        `${address.customer_name || ""}`.toLowerCase().includes(term) ||
        `${address.city || ""}`.toLowerCase().includes(term) ||
        `${address.postal_code || ""}`.toLowerCase().includes(term)

    const matchesType =
        typeFilter.value === "all" ||
        address.address_type?.toLowerCase() === typeFilter.value

    return matchesSearch && matchesType
  })
})

const loadAddresses = async () => {
  try {
    loading.value = true
    errorMessage.value = ""

    const response = await api.get("/customer-addresses")

    addresses.value = response.data.data || []
  } catch (error) {
    console.error("Address loading error:", error)

    errorMessage.value =
        error.response?.data?.message ||
        "Failed to load addresses."
  } finally {
    loading.value = false
  }
}

const deleteAddress = async (id) => {
  if (!confirm("Are you sure you want to delete this address?")) {
    return
  }

  try {
    await api.delete(`/customer-addresses/${id}`)

    await loadAddresses()
  } catch (error) {
    console.error("Delete address error:", error)

    alert(
        error.response?.data?.message ||
        "Failed to delete address."
    )
  }
}

const formatAddress = (address) => {
  return [
    address.address_line_1,
    address.address_line_2,
    address.city,
    address.province,
    address.postal_code,
    address.country
  ]
      .filter(Boolean)
      .join(", ")
}

onMounted(loadAddresses)
</script>

<template>
  <div class="page-container">

    <!-- Header -->
    <div class="page-header">
      <div>
        <h1>Customer Addresses</h1>
        <p>
          Manage customer shipping and billing addresses.
        </p>
      </div>

      <router-link
          to="/admin/customers/addresses/create"
          class="primary-button"
      >
        + Add Address
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

      <div class="search-box">
        <input
            v-model="search"
            type="text"
            placeholder="Search by customer, recipient, city..."
        />
      </div>

      <select v-model="typeFilter">
        <option value="all">
          All Types
        </option>

        <option value="shipping">
          Shipping
        </option>

        <option value="billing">
          Billing
        </option>
      </select>

    </div>

    <!-- Table -->
    <div class="table-card">

      <div
          v-if="loading"
          class="empty-state"
      >
        Loading addresses...
      </div>

      <div
          v-else-if="!filteredAddresses.length"
          class="empty-state"
      >
        No addresses found.
      </div>

      <div
          v-else
          class="table-container"
      >
        <table>

          <thead>
          <tr>
            <th>Customer</th>
            <th>Recipient</th>
            <th>Type</th>
            <th>Address</th>
            <th>Phone</th>
            <th>Default</th>
            <th>Actions</th>
          </tr>
          </thead>

          <tbody>

          <tr
              v-for="address in filteredAddresses"
              :key="address.id"
          >

            <!-- Customer -->
            <td>
              <strong>
                {{ address.customer_name || "Guest" }}
              </strong>
            </td>

            <!-- Recipient -->
            <td>
              {{ address.recipient_name }}
            </td>

            <!-- Type -->
            <td>
                <span
                    class="type-badge"
                    :class="
                    address.address_type?.toLowerCase()
                  "
                >
                  {{ address.address_type }}
                </span>
            </td>

            <!-- Address -->
            <td class="address-column">
              {{ formatAddress(address) }}
            </td>

            <!-- Phone -->
            <td>
              {{ address.phone || "-" }}
            </td>

            <!-- Default -->
            <td>

              <div class="default-badges">

                  <span
                      v-if="address.is_default_shipping"
                      class="default-badge"
                  >
                    Shipping
                  </span>

                <span
                    v-if="address.is_default_billing"
                    class="default-badge"
                >
                    Billing
                  </span>

                <span
                    v-if="
                      !address.is_default_shipping &&
                      !address.is_default_billing
                    "
                >
                    -
                  </span>

              </div>

            </td>

            <!-- Actions -->
            <td>

              <div class="action-buttons">

                <router-link
                    :to="`/admin/customers/${address.customer_id}/addresses/${address.id}/edit`"
                    class="action-button edit"
                >
                  Edit
                </router-link>

                <button
                    class="action-button delete"
                    @click="deleteAddress(address.id)"
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
  justify-content: space-between;
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

.address-column {
  min-width: 260px;
  max-width: 360px;
  line-height: 1.5;
}

/* =========================
   Badges
   ========================= */

.type-badge,
.default-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  text-transform: capitalize;
  white-space: nowrap;
}

.type-badge.shipping {
  background: var(--color-info-bg);
  color: var(--color-info);
}

.type-badge.billing {
  background: var(--color-warning-bg);
  color: var(--color-warning);
}

.default-badges {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
}

.default-badge {
  background: var(--color-success-bg);
  color: var(--color-success);
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

@media (max-width: 700px) {
  .page-header,
  .filter-card {
    flex-direction: column;
    align-items: stretch;
  }

  .search-box {
    max-width: none;
  }

  .filter-card select {
    width: 100%;
  }
}
</style>
