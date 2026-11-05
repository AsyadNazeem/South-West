
<template>
  <div class="audit-page">
    <div class="page-header">
      <div>
        <h1>Audit Logs</h1>
        <p>Track administrative activities and changes across the system.</p>
      </div>

      <button class="refresh-btn" :disabled="loading" @click="fetchAuditLogs">
        {{ loading ? 'Loading...' : '↻ Refresh' }}
      </button>
    </div>

    <div class="summary-grid">
      <div class="summary-card">
        <span>Total Records</span>
        <strong>{{ pagination.total }}</strong>
      </div>
      <div class="summary-card">
        <span>Current Page</span>
        <strong>{{ pagination.page }} / {{ pagination.totalPages || 1 }}</strong>
      </div>
      <div class="summary-card">
        <span>Records Displayed</span>
        <strong>{{ logs.length }}</strong>
      </div>
    </div>

    <section class="filter-card">
      <div class="filter-header">
        <h2>Filter Audit Logs</h2>
        <button class="clear-btn" @click="clearFilters">Clear filters</button>
      </div>

      <form class="filters" @submit.prevent="applyFilters">
        <div class="filter-field">
          <label for="action">Action</label>
          <input
            id="action"
            v-model.trim="filters.action"
            type="text"
            placeholder="e.g. CREATE, UPDATE, DELETE"
          />
        </div>

        <div class="filter-field">
          <label for="module">Module</label>
          <input
            id="module"
            v-model.trim="filters.module"
            type="text"
            placeholder="e.g. products, users"
          />
        </div>

        <div class="filter-field">
          <label for="userId">User ID</label>
          <input
            id="userId"
            v-model.trim="filters.user_id"
            type="number"
            min="1"
            placeholder="Enter user ID"
          />
        </div>

        <div class="filter-field">
          <label for="entityType">Entity Type</label>
          <input
            id="entityType"
            v-model.trim="filters.entity_type"
            type="text"
            placeholder="e.g. Product"
          />
        </div>

        <div class="filter-field">
          <label for="from">From Date</label>
          <input id="from" v-model="filters.from" type="date" />
        </div>

        <div class="filter-field">
          <label for="to">To Date</label>
          <input id="to" v-model="filters.to" type="date" />
        </div>

        <div class="filter-field">
          <label for="limit">Rows per page</label>
          <select id="limit" v-model.number="filters.limit">
            <option :value="10">10</option>
            <option :value="20">20</option>
            <option :value="50">50</option>
            <option :value="100">100</option>
          </select>
        </div>

        <div class="filter-actions">
          <button class="primary-btn" type="submit">Apply Filters</button>
        </div>
      </form>
    </section>

    <div v-if="error" class="error-message">
      <strong>Unable to load audit logs.</strong>
      <p>{{ error }}</p>
      <button class="retry-btn" @click="fetchAuditLogs">Try Again</button>
    </div>

    <section class="table-card">
      <div class="table-header">
        <div>
          <h2>Activity History</h2>
          <p>Review recorded actions and their details.</p>
        </div>
        <span class="record-count">{{ pagination.total }} records</span>
      </div>

      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Date & Time</th>
              <th>User</th>
              <th>Action</th>
              <th>Module</th>
              <th>Entity</th>
              <th>Description</th>
              <th>IP Address</th>
              <th>Details</th>
            </tr>
          </thead>

          <tbody v-if="loading">
            <tr>
              <td colspan="9" class="state-cell">Loading audit logs...</td>
            </tr>
          </tbody>

          <tbody v-else-if="logs.length === 0">
            <tr>
              <td colspan="9" class="state-cell">
                No audit logs found for the selected filters.
              </td>
            </tr>
          </tbody>

          <tbody v-else>
            <tr v-for="log in logs" :key="log.id">
              <td class="id-cell">{{ log.id }}</td>

              <td class="date-cell">
                {{ formatDate(log.created_at) }}
              </td>

              <td>
                <div class="user-cell">
                  <strong>{{ log.user?.email || 'System / Deleted User' }}</strong>
                  <small v-if="log.user_id">ID: {{ log.user_id }}</small>
                </div>
              </td>

              <td>
                <span class="action-badge" :class="actionClass(log.action)">
                  {{ log.action || 'Unknown' }}
                </span>
              </td>

              <td>{{ log.module || '—' }}</td>

              <td>
                <div>{{ log.entity_type || '—' }}</div>
                <small v-if="log.entity_id">ID: {{ log.entity_id }}</small>
              </td>

              <td class="description-cell">
                {{ log.description || '—' }}
              </td>

              <td>{{ log.ip_address || '—' }}</td>

              <td>
                <button
                  class="details-btn"
                  type="button"
                  @click="openDetails(log)"
                >
                  View
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="pagination">
        <span>
          Showing
          {{ pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1 }}
          –
          {{ Math.min(pagination.page * pagination.limit, pagination.total) }}
          of {{ pagination.total }}
        </span>

        <div class="pagination-controls">
          <button
            :disabled="loading || pagination.page <= 1"
            @click="changePage(pagination.page - 1)"
          >
            Previous
          </button>

          <span>Page {{ pagination.page }} of {{ pagination.totalPages || 1 }}</span>

          <button
            :disabled="loading || pagination.page >= pagination.totalPages"
            @click="changePage(pagination.page + 1)"
          >
            Next
          </button>
        </div>
      </div>
    </section>

    <div v-if="selectedLog" class="modal-backdrop" @click.self="closeDetails">
      <section
        class="details-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="details-title"
      >
        <div class="modal-header">
          <div>
            <h2 id="details-title">Audit Log #{{ selectedLog.id }}</h2>
            <p>Detailed record of this activity.</p>
          </div>
          <button class="close-btn" aria-label="Close" @click="closeDetails">
            ×
          </button>
        </div>

        <div class="details-grid">
          <div>
            <span>Action</span>
            <strong>{{ selectedLog.action || '—' }}</strong>
          </div>
          <div>
            <span>Module</span>
            <strong>{{ selectedLog.module || '—' }}</strong>
          </div>
          <div>
            <span>User</span>
            <strong>{{ selectedLog.user?.email || 'System / Deleted User' }}</strong>
          </div>
          <div>
            <span>User ID</span>
            <strong>{{ selectedLog.user_id ?? '—' }}</strong>
          </div>
          <div>
            <span>Entity Type</span>
            <strong>{{ selectedLog.entity_type || '—' }}</strong>
          </div>
          <div>
            <span>Entity ID</span>
            <strong>{{ selectedLog.entity_id ?? '—' }}</strong>
          </div>
          <div>
            <span>IP Address</span>
            <strong>{{ selectedLog.ip_address || '—' }}</strong>
          </div>
          <div>
            <span>Request ID</span>
            <strong>{{ selectedLog.request_id || '—' }}</strong>
          </div>
          <div class="full-width">
            <span>Description</span>
            <p>{{ selectedLog.description || 'No description provided.' }}</p>
          </div>
          <div class="full-width">
            <span>User Agent</span>
            <p class="pre-wrap">{{ selectedLog.user_agent || '—' }}</p>
          </div>
          <div class="full-width">
            <span>Old Values</span>
            <pre>{{ prettyJson(selectedLog.old_values) }}</pre>
          </div>
          <div class="full-width">
            <span>New Values</span>
            <pre>{{ prettyJson(selectedLog.new_values) }}</pre>
          </div>
        </div>

        <div class="modal-footer">
          <button class="primary-btn" @click="closeDetails">Close</button>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import api from '@/api/axios'

