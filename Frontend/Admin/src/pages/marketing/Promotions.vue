<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/api/axios'

const router = useRouter()
const promotions = ref([])
const loading = ref(false)
const error = ref('')
const search = ref('')
const statusFilter = ref('all')

const filteredPromotions = computed(() => {
  const term = search.value.trim().toLowerCase()

  return promotions.value.filter(promotion => {
    const matchesSearch =
      !term ||
      promotion.promotion_code?.toLowerCase().includes(term) ||
      promotion.promotion_name?.toLowerCase().includes(term)

    const matchesStatus =
      statusFilter.value === 'all' ||
      promotion.status === statusFilter.value

    return matchesSearch && matchesStatus
  })
})

const activeCount = computed(() =>
  promotions.value.filter(p => p.status === 'active' && p.is_active).length
)

const totalRedemptions = computed(() =>
  promotions.value.reduce((sum, p) => sum + Number(p.used_count || 0), 0)
)

function formatDate(value) {
  if (!value) return '—'

  return new Intl.DateTimeFormat('en-LK', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value))
}

function formatDiscount(promotion) {
  if (promotion.promotion_type === 'percentage') {
    return `${Number(promotion.discount_value)}%`
  }

  if (promotion.promotion_type === 'fixed_amount') {
    return `LKR ${Number(promotion.discount_value).toLocaleString('en-LK')}`
  }

  return promotion.promotion_type
}

function statusLabel(status) {
  return status ? status.replaceAll('_', ' ') : 'Unknown'
}

async function loadPromotions() {
  loading.value = true
  error.value = ''

  try {
    const response = await api.get('/promotions')
    promotions.value = response.data.data || []
  } catch (err) {
    error.value =
      err.response?.data?.message || 'Unable to load promo codes.'
  } finally {
    loading.value = false
  }
}

async function changeStatus(promotion, status) {
  const previousStatus = promotion.status
  promotion.status = status

  try {
    await api.patch(`/promotions/${promotion.id}/status`, { status })
    await loadPromotions()
  } catch (err) {
    promotion.status = previousStatus
    error.value =
      err.response?.data?.message || 'Unable to update promo status.'
  }
}

onMounted(loadPromotions)
</script>

<template>
  <div class="promotions-page">
    <header class="page-header">
      <div>
        <p class="eyebrow">MARKETING</p>
        <h1>Promo codes</h1>
        <p class="subtitle">Create and manage customer checkout discounts.</p>
      </div>

      <button
        class="btn btn-primary"
        @click="router.push('/admin/marketing/promotions/create')"
      >
        <span class="plus">+</span> Create promo code
      </button>
    </header>

    <div v-if="error" class="alert">
      <span>{{ error }}</span>
      <button @click="loadPromotions">Retry</button>
    </div>

    <div class="stats-grid">
      <article class="stat-card">
        <span>Total promo codes</span>
        <strong>{{ promotions.length }}</strong>
      </article>

      <article class="stat-card">
        <span>Active promo codes</span>
        <strong>{{ activeCount }}</strong>
      </article>

      <article class="stat-card">
        <span>Total redemptions</span>
        <strong>{{ totalRedemptions.toLocaleString() }}</strong>
      </article>
    </div>

    <section class="table-panel">
      <div class="toolbar">
        <div>
          <h2>All promo codes</h2>
          <p>Search and manage existing promotions.</p>
        </div>

        <div class="filters">
          <input
            v-model="search"
            type="search"
            placeholder="Search code or name…"
            aria-label="Search promo codes"
          />

          <select v-model="statusFilter" aria-label="Filter by status">
            <option value="all">All statuses</option>
            <option value="draft">Draft</option>
            <option value="scheduled">Scheduled</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="expired">Expired</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      <div v-if="loading" class="empty-state">Loading promo codes…</div>

      <div v-else-if="filteredPromotions.length === 0" class="empty-state">
        <h3>No promo codes found</h3>
        <p>Try changing your filters or create your first promo code.</p>
        <button
          class="btn btn-primary"
          @click="router.push('/admin/marketing/promotions/create')"
        >
          Create promo code
        </button>
      </div>

      <div v-else class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Promo code</th>
              <th>Discount</th>
              <th>Usage</th>
              <th>Valid period</th>
              <th>Status</th>
              <th>Enabled</th>
              <th class="actions-heading">Actions</th>
            </tr>
          </thead>

          <tbody>
            <tr v-for="promotion in filteredPromotions" :key="promotion.id">
              <td>
                <div class="code">{{ promotion.promotion_code }}</div>
                <div class="promotion-name">{{ promotion.promotion_name }}</div>
              </td>

              <td>
                <strong>{{ formatDiscount(promotion) }}</strong>
                <div class="muted">
                  Min. order:
                  {{ promotion.minimum_order_amount == null
                    ? 'None'
                    : `LKR ${Number(promotion.minimum_order_amount).toLocaleString('en-LK')}` }}
                </div>
              </td>

              <td>
                {{ Number(promotion.used_count || 0).toLocaleString() }}
                /
                {{ promotion.usage_limit == null
                  ? '∞'
                  : Number(promotion.usage_limit).toLocaleString() }}
              </td>

              <td>
                <div>{{ formatDate(promotion.start_date) }}</div>
                <div class="muted">Until {{ formatDate(promotion.end_date) }}</div>
              </td>

              <td>
                <span class="status" :class="`status-${promotion.status}`">
                  {{ statusLabel(promotion.status) }}
                </span>
              </td>

              <td>
                <span :class="promotion.is_active ? 'enabled' : 'disabled'">
                  {{ promotion.is_active ? 'Yes' : 'No' }}
                </span>
              </td>

              <td>
                <div class="row-actions">
                  <button
                    class="btn btn-small"
                    @click="router.push(`/admin/marketing/promotions/edit/${promotion.id}`)"
                  >
                    Edit
                  </button>

                  <select
                    :value="promotion.status"
                    aria-label="Change promotion status"
                    @change="changeStatus(promotion, $event.target.value)"
                  >
                    <option value="draft">Draft</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                    <option value="expired">Expired</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <footer class="table-footer">
        Showing {{ filteredPromotions.length }} of {{ promotions.length }} promo codes
      </footer>
    </section>
  </div>
