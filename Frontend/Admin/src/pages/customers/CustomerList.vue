<script setup>
import { ref, computed, onMounted } from "vue"
import api from "../../api/axios"

const searchQuery = ref("");
const statusFilter = ref("all");

const loading = ref(false);
const errorMessage = ref("");

const customers = ref([])

const formatDate = (date) => {
  if (!date) return "-"

  return new Date(date).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  })
}

const filteredCustomers = computed(() => {
  return customers.value.filter((customer) => {

    const fullName =
        `${customer.first_name} ${customer.last_name}`.toLowerCase();

    const search =
        searchQuery.value.toLowerCase().trim();

    const matchesSearch =
        !search ||
        fullName.includes(search) ||
        (customer.email || "").toLowerCase().includes(search) ||
        (customer.mobile || "").includes(search);

    const matchesStatus =
        statusFilter.value === "all" ||
        customer.status === statusFilter.value;

    return matchesSearch && matchesStatus;
  });
});

const loadCustomers = async () => {
  try {
    loading.value = true
    errorMessage.value = ""

    const response = await api.get("/customers")

    customers.value = response.data.data || []

  } catch (error) {
    console.error("Customer loading error:", error)

    errorMessage.value =
        error.response?.data?.message ||
        "Failed to load customers."

  } finally {
    loading.value = false
  }
}

const formatCurrency = (value) => {
  return `Rs. ${Number(value || 0).toLocaleString("en-US")}`;
};

const getCustomerName = (customer) => {
  return `${customer.first_name || ""} ${customer.last_name || ""}`.trim();
};

const deleteCustomer = async (id) => {
  if (!confirm("Are you sure you want to delete this customer?")) {
    return
  }

  try {
    await api.delete(`/customers/${id}`)

    await loadCustomers()
  } catch (error) {
    console.error("Delete customer error:", error)

    alert(
        error.response?.data?.message ||
        "Failed to delete customer."
    )
  }
}

onMounted(loadCustomers)
</script>

<template>
  <div class="customers-page">

    <!-- Page Header -->
    <div class="page-header">

      <div>
        <h1>Customers</h1>

        <p>
          Manage your customers and their account information.
        </p>
      </div>

      <router-link
          to="/admin/customers/create"
          class="primary-button"
      >
        + Add Customer
      </router-link>

    </div>


    <!-- Error -->
    <div
        v-if="errorMessage"
        class="error-state"
    >
      {{ errorMessage }}
    </div>


    <!-- Customer Card -->
    <div class="dashboard-card customers-card">

      <!-- Toolbar -->
      <div class="customers-toolbar">

        <div class="search-box">

          <input
              v-model="searchQuery"
              type="text"
              placeholder="Search customers..."
          />

        </div>


        <div class="filter-box">

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

      </div>


      <!-- Loading -->
      <div
          v-if="loading"
          class="empty-state"
      >
        Loading customers...
      </div>


      <!-- Empty -->
      <div
          v-else-if="!filteredCustomers.length"
          class="empty-state"
      >
        No customers found.
      </div>


      <!-- Table -->
      <div
          v-else
          class="table-container"
      >

        <table>

          <thead>

          <tr>

            <th>Customer</th>

            <th>Email</th>

            <th>Mobile</th>

            <th>Orders</th>

            <th>Total Spent</th>

            <th>Status</th>

            <th>Created</th>

            <th>Action</th>

          </tr>

          </thead>


          <tbody>

          <tr
              v-for="customer in filteredCustomers"
              :key="customer.id"
          >

            <!-- Customer -->
            <td>

              <div class="customer-cell">

                <div class="customer-avatar">
                  {{ customer.first_name?.charAt(0) }}
                </div>

                <div>

                  <strong>
                    {{ getCustomerName(customer) }}
                  </strong>

                  <span>
                                            #{{ customer.id }}
                                        </span>

                </div>

              </div>

            </td>


            <!-- Email -->
            <td>
              {{ customer.email }}
            </td>


            <!-- Mobile -->
            <td>
              {{ customer.mobile }}
            </td>


            <!-- Orders -->
            <td>
              {{ customer.orders }}
            </td>


            <!-- Total Spent -->
            <td>
              {{ formatCurrency(customer.total_spent) }}
            </td>


            <!-- Status -->
            <td>

                                <span
                                    class="status"
                                    :class="customer.status"
                                >
                                    {{ customer.status }}
                                </span>

            </td>


            <!-- Created -->
            <td>
              {{ customer.created_at }}
            </td>


            <!-- Action -->
            <td>

              <router-link
                  :to="`/admin/customers/view/${customer.id}`"
                  class="action-button"
              >
                View
              </router-link>

              <router-link
                  :to="`/admin/customers/edit/${customer.id}`"
                  class="action-button"
              >
                Edit
              </router-link>
              <button
                  class="action-button delete"
                  @click="deleteCustomer(customer.id)"
              >
                Delete
              </button>
            </td>

          </tr>

          </tbody>

        </table>

      </div>

    </div>

  </div>
</template>

<style scoped>
.customers-page {
  width: 100%;
  font-family: var(--font-family),serif;
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
  gap: var(--spacing-sm);
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

.action-button {
  display: inline-flex;
  align-items: center;
  padding: 6px var(--spacing-md);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  text-decoration: none;
  transition: background var(--transition-fast),
  color var(--transition-fast);
}

.action-button:hover {
  background: var(--color-hover-bg);
  color: var(--color-text-primary);
}

/* =========================
   Card
   ========================= */

.dashboard-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}

.customers-card {
  margin-top: var(--spacing-2xl);
}

/* =========================
   Toolbar
   ========================= */

.customers-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-lg);
  padding: var(--spacing-xl);
  border-bottom: 1px solid var(--color-border-light);
}

.search-box {
  flex: 1;
  max-width: 420px;
}

.search-box input,
.filter-box select {
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

.filter-box select {
  min-width: 150px;
  padding: 0 var(--spacing-md);
  color: var(--color-text-secondary);
  cursor: pointer;
}

.search-box input:focus,
.filter-box select:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-light);
}

/* =========================
   Table
   ========================= */

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
   Customer Cell
   ========================= */

.customer-cell {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.customer-avatar {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full);
  background: var(--color-primary-light);
  color: var(--color-primary);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
}

.customer-cell strong {
  display: block;
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.customer-cell span {
  display: block;
  margin-top: 3px;
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

/* =========================
   Status Badge
   ========================= */

.status {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  text-transform: capitalize;
}

.status.active {
  background: var(--color-success-bg);
  color: var(--color-success);
}

.status.inactive {
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

@media (max-width: 700px) {
  .page-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .customers-toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .search-box {
    max-width: none;
  }

  .filter-box select {
    width: 100%;
  }
}
</style>