const logs = ref([])
const loading = ref(false)
const error = ref('')
const selectedLog = ref(null)

const filters = reactive({
  action: '',
  module: '',
  user_id: '',
  entity_type: '',
  from: '',
  to: '',
  limit: 20
})

const pagination = reactive({
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 0
})

async function fetchAuditLogs() {
  loading.value = true
  error.value = ''

  try {
    const params = {
      page: pagination.page,
      limit: filters.limit
    }

    for (const key of ['action', 'module', 'user_id', 'entity_type', 'from', 'to']) {
      if (filters[key] !== '' && filters[key] != null) {
        params[key] = filters[key]
      }
    }

    const response = await api.get('/audit-logs', { params })
    const payload = response.data

    if (!Array.isArray(payload.data) || !payload.pagination) {
      throw new Error('The API returned an unexpected response format.')
    }

    logs.value = payload.data
    pagination.page = Number(payload.pagination.page) || 1
    pagination.limit = Number(payload.pagination.limit) || filters.limit
    pagination.total = Number(payload.pagination.total) || 0
    pagination.totalPages = Number(payload.pagination.totalPages) || 0
  } catch (err) {
    console.error('Failed to load audit logs:', err)

    logs.value = []
    error.value =
      err.response?.data?.message ||
      err.message ||
      'An unexpected error occurred.'
  } finally {
    loading.value = false
  }
}