</template>

<style scoped>
.promotions-page {
  padding: 28px;
  max-width: 1500px;
  margin: 0 auto;
  color: var(--text-primary, #172033);
}
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20px;
  margin-bottom: 26px;
}
.eyebrow {
  color: #64748b;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1.2px;
  margin: 0 0 8px;
}
h1 {
  font-size: 28px;
  margin: 0;
}
.subtitle, .toolbar p {
  color: #64748b;
  font-size: 14px;
  margin: 8px 0 0;
}
.btn {
  border: 0;
  border-radius: 7px;
  padding: 11px 16px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 650;
}
.btn-primary {
  background: #172033;
  color: white;
}
.btn-small {
  padding: 7px 10px;
  background: #f1f5f9;
  color: #334155;
}
.plus {
  font-size: 17px;
  margin-right: 6px;
}
.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 22px;
}
.stat-card, .table-panel {
  border: 1px solid var(--border-color, #e2e8f0);
  background: var(--surface, #fff);
  border-radius: 12px;
}
.stat-card {
  padding: 20px;
}
.stat-card span {
  color: #64748b;
  font-size: 13px;
}
.stat-card strong {
  display: block;
  font-size: 27px;
  margin-top: 10px;
}
.table-panel {
  overflow: hidden;
}
.toolbar {
  padding: 22px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 18px;
  border-bottom: 1px solid #e2e8f0;
}
.toolbar h2 {
  font-size: 17px;
  margin: 0;
}
.filters {
  display: flex;
  gap: 10px;
}
.filters input, .filters select, .row-actions select {
  border: 1px solid #cbd5e1;
  border-radius: 7px;
  padding: 10px 11px;
  background: var(--input-background, #fff);
  color: inherit;
  font: inherit;
  font-size: 13px;
}
.filters input {
  min-width: 220px;
}
.table-scroll {
  overflow-x: auto;
}
table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 13px;
}
th {
  background: #f8fafc;
  color: #64748b;
  font-weight: 650;
  white-space: nowrap;
}
th, td {
  padding: 15px 16px;
  border-bottom: 1px solid #e2e8f0;
  vertical-align: middle;
}
tbody tr:hover {
  background: #fafcff;
}
.code {
  font-weight: 750;
  letter-spacing: .4px;
}
.promotion-name {
  color: #64748b;
  margin-top: 4px;
}
.muted {
  color: #64748b;
  font-size: 12px;
  margin-top: 5px;
  white-space: nowrap;
}
.status {
  display: inline-block;
  padding: 5px 9px;
  border-radius: 20px;
  text-transform: capitalize;
  font-size: 12px;
  white-space: nowrap;
  background: #f1f5f9;
  color: #475569;
}
.status-active { background: #dcfce7; color: #166534; }
.status-draft { background: #f1f5f9; color: #475569; }
.status-scheduled { background: #dbeafe; color: #1d4ed8; }
.status-paused { background: #fef3c7; color: #92400e; }
.status-expired, .status-cancelled { background: #fee2e2; color: #991b1b; }
.enabled { color: #15803d; }
.disabled { color: #b91c1c; }
.row-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.row-actions select {
  max-width: 125px;
  padding: 7px;
}
.actions-heading {
  min-width: 190px;
}
.table-footer {
  padding: 15px 22px;
  color: #64748b;
  font-size: 12px;
}
.empty-state {
  text-align: center;
  padding: 55px 20px;
  color: #64748b;
}
.empty-state h3 {
  color: #172033;
  margin: 0 0 8px;
}
.empty-state p {
  margin-bottom: 20px;
}
.alert {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 13px 15px;
  border-radius: 8px;
  margin-bottom: 18px;
  background: #fef2f2;
  color: #b91c1c;
}
.alert button {
  border: 0;
  background: transparent;
  cursor: pointer;
  font-weight: 700;
  color: inherit;
}
@media (max-width: 850px) {
  .promotions-page { padding: 16px; }
  .page-header, .toolbar { flex-direction: column; align-items: stretch; }
  .stats-grid { grid-template-columns: 1fr; }
  .filters { flex-direction: column; }
  .filters input { min-width: 0; }
}
</style>