<template>
  <div class="page-container">

    <!-- Header -->
    <div class="page-header">

      <div>
        <h1>Notification History</h1>

        <p>
          Review notifications sent to your admin account.
        </p>
      </div>

      <button
          type="button"
          class="secondary-button"
          :disabled="loading"
          @click="load"
      >
        Refresh
      </button>

    </div>


    <!-- Error -->
    <div
        v-if="error"
        class="error-state"
        role="alert"
    >
      {{ error }}
    </div>


    <!-- Filters -->
    <div class="filter-card">

      <label for="notification-date-sort">
        Sort by date
      </label>

      <select
          id="notification-date-sort"
          v-model="sortOrder"
      >

        <option value="DESC">
          Newest first
        </option>

        <option value="ASC">
          Oldest first
        </option>

      </select>

      <span class="record-count">
        {{ pagination.total }} notifications
      </span>

    </div>


    <!-- Table -->
    <div class="table-card">

      <!-- Loading -->
      <div
          v-if="loading"
          class="empty-state"
          role="status"
      >
        Loading notification history…
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
              Date
            </th>

            <th>
              Type
            </th>

            <th>
              Notification
            </th>

            <th>
              Status
            </th>

          </tr>

          </thead>


          <tbody>

          <tr
              v-for="item in items"
              :key="item.id"
          >

            <!-- Date -->
            <td>
              {{ formatDate(item.created_at) }}
            </td>


            <!-- Type -->
            <td>

              <span class="role-badge">
                {{ formatType(item.type) }}
              </span>

            </td>


            <!-- Notification -->
            <td class="message-cell">

              <strong>
                {{ item.title }}
              </strong>

              <span>
                {{ item.message }}
              </span>

            </td>


            <!-- Status -->
            <td>

              <span
                  class="status-badge"
                  :class="item.is_read ? 'read' : 'unread'"
              >
                {{ item.is_read ? 'Read' : 'Unread' }}
              </span>

            </td>


          </tr>


          <!-- Empty -->
          <tr v-if="!items.length">

            <td
                colspan="4"
                class="empty-cell"
            >
              No notification history found.
            </td>

          </tr>

          </tbody>

        </table>

      </div>


      <!-- Pagination -->
      <AppPagination
        :page="page"
        :page-size="pageSize"
        :total="pagination.total"
        :total-pages="pagination.totalPages"
        :loading="loading"
        @update:page="changePage"
        @update:page-size="changePageSize"
      />

    </div>

  </div>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue'
import api from '@/api/axios'
import AppPagination from '@/components/common/AppPagination.vue'

const items = ref([])
const page = ref(1)
const pageSize = ref(25)
const sortOrder = ref('DESC')
const pagination = ref({ total: 0, totalPages: 1 })
const loading = ref(false)
const error = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    const response = await api.get('/notifications/admin/mine', {
      params: { page: page.value, pageSize: pageSize.value, sortOrder: sortOrder.value }
    })
    items.value = response.data?.data || []
    pagination.value = response.data?.pagination || { total: items.value.length, totalPages: 1 }
  } catch (e) {
    error.value = e.response?.data?.message || 'Unable to load notification history.'
  } finally {
    loading.value = false
  }
}

watch(sortOrder, () => {
  page.value = 1
  load()
})

function changePage(value) {
  page.value = value
  load()
}

function changePageSize(value) {
  pageSize.value = value
  page.value = 1
  load()
}

const formatDate = value =>
  new Date(value).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
const formatType = value => String(value || '').replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase())

onMounted(load)
</script>

<style scoped>
.page-container {
  width: 100%;
  margin-inline: auto;
  font-family: var(--font-family);
}

/* Narrower screens need more room than 60% */
@media (max-width: 1200px) {
  .page-container {
    width: 80%;
  }
}

@media (max-width: 900px) {
  .page-container {
    width: 100%;
  }
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

.secondary-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 10px var(--spacing-lg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  font-family: inherit;
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  white-space: nowrap;
  cursor: pointer;
  transition: background var(--transition-fast),
  color var(--transition-fast),
  border-color var(--transition-fast);
}

.secondary-button:hover:not(:disabled) {
  background: var(--color-hover-bg);
  color: var(--color-text-primary);
}

.secondary-button:disabled {
  opacity: 0.6;
  cursor: wait;
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
  white-space: nowrap;
  cursor: pointer;
  transition: background var(--transition-fast),
  color var(--transition-fast),
  border-color var(--transition-fast);
}

.action-button:hover:not(:disabled) {
  background: var(--color-hover-bg);
  color: var(--color-text-primary);
}

.action-button.delete:hover:not(:disabled) {
  background: var(--color-danger-bg);
  border-color: var(--color-danger-light);
  color: var(--color-danger);
}

.action-button:disabled {
  opacity: 0.6;
  cursor: wait;
}

.secondary-button:focus-visible,
.action-button:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* =========================
   Filters
   ========================= */

.filter-card {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
  padding: var(--spacing-xl);
  background: var(--color-surface);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.filter-card label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-secondary);
}

.filter-card select {
  height: 40px;
  min-width: 150px;
  padding: 0 var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  font-family: inherit;
  font-size: var(--font-size-md);
  outline: none;
  cursor: pointer;
  transition: border-color var(--transition-fast),
  box-shadow var(--transition-fast);
}

.filter-card select:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-light);
}

.record-count {
  margin-left: auto;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
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
  white-space: nowrap;
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

.message-cell {
  min-width: 260px;
  white-space: normal;
}

.message-cell strong,
.message-cell span {
  display: block;
}

.message-cell strong {
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.message-cell span {
  margin-top: 4px;
  line-height: 1.5;
  color: var(--color-text-muted);
  overflow-wrap: anywhere;
}

/* =========================
   Badges (same as Users)
   ========================= */

.role-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: var(--radius-full);
  background: var(--color-primary-light);
  color: var(--color-primary);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  text-transform: capitalize;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  white-space: nowrap;
}

.status-badge.unread {
  background: var(--color-success-bg);
  color: var(--color-success);
}

.status-badge.read {
  background: var(--color-hover-bg);
  color: var(--color-text-secondary);
}

/* =========================
   States
   ========================= */

.empty-state,
.empty-cell {
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

  .record-count {
    margin-left: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .secondary-button,
  .action-button,
  .filter-card select,
  tbody tr {
    transition: none;
  }
}
</style>