function applyFilters() {
  if (filters.from && filters.to && filters.from > filters.to) {
    error.value = 'The From Date cannot be later than the To Date.'
    return
  }

  pagination.page = 1
  fetchAuditLogs()
}

function clearFilters() {
  Object.assign(filters, {
    action: '',
    module: '',
    user_id: '',
    entity_type: '',
    from: '',
    to: '',
    limit: 20
  })

  pagination.page = 1
  fetchAuditLogs()
}

function changePage(page) {
  if (page < 1 || page > pagination.totalPages || loading.value) return

  pagination.page = page
  fetchAuditLogs()
}

function openDetails(log) {
  selectedLog.value = log
}

function closeDetails() {
  selectedLog.value = null
}

function formatDate(value) {
  if (!value) return '—'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleString()
}

function actionClass(action) {
  const value = String(action || '').toLowerCase()

  if (value.includes('delete') || value.includes('remove')) return 'action-danger'
  if (value.includes('create') || value.includes('register')) return 'action-success'
  if (value.includes('update') || value.includes('edit')) return 'action-warning'
  if (value.includes('login') || value.includes('logout')) return 'action-info'

  return 'action-neutral'
}

function prettyJson(value) {
  if (value === null || value === undefined || value === '') return 'No data recorded.'

  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value
    return JSON.stringify(parsed, null, 2)
  } catch {
    return typeof value === 'string' ? value : JSON.stringify(value, null, 2)
  }
}

onMounted(fetchAuditLogs)
</script>

