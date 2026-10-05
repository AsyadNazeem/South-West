<template>
  <div class="dashboard">
    <!-- Page Header -->
    <div class="page-header">
      <div>
        <h1>Dashboard</h1>
        <p>Overview of your South West e-commerce system.</p>
      </div>

      <div class="header-date">
        {{ today }}
      </div>
    </div>

    <!-- Error -->
    <div v-if="errorMessage" class="error-state">
      {{ errorMessage }}
    </div>

    <!-- Statistics -->
    <section class="stats-grid">
      <div
          v-for="stat in statCards"
          :key="stat.title"
          class="stat-card"
      >
        <div class="stat-card-header">
          <span>{{ stat.title }}</span>

          <div class="stat-icon">
            {{ stat.title.charAt(6) }}
          </div>
        </div>

        <div class="stat-value">
          {{ loading ? "..." : stat.value }}
        </div>
      </div>
    </section>

    <!-- Main Dashboard Grid -->
    <section class="dashboard-grid">

      <!-- Sales Overview -->
      <div class="dashboard-card sales-card">
        <div class="card-header">
          <div>
            <h2>Sales Overview</h2>
            <p>Sales performance over the {{ periodLabels[period] }}</p>
          </div>

          <select
              v-model="period"
              class="period-select"
              @change="loadDashboard"
          >
            <option value="7m">Last 7 months</option>
            <option value="30d">Last 30 days</option>
            <option value="12m">Last 12 months</option>
          </select>
        </div>

        <div v-if="!salesChart.length" class="empty-state">
          {{ loading ? "Loading..." : "No sales data available." }}
        </div>

        <div v-else class="chart">
          <div class="chart-y-axis">
            <span v-for="label in yAxisLabels" :key="label">
              {{ label }}
            </span>
          </div>

          <div class="chart-area">
            <div class="chart-grid-line"></div>
            <div class="chart-grid-line"></div>
            <div class="chart-grid-line"></div>
            <div class="chart-grid-line"></div>
            <div class="chart-grid-line"></div>

            <div class="bars">
              <div
                  v-for="item in salesChart"
                  :key="item.label"
                  class="bar-container"
              >
                <div
                    class="bar"
                    :style="{ height: barHeight(item.value) }"
                    :title="formatCurrency(item.value)"
                ></div>
                <span>{{ item.label }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Low Stock -->
      <div class="dashboard-card">
        <div class="card-header">
          <div>
            <h2>Low Stock</h2>
            <p>Items that need attention</p>
          </div>

          <router-link to="/inventory/stock" class="text-button">
            View all
          </router-link>
        </div>

        <div v-if="!lowStockItems.length" class="empty-state">
          {{ loading ? "Loading..." : "No low stock items." }}
        </div>

        <div v-else class="stock-list">
          <div
              v-for="item in lowStockItems"
              :key="item.code"
              class="stock-item"
          >
            <div class="stock-info">
              <strong>{{ item.name }}</strong>
              <span>{{ item.code }}</span>
            </div>

            <div class="stock-count">
              {{ item.stock }}
              <small>left</small>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Bottom Grid -->
    <section class="bottom-grid">

      <!-- Recent Orders -->
      <div class="dashboard-card orders-card">
        <div class="card-header">
          <div>
            <h2>Recent Orders</h2>
            <p>Latest orders placed by customers</p>
          </div>

          <router-link to="/orders" class="text-button">
            View all
          </router-link>
        </div>

        <div v-if="!recentOrders.length" class="empty-state">
          {{ loading ? "Loading..." : "No orders available yet." }}
        </div>

        <div v-else class="table-container">
          <table>
            <thead>
            <tr>
              <th>Order</th>
              <th>Customer</th>
              <th>Date</th>
              <th>Amount</th>
              <th>Status</th>
            </tr>
            </thead>

            <tbody>
            <tr
                v-for="order in recentOrders"
                :key="order.order"
            >
              <td>
                <strong>{{ order.order }}</strong>
              </td>

              <td>{{ order.customer }}</td>

              <td>{{ order.date }}</td>

              <td>{{ formatCurrency(order.amount) }}</td>

              <td>
                <span
                    class="status"
                    :class="order.status?.toLowerCase()"
                >
                  {{ order.status }}
                </span>
              </td>
            </tr>
            </tbody>
          </table>
        </div>
      </div>

    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue"
import api from "../../api/axios"

const stats = ref({
  totalCustomers: 0,
  totalProducts: 0,
  totalOrders: 0,
  totalSales: 0
})

const recentOrders = ref([])
const lowStockItems = ref([])
const salesChart = ref([])

const period = ref("7m")
const loading = ref(true)
const errorMessage = ref("")

const periodLabels = {
  "7m": "last 7 months",
  "30d": "last 30 days",
  "12m": "last 12 months"
}

const today = new Date().toLocaleDateString("en-GB", {
  day: "2-digit",
  month: "long",
  year: "numeric"
})

const formatNumber = (value) => {
  return Number(value || 0).toLocaleString("en-US")
}

const formatCurrency = (value) => {
  const number = Number(value)

  if (Number.isNaN(number)) {
    return value
  }

  return `Rs. ${number.toLocaleString("en-US")}`
}

const formatCompact = (value) => {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1).replace(/\.0$/, "")}M`
  }

  if (value >= 1000) {
    return `${(value / 1000).toFixed(1).replace(/\.0$/, "")}K`
  }

  return String(Math.round(value))
}

const statCards = computed(() => [
  {
    title: "Total Customers",
    value: formatNumber(stats.value.totalCustomers)
  },
  {
    title: "Total Products",
    value: formatNumber(stats.value.totalProducts)
  },
  {
    title: "Total Orders",
    value: formatNumber(stats.value.totalOrders)
  },
  {
    title: "Total Sales",
    value: formatCurrency(stats.value.totalSales)
  }
])

const chartMax = computed(() => {
  const max = Math.max(
      0,
      ...salesChart.value.map((item) => Number(item.value) || 0)
  )

  if (!max) {
    return 100
  }

  const step = Math.pow(10, Math.floor(Math.log10(max)))

  return Math.ceil(max / step) * step
})

const yAxisLabels = computed(() =>
    Array.from({ length: 6 }, (_, i) =>
        formatCompact(chartMax.value - (chartMax.value / 5) * i)
    )
)

const barHeight = (value) => {
  return `${((Number(value) || 0) / chartMax.value) * 100}%`
}

const loadDashboard = async () => {
  try {
    loading.value = true
    errorMessage.value = ""

    const response = await api.get("/dashboard", {
      params: {
        period: period.value
      }
    })

    const data = response.data.data

    stats.value = data.stats ?? {
      totalCustomers: 0,
      totalProducts: 0,
      totalOrders: 0,
      totalSales: 0
    }

    salesChart.value = data.salesChart ?? []
    recentOrders.value = data.recentOrders ?? []
    lowStockItems.value = data.lowStockItems ?? []
  } catch (error) {
    console.error("Dashboard loading error:", error)

    errorMessage.value =
        error.response?.data?.message ||
        "Failed to load dashboard data."
  } finally {
    loading.value = false
  }
}

onMounted(loadDashboard)
</script>

<style scoped>
.dashboard {
  width: 100%;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.page-header h1 {
  font-size: 26px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.page-header p {
  margin-top: 5px;
  font-size: 14px;
  color: var(--color-text-secondary);
}

.header-date {
  font-size: 13px;
  color: var(--color-text-secondary);
}

/* Statistics */

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 20px;
}

.stat-card {
  padding: 20px;
  background: var(--color-surface);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
}

.stat-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;

  font-size: 13px;
  color: var(--color-text-secondary);
}

.stat-icon {
  width: 34px;
  height: 34px;

  display: flex;
  align-items: center;
  justify-content: center;

  border-radius: var(--radius-sm);

  background: var(--color-hover-bg);
  color: var(--color-text-primary);

  font-size: 13px;
  font-weight: 700;
}

.stat-value {
  margin-top: 14px;

  font-size: 25px;
  font-weight: 700;

  color: var(--color-text-primary);
}

.stat-footer {
  display: flex;
  gap: 7px;

  margin-top: 10px;

  font-size: 12px;
}

.stat-change {
  font-weight: 600;
  color: var(--color-success);
}

.stat-description {
  color: var(--color-text-muted);
}

/* Cards */

.dashboard-grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 16px;

  margin-bottom: 16px;
}

.dashboard-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;

  margin-bottom: 20px;
}

.card-header h2 {
  font-size: 16px;
  font-weight: 650;
  color: var(--color-text-primary);
}

.card-header p {
  margin-top: 4px;

  font-size: 12px;
  color: var(--color-text-secondary);
}

.period-select {
  padding: 7px 10px;

  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-sm);

  background: var(--color-surface);
  color: var(--color-text-secondary);

  font-size: 12px;
}

/* Chart */

.chart {
  display: flex;
  height: 280px;
}

.chart-y-axis {
  width: 45px;

  display: flex;
  flex-direction: column;
  justify-content: space-between;

  padding-bottom: 26px;

  font-size: 10px;
  color: var(--color-text-muted);
}

.chart-area {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.chart-grid-line {
  position: relative;
  height: 20%;
  border-top: 1px solid var(--color-border-light);
}

.bars {
  position: absolute;
  inset: 0;

  display: flex;
  align-items: flex-end;
  justify-content: space-around;

  padding-top: 10px;
}

.bar-container {
  height: 100%;
  width: 9%;

  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
}

.bar {
  width: 100%;
  min-height: 8px;

  background: var(--color-primary);

  border-radius: var(--radius-sm) var(--radius-sm) 0 0;

  transition: opacity var(--transition-fast);
}

.bar:hover {
  opacity: 0.7;
}

.bar-container span {
  font-size: 10px;
  color: var(--color-text-muted);
}

/* Low Stock */

.stock-list {
  display: flex;
  flex-direction: column;
}

.stock-item {
  display: flex;
  align-items: center;
  justify-content: space-between;

  padding: 13px 0;

  border-bottom: 1px solid var(--color-border-light);
}

.stock-item:last-child {
  border-bottom: none;
}

.stock-info {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.stock-info strong {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.stock-info span {
  font-size: 11px;
  color: var(--color-text-muted);
}

.stock-count {
  font-size: 16px;
  font-weight: 700;
  color: var(--color-danger);
}

.stock-count small {
  font-size: 10px;
  font-weight: 400;
}

/* Buttons */

.text-button {
  border: none;
  background: transparent;

  color: var(--color-text-secondary);

  font-size: 12px;
  font-weight: 600;

  cursor: pointer;
}

.text-button:hover {
  color: var(--color-text-primary);
}

/* Orders */

.bottom-grid {
  display: grid;
  grid-template-columns: 1fr;
}

.table-container {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th {
  padding: 12px;

  text-align: left;

  font-size: 11px;
  font-weight: 600;

  color: var(--color-text-secondary);

  background: var(--color-hover-bg);

  border-bottom: 1px solid var(--color-border-light);
}

td {
  padding: 14px 12px;

  font-size: 12px;

  color: var(--color-text-secondary);

  border-bottom: 1px solid var(--color-border-light);
}

td strong {
  color: var(--color-text-primary);
}

.status {
  display: inline-flex;

  padding: 4px 8px;

  border-radius: 20px;

  font-size: 10px;
  font-weight: 600;
}

.status.completed {
  background: var(--color-success-bg);
  color: var(--color-success);
}

.status.processing {
  background: var(--color-info-bg);
  color: var(--color-info);
}

.status.pending {
  background: var(--color-warning-bg);
  color: var(--color-warning);
}

.status.cancelled {
  background: var(--color-danger-bg);
  color: var(--color-danger);
}

.status.confirmed {
  background: var(--color-info-bg);
  color: var(--color-info);
}

.status {
  text-transform: capitalize;
}

.text-button {
  text-decoration: none;
}

.empty-state {
  padding: 40px 0;
  text-align: center;
  font-size: 13px;
  color: var(--color-text-muted);
}

.error-state {
  margin-bottom: 16px;
  padding: 12px 16px;

  border-radius: var(--radius-md);

  background: var(--color-danger-bg);
  color: var(--color-danger);

  font-size: 13px;
}

/* Responsive */

@media (max-width: 1100px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .dashboard-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 700px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }

  .page-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }

  .header-date {
    display: none;
  }
}
</style>
