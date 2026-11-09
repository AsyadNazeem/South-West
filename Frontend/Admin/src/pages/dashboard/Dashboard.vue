<script setup>
import { computed, onMounted, ref } from 'vue'
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Box,
  CalendarDays,
  CircleDollarSign,
  Clock3,
  Package,
  RefreshCw,
  ShoppingBag,
  Users,
} from 'lucide-vue-next'
import api from '@/api/axios'
import { hasPermission } from '@/auth/authorization'
import { fetchReport } from '@/api/reportApi'

const emptyStats = () => ({ totalCustomers: 0, totalProducts: 0, totalOrders: 0, totalSales: 0 })
const stats = ref(emptyStats())
const recentOrders = ref([])
const lowStockItems = ref([])
const salesChart = ref([])
const salesTotals = ref({ totalSales: 0, orderCount: 0 })
const period = ref('30d')
const loading = ref(true)
const salesLoading = ref(false)
const errorMessage = ref('')
const salesError = ref('')
const canViewReports = computed(() => hasPermission('reports.view'))

const periodLabels = { '30d': 'last 30 days', '7m': 'last 7 months', '12m': 'last 12 months' }
const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

const formatNumber = value => Number(value || 0).toLocaleString('en-LK')
const formatCurrency = value => `LKR ${Number(value || 0).toLocaleString('en-LK', { maximumFractionDigits: 0 })}`
const formatCompact = value => {
  const amount = Number(value || 0)
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(1).replace(/\.0$/, '')}K`
  return String(Math.round(amount))
}

const statCards = computed(() => [
  { title: 'Total sales', value: formatCurrency(stats.value.totalSales), note: 'All time', icon: CircleDollarSign, tone: 'green' },
  { title: 'Orders', value: formatNumber(stats.value.totalOrders), note: 'All time', icon: ShoppingBag, tone: 'blue' },
  { title: 'Customers', value: formatNumber(stats.value.totalCustomers), note: 'Registered accounts', icon: Users, tone: 'violet' },
  { title: 'Products', value: formatNumber(stats.value.totalProducts), note: 'In the catalogue', icon: Package, tone: 'amber' },
])

const chartMax = computed(() => {
  const peak = Math.max(0, ...salesChart.value.map(point => Number(point.value) || 0))
  if (!peak) return 100
  const magnitude = 10 ** Math.floor(Math.log10(peak))
  return Math.ceil(peak / magnitude) * magnitude
})
const yAxisLabels = computed(() => Array.from({ length: 5 }, (_, index) => formatCompact(chartMax.value * (1 - index / 4))))
const chartPoints = computed(() => {
  const points = salesChart.value
  if (!points.length) return ''
  const max = Math.max(chartMax.value, 1)
  const width = 1000
  const height = 250
  return points.map((point, index) => {
    const x = points.length === 1 ? width / 2 : (index / (points.length - 1)) * width
    const y = height - ((Number(point.value) || 0) / max) * height
    return `${x},${y}`
  }).join(' ')
})
const chartArea = computed(() => chartPoints.value
  ? `0,250 ${chartPoints.value} 1000,250`
  : '')
const chartLabels = computed(() => {
  const points = salesChart.value
  if (points.length <= 8) return points.map(point => point.label)
  const indexes = new Set([0, Math.round((points.length - 1) / 3), Math.round((points.length - 1) * 2 / 3), points.length - 1])
  return points.map((point, index) => indexes.has(index) ? point.label : '')
})
const orderStatusSummary = computed(() => {
  const summary = new Map()
  for (const order of recentOrders.value) {
    const status = String(order.status || 'unknown').toLowerCase()
    summary.set(status, (summary.get(status) || 0) + 1)
  }
  return [...summary.entries()].map(([status, count]) => ({ status, count }))
})

function dateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getSalesRange() {
  const end = new Date()
  const start = new Date(end)
  if (period.value === '30d') start.setDate(start.getDate() - 29)
  else start.setMonth(start.getMonth() - (period.value === '7m' ? 6 : 11), 1)
  return { startDate: dateKey(start), endDate: dateKey(end) }
}

function buildChartRows(rows) {
  const values = new Map((Array.isArray(rows) ? rows : []).map(row => [String(row.period), row]))
  const points = []
  if (period.value === '30d') {
    const start = new Date(`${getSalesRange().startDate}T00:00:00`)
    const end = new Date(`${getSalesRange().endDate}T00:00:00`)
    for (const date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      const key = dateKey(date)
      points.push({ label: date.toLocaleDateString('en', { day: 'numeric', month: 'short' }), value: Number(values.get(key)?.totalSales || 0) })
    }
  } else {
    const range = getSalesRange()
    const start = new Date(`${range.startDate}T00:00:00`)
    const end = new Date(`${range.endDate}T00:00:00`)
    for (const date = new Date(start); date <= end; date.setMonth(date.getMonth() + 1)) {
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      points.push({ label: date.toLocaleDateString('en', { month: 'short', year: '2-digit' }), value: Number(values.get(key)?.totalSales || 0) })
    }
  }
  return points
}

async function loadSalesReport() {
  if (!canViewReports.value) {
    salesChart.value = []
    salesTotals.value = { totalSales: 0, orderCount: 0 }
    return
  }
  salesLoading.value = true
  salesError.value = ''
  try {
    const endpoint = period.value === '30d' ? 'sales/daily' : 'sales/monthly'
    const report = await fetchReport(endpoint, getSalesRange())
    salesTotals.value = report.totals || { totalSales: 0, orderCount: 0 }
    salesChart.value = buildChartRows(report.rows)
  } catch (error) {
    salesError.value = error.response?.data?.message || 'Sales trend is temporarily unavailable.'
    salesChart.value = []
  } finally {
    salesLoading.value = false
  }
}

async function loadDashboard() {
  loading.value = true
  errorMessage.value = ''
  try {
    const response = await api.get('/dashboard')
    const data = response.data?.data || {}
    stats.value = { ...emptyStats(), ...(data.stats || {}) }
    recentOrders.value = Array.isArray(data.recentOrders) ? data.recentOrders : []
    lowStockItems.value = Array.isArray(data.lowStockItems) ? data.lowStockItems : []
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Failed to load dashboard data.'
  } finally {
    loading.value = false
  }
  await loadSalesReport()
}

onMounted(loadDashboard)
</script>

<template>
  <main class="dashboard">
    <header class="page-header">
      <div>
        <p class="eyebrow">SOUTH WEST • ADMINISTRATION</p>
        <h1>Good to see you</h1>
        <p class="page-subtitle">Here’s what’s happening across your store today.</p>
      </div>
      <div class="header-date"><CalendarDays :size="16" />{{ today }}</div>
    </header>

    <div v-if="errorMessage" class="error-state" role="alert">
      <AlertTriangle :size="18" />
      <span>{{ errorMessage }}</span>
      <button type="button" @click="loadDashboard"><RefreshCw :size="15" /> Retry</button>
    </div>

    <section class="stats-grid" aria-label="Store totals">
      <article v-for="stat in statCards" :key="stat.title" class="stat-card">
        <div class="stat-topline"><span>{{ stat.title }}</span><span class="stat-icon" :class="stat.tone"><component :is="stat.icon" :size="19" /></span></div>
        <strong class="stat-value">{{ loading ? '—' : stat.value }}</strong>
        <span class="stat-note">{{ stat.note }}</span>
      </article>
    </section>

    <section class="dashboard-grid">
      <article class="dashboard-card sales-card">
        <header class="card-header sales-header">
          <div>
            <div class="card-title-line"><span class="section-icon"><Activity :size="17" /></span><h2>Sales performance</h2></div>
            <p>{{ canViewReports ? `Online sales • ${periodLabels[period]}` : 'Sales reporting permission is required to view trends.' }}</p>
          </div>
          <label v-if="canViewReports" class="select-wrap">
            <span class="sr-only">Sales chart period</span>
            <select v-model="period" class="period-select" :disabled="salesLoading" @change="loadSalesReport">
              <option value="30d">Last 30 days</option>
              <option value="7m">Last 7 months</option>
              <option value="12m">Last 12 months</option>
            </select>
          </label>
        </header>

        <div v-if="canViewReports" class="sales-summary">
          <strong>{{ salesLoading ? 'Loading…' : formatCurrency(salesTotals.totalSales) }}</strong>
          <span><ShoppingBag :size="14" /> {{ formatNumber(salesTotals.orderCount) }} orders in period</span>
        </div>
        <div v-if="salesError" class="inline-error" role="status">{{ salesError }}</div>
        <div v-else-if="!canViewReports" class="chart-permission"><Activity :size="22" /><span>Ask an administrator for <strong>reports.view</strong> access to see the sales trend.</span></div>
        <div v-else-if="salesLoading && !salesChart.length" class="chart-message">Loading sales data…</div>
        <div v-else-if="!salesChart.length" class="chart-message">No sales data available for this period.</div>
        <div v-else class="chart-wrap">
          <div class="chart-y-axis"><span v-for="label in yAxisLabels" :key="label">{{ label }}</span></div>
          <div class="chart-main">
            <svg class="sales-svg" viewBox="0 0 1000 270" preserveAspectRatio="none" role="img" :aria-label="`Sales trend for ${periodLabels[period]}`">
              <defs><linearGradient id="salesFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="var(--color-primary)" stop-opacity=".22"/><stop offset="100%" stop-color="var(--color-primary)" stop-opacity="0"/></linearGradient></defs>
              <line v-for="line in [0, 62.5, 125, 187.5, 250]" :key="line" x1="0" :y1="line" x2="1000" :y2="line" class="chart-grid-line" />
              <polygon :points="chartArea" class="chart-area-fill" />
              <polyline :points="chartPoints" class="chart-line" />
              <circle v-for="(point, index) in salesChart" :key="`${point.label}-${index}`" :cx="salesChart.length === 1 ? 500 : index / (salesChart.length - 1) * 1000" :cy="250 - (Number(point.value) / chartMax) * 250" r="4" class="chart-dot"><title>{{ point.label }}: {{ formatCurrency(point.value) }}</title></circle>
            </svg>
            <div class="chart-x-axis"><span v-for="(label, index) in chartLabels" :key="index">{{ label }}</span></div>
          </div>
        </div>
      </article>

      <article class="dashboard-card stock-card">
        <header class="card-header">
          <div><div class="card-title-line"><span class="section-icon warning"><AlertTriangle :size="17" /></span><h2>Stock attention</h2></div><p>Products at or below reorder level</p></div>
          <router-link to="/admin/inventory/stock" class="text-button">Inventory <ArrowUpRight :size="14" /></router-link>
        </header>
        <div v-if="loading" class="chart-message">Checking stock…</div>
        <div v-else-if="!lowStockItems.length" class="stock-empty"><span><Box :size="22" /></span><strong>Stock looks good</strong><p>No products are currently below their reorder level.</p></div>
        <div v-else class="stock-list">
          <router-link v-for="(item, index) in lowStockItems" :key="`${item.code}-${index}`" to="/admin/inventory/stock" class="stock-item">
            <span class="stock-indicator" :class="Number(item.stock) === 0 ? 'critical' : ''"><AlertTriangle :size="15" /></span>
            <span class="stock-info"><strong>{{ item.name || 'Unnamed product' }}</strong><small>{{ item.code || 'No item code' }}</small></span>
            <span class="stock-count">{{ formatNumber(item.stock) }} <small>left</small></span>
          </router-link>
        </div>
        <p v-if="lowStockItems.length" class="list-footnote">Showing up to 10 items needing attention</p>
      </article>
    </section>

    <section class="dashboard-card orders-card">
      <header class="card-header orders-header">
        <div><div class="card-title-line"><span class="section-icon blue"><Clock3 :size="17" /></span><h2>Recent orders</h2></div><p>Latest customer purchases</p></div>
        <router-link to="/admin/sales/orders" class="text-button">All orders <ArrowUpRight :size="14" /></router-link>
      </header>
      <div v-if="orderStatusSummary.length" class="status-overview" aria-label="Statuses among the latest orders">
        <span v-for="item in orderStatusSummary" :key="item.status" class="status-summary"><i class="status-dot" :class="item.status"></i>{{ formatNumber(item.count) }} {{ item.status }}</span>
        <span class="status-caption">Latest {{ recentOrders.length }} orders</span>
      </div>
      <div v-if="loading" class="chart-message">Loading recent orders…</div>
      <div v-else-if="!recentOrders.length" class="orders-empty"><ShoppingBag :size="22" /><span>No orders have been placed yet.</span></div>
      <div v-else class="table-container">
        <table>
          <thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Amount</th><th>Status</th><th><span class="sr-only">Open order</span></th></tr></thead>
          <tbody>
            <tr v-for="(order, index) in recentOrders" :key="`${order.order}-${index}`">
              <td><strong>{{ order.order }}</strong></td><td>{{ order.customer || 'Guest' }}</td><td>{{ order.date || '—' }}</td><td class="amount-cell">{{ formatCurrency(order.amount) }}</td>
              <td><span class="status" :class="String(order.status || '').toLowerCase()">{{ order.status || 'Unknown' }}</span></td>
              <td><router-link to="/admin/sales/orders" class="row-link" :aria-label="`View orders for ${order.order}`"><ArrowUpRight :size="16" /></router-link></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </main>
</template>

<style scoped>
.dashboard { width: 100%; max-width: 1600px; margin: 0 auto; color: var(--color-text-primary); }
.page-header { display: flex; justify-content: space-between; align-items: flex-end; gap: 20px; margin-bottom: 24px; }
.eyebrow { margin: 0 0 8px; color: var(--color-primary); font-size: 10px; font-weight: 800; letter-spacing: .13em; }
.page-header h1 { margin: 0; font-size: clamp(24px, 3vw, 32px); line-height: 1.15; font-weight: 750; letter-spacing: -.035em; }
.page-subtitle { margin: 8px 0 0; color: var(--color-text-secondary); font-size: 14px; }
.header-date { display: flex; align-items: center; gap: 8px; padding: 10px 13px; border: 1px solid var(--color-border-light); border-radius: 10px; background: var(--color-surface); color: var(--color-text-secondary); font-size: 12px; white-space: nowrap; }
.stats-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; margin-bottom: 18px; }
.stat-card, .dashboard-card { min-width: 0; border: 1px solid var(--color-border-light); border-radius: 14px; background: var(--color-surface); box-shadow: var(--shadow-sm); }
.stat-card { padding: 18px 19px; }
.stat-topline { display: flex; align-items: center; justify-content: space-between; color: var(--color-text-secondary); font-size: 12px; font-weight: 550; }
.stat-icon, .section-icon { display: inline-grid; place-items: center; flex: 0 0 auto; border-radius: 10px; }
.stat-icon { width: 38px; height: 38px; }
.green { color: #16835c; background: #e8f6ef; }.blue { color: #3773c5; background: #edf4ff; }.violet { color: #8058c9; background: #f2edff; }.amber { color: #b7791f; background: #fff5df; }
.stat-value { display: block; margin-top: 14px; font-size: clamp(20px, 2.2vw, 27px); line-height: 1.15; font-weight: 750; letter-spacing: -.025em; }
.stat-note { display: block; margin-top: 6px; color: var(--color-text-muted); font-size: 11px; }
.dashboard-grid { display: grid; grid-template-columns: minmax(0, 1.7fr) minmax(300px, .9fr); gap: 16px; margin-bottom: 16px; align-items: stretch; }
.dashboard-card { padding: 20px; }
.card-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; margin-bottom: 14px; }
.card-title-line { display: flex; align-items: center; gap: 9px; }
.section-icon { width: 30px; height: 30px; color: var(--color-primary); background: var(--color-hover-bg); }
.section-icon.warning { color: #b7791f; background: #fff5df; }.section-icon.blue { color: #3773c5; background: #edf4ff; }
.card-header h2 { margin: 0; font-size: 15px; font-weight: 700; }
.card-header p { margin: 5px 0 0 39px; color: var(--color-text-secondary); font-size: 11px; }
.select-wrap { flex: 0 0 auto; }
.period-select { padding: 8px 30px 8px 10px; border: 1px solid var(--color-border-light); border-radius: 9px; background: var(--color-surface); color: var(--color-text-secondary); font: inherit; font-size: 11px; }
.sales-summary { display: flex; align-items: baseline; flex-wrap: wrap; gap: 10px; margin: 20px 0 4px 39px; }
.sales-summary strong { font-size: 22px; letter-spacing: -.03em; }.sales-summary span { display: inline-flex; align-items: center; gap: 5px; color: var(--color-text-muted); font-size: 11px; }
.chart-wrap { display: flex; height: 220px; margin-top: 12px; }
.chart-y-axis { display: flex; width: 38px; flex-direction: column; justify-content: space-between; padding: 2px 7px 24px 0; color: var(--color-text-muted); font-size: 9px; text-align: right; }
.chart-main { position: relative; min-width: 0; flex: 1; }
.sales-svg { display: block; width: 100%; height: 190px; overflow: visible; }
.chart-grid-line { stroke: var(--color-border-light); stroke-width: 1; vector-effect: non-scaling-stroke; }
.chart-area-fill { fill: url(#salesFill); }.chart-line { fill: none; stroke: var(--color-primary); stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; vector-effect: non-scaling-stroke; }
.chart-dot { fill: var(--color-surface); stroke: var(--color-primary); stroke-width: 2.5; vector-effect: non-scaling-stroke; }
.chart-x-axis { position: absolute; right: 0; bottom: 0; left: 0; display: flex; justify-content: space-between; color: var(--color-text-muted); font-size: 9px; }
.chart-message, .inline-error { padding: 28px 10px; color: var(--color-text-muted); font-size: 12px; text-align: center; }
.inline-error { color: var(--color-danger, #b91c1c); }
.chart-permission { display: flex; align-items: center; gap: 12px; min-height: 190px; padding: 20px; color: var(--color-text-secondary); font-size: 12px; line-height: 1.6; }
.chart-permission > svg { flex: 0 0 auto; color: var(--color-primary); }.chart-permission strong { color: var(--color-text-primary); }
.text-button { display: inline-flex; align-items: center; gap: 4px; color: var(--color-primary); font-size: 11px; font-weight: 650; text-decoration: none; white-space: nowrap; }.text-button:hover { text-decoration: underline; }
.stock-list { display: flex; flex-direction: column; }
.stock-item { display: flex; align-items: center; gap: 10px; min-width: 0; padding: 11px 0; border-bottom: 1px solid var(--color-border-light); color: inherit; text-decoration: none; }.stock-item:last-child { border-bottom: 0; }
.stock-indicator { display: grid; width: 30px; height: 30px; flex: 0 0 auto; place-items: center; border-radius: 9px; background: #fff5df; color: #b7791f; }.stock-indicator.critical { background: #fff0f0; color: var(--color-danger, #b91c1c); }
.stock-info { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 3px; }.stock-info strong { overflow: hidden; font-size: 11px; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }.stock-info small { color: var(--color-text-muted); font-size: 10px; }
.stock-count { flex: 0 0 auto; color: var(--color-danger, #b91c1c); font-size: 13px; font-weight: 750; }.stock-count small { font-size: 9px; font-weight: 500; }
.stock-empty, .orders-empty { display: flex; min-height: 180px; flex-direction: column; align-items: center; justify-content: center; gap: 8px; color: var(--color-text-muted); text-align: center; }.stock-empty > span { display: grid; width: 42px; height: 42px; place-items: center; border-radius: 50%; background: #e8f6ef; color: #16835c; }.stock-empty strong { color: var(--color-text-primary); font-size: 12px; }.stock-empty p { max-width: 220px; margin: 0; font-size: 10px; line-height: 1.5; }
.list-footnote { margin: 8px 0 0; color: var(--color-text-muted); font-size: 10px; }
.orders-card { padding-bottom: 8px; }.orders-header { margin-bottom: 10px; }.status-overview { display: flex; align-items: center; flex-wrap: wrap; gap: 7px; margin: 0 0 12px 39px; }.status-summary { display: inline-flex; align-items: center; gap: 5px; padding: 5px 8px; border-radius: 20px; background: var(--color-hover-bg); color: var(--color-text-secondary); font-size: 10px; text-transform: capitalize; }.status-dot { width: 6px; height: 6px; border-radius: 50%; background: #8792a2; }.status-dot.completed, .status-dot.delivered { background: #16835c; }.status-dot.pending { background: #c58a22; }.status-dot.cancelled, .status-dot.returned { background: #c33d3d; }.status-dot.processing, .status-dot.confirmed { background: #3773c5; }.status-caption { margin-left: auto; color: var(--color-text-muted); font-size: 10px; }
.table-container { overflow-x: auto; }table { width: 100%; border-collapse: collapse; white-space: nowrap; }th { padding: 10px 12px; background: var(--color-hover-bg); color: var(--color-text-secondary); font-size: 10px; font-weight: 650; text-align: left; }td { padding: 12px; border-bottom: 1px solid var(--color-border-light); color: var(--color-text-secondary); font-size: 11px; }td strong, .amount-cell { color: var(--color-text-primary); font-weight: 650; }.status { display: inline-flex; padding: 4px 8px; border-radius: 20px; background: var(--color-hover-bg); color: var(--color-text-secondary); font-size: 9px; font-weight: 650; text-transform: capitalize; }.status.completed, .status.delivered { background: var(--color-success-bg); color: var(--color-success); }.status.processing, .status.confirmed { background: var(--color-info-bg); color: var(--color-info); }.status.pending { background: var(--color-warning-bg); color: var(--color-warning); }.status.cancelled, .status.returned { background: var(--color-danger-bg); color: var(--color-danger); }.row-link { display: inline-grid; width: 28px; height: 28px; place-items: center; border-radius: 7px; color: var(--color-text-muted); }.row-link:hover { background: var(--color-hover-bg); color: var(--color-primary); }
.error-state { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; padding: 12px 14px; border-radius: 10px; background: var(--color-danger-bg); color: var(--color-danger); font-size: 12px; }.error-state span { flex: 1; }.error-state button { display: inline-flex; align-items: center; gap: 5px; border: 0; background: transparent; color: inherit; font: inherit; font-weight: 700; cursor: pointer; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
@media (max-width: 1120px) { .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }.dashboard-grid { grid-template-columns: 1fr; } }
@media (max-width: 650px) { .page-header { align-items: flex-start; flex-direction: column; }.header-date { font-size: 11px; }.stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 9px; }.stat-card { padding: 14px; }.stat-topline { font-size: 11px; }.stat-icon { width: 32px; height: 32px; }.stat-value { margin-top: 11px; font-size: 19px; }.dashboard-card { padding: 15px; }.sales-header { flex-direction: column; }.sales-summary { margin-left: 0; }.chart-wrap { height: 190px; }.sales-svg { height: 162px; }.chart-permission { min-height: 145px; padding: 8px; }.status-overview { margin-left: 0; }.status-caption { width: 100%; margin-left: 0; }.error-state { align-items: flex-start; flex-wrap: wrap; } }
@media (max-width: 380px) { .stats-grid { grid-template-columns: 1fr; }.header-date { white-space: normal; } }
</style>