<style scoped>
.audit-page {
  padding: 24px;
  color: var(--text-primary, #172033);
  min-width: 0;
}

.page-header,
.table-header,
.filter-header,
.modal-header,
.pagination,
.pagination-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.page-header {
  margin-bottom: 24px;
}

.page-header h1 {
  margin: 0 0 8px;
  font-size: 28px;
  font-weight: 700;
}

.page-header p,
.table-header p,
.modal-header p {
  margin: 0;
  color: #778196;
  font-size: 14px;
}

button,
input,
select {
  font: inherit;
}

button {
  cursor: pointer;
  transition: background 0.15s ease, opacity 0.15s ease;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.refresh-btn,
.clear-btn,
.retry-btn,
.details-btn,
.pagination-controls button,
.close-btn {
  border: 1px solid #dce2eb;
  border-radius: 7px;
  background: white;
  color: #344054;
  padding: 9px 13px;
}

.refresh-btn:hover,
.clear-btn:hover,
.details-btn:hover,
.pagination-controls button:hover:not(:disabled) {
  background: #f3f6fa;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 22px;
}

.summary-card,
.filter-card,
.table-card {
  border: 1px solid #e5e9f0;
  border-radius: 12px;
  background: white;
  box-shadow: 0 2px 8px rgb(16 24 40 / 3%);
}

.summary-card {
  padding: 20px;
}

.summary-card span,
.details-grid span {
  display: block;
  margin-bottom: 8px;
  color: #778196;
  font-size: 13px;
}

.summary-card strong {
  font-size: 26px;
}

.filter-card {
  padding: 20px;
  margin-bottom: 22px;
}

.filter-header {
  margin-bottom: 20px;
}

.filter-header h2,
.table-header h2,
.modal-header h2 {
  margin: 0 0 5px;
  font-size: 17px;
}

.filters {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.filter-field {
  display: flex;
  flex-direction: column;
  gap: 7px;
  min-width: 0;
}

.filter-field label {
  color: #4c5669;
  font-size: 13px;
  font-weight: 600;
}

.filter-field input,
.filter-field select {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  padding: 10px 11px;
  border: 1px solid #dce2eb;
  border-radius: 7px;
  background: white;
  color: #172033;
  outline: none;
}

.filter-field input:focus,
.filter-field select:focus {
  border-color: #647fea;
  box-shadow: 0 0 0 3px rgb(100 127 234 / 12%);
}

.filter-actions {
  display: flex;
  align-items: end;
}

.primary-btn {
  padding: 10px 16px;
  border: 0;
  border-radius: 7px;
  background: #3559d9;
  color: white;
  font-weight: 600;
}

.primary-btn:hover {
  background: #2948bc;
}

.error-message {
  padding: 16px;
  margin-bottom: 20px;
  border: 1px solid #fecaca;
  border-radius: 9px;
  background: #fff5f5;
  color: #991b1b;
}

.error-message p {
  margin: 6px 0 12px;
}

.retry-btn {
  color: #991b1b;
}

.table-card {
  overflow: hidden;
}

.table-header {
  padding: 20px;
}

.record-count {
  flex-shrink: 0;
  padding: 6px 10px;
  border-radius: 20px;
  background: #f1f4f9;
  color: #596579;
  font-size: 12px;
}

.table-wrapper {
  width: 100%;
  overflow-x: auto;
}

table {
  width: 100%;
  min-width: 1150px;
  border-collapse: collapse;
  text-align: left;
}

thead {
  background: #f7f8fb;
}

th {
  padding: 13px 15px;
  color: #647084;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  white-space: nowrap;
}

td {
  padding: 14px 15px;
  border-top: 1px solid #edf0f5;
  color: #384357;
  font-size: 13px;
  vertical-align: top;
}

tbody tr:hover {
  background: #fafbfe;
}

.id-cell {
  font-weight: 700;
}

.date-cell {
  min-width: 150px;
  white-space: nowrap;
}

.user-cell {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 150px;
  overflow-wrap: anywhere;
}

.user-cell strong {
  font-weight: 600;
}

small {
  color: #8590a2;
  font-size: 11px;
}

.action-badge {
  display: inline-block;
  padding: 5px 8px;
  border-radius: 5px;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}

.action-danger {
  background: #fee2e2;
  color: #b42318;
}

.action-success {
  background: #dcfce7;
  color: #166534;
}

.action-warning {
  background: #fef3c7;
  color: #92400e;
}

.action-info {
  background: #dbeafe;
  color: #1d4ed8;
}

.action-neutral {
  background: #eef0f4;
  color: #4b5563;
}

.description-cell {
  min-width: 180px;
  max-width: 300px;
  overflow-wrap: anywhere;
}

.details-btn {
  padding: 6px 10px;
  color: #3559d9;
  border-color: #dce5ff;
}

.state-cell {
  padding: 45px 20px;
  text-align: center;
  color: #778196;
}

.pagination {
  padding: 16px 20px;
  border-top: 1px solid #edf0f5;
  color: #778196;
  font-size: 13px;
}

.pagination-controls {
  flex-wrap: wrap;
}

.pagination-controls button {
  padding: 7px 10px;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  overflow-y: auto;
  background: rgb(15 23 42 / 55%);
}

.details-modal {
  width: min(850px, 100%);
  max-height: calc(100vh - 40px);
  overflow-y: auto;
  border-radius: 12px;
  background: white;
  box-shadow: 0 20px 60px rgb(0 0 0 / 20%);
}

.modal-header {
  position: sticky;
  top: 0;
  padding: 20px;
  border-bottom: 1px solid #edf0f5;
  background: white;
}

.close-btn {
  width: 36px;
  height: 36px;
  padding: 0;
  font-size: 24px;
}

.details-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
  padding: 22px;
}

.details-grid strong {
  display: block;
  overflow-wrap: anywhere;
  font-size: 13px;
  font-weight: 600;
}

.details-grid p {
  margin: 0;
  overflow-wrap: anywhere;
  font-size: 13px;
  line-height: 1.6;
}

.full-width {
  grid-column: 1 / -1;
}

.details-grid pre {
  max-height: 250px;
  overflow: auto;
  margin: 0;
  padding: 14px;
  border-radius: 7px;
  background: #f5f7fa;
  color: #344054;
  font-size: 12px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.pre-wrap {
  white-space: pre-wrap;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  padding: 16px 22px;
  border-top: 1px solid #edf0f5;
}

@media (max-width: 1000px) {
  .filters {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .audit-page {
    padding: 14px;
  }

  .page-header {
    align-items: flex-start;
  }

  .page-header h1 {
    font-size: 23px;
  }

  .summary-grid {
    grid-template-columns: 1fr;
    gap: 10px;
  }

  .summary-card {
    padding: 15px;
  }

  .filters {
    grid-template-columns: 1fr;
  }

  .pagination {
    align-items: flex-start;
    flex-direction: column;
  }

  .details-grid {
    grid-template-columns: 1fr;
  }

  .full-width {
    grid-column: auto;
  }
}
</style>
