<template>
  <div class="page-container">

    <!-- Header -->
    <div class="page-header">

      <div>
        <h1>Customer request notifications</h1>

        <p>
          Choose which customer activity each admin receives.
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


    <!-- Messages -->
    <div
        v-if="error"
        class="error-state"
        role="alert"
    >
      {{ error }}
    </div>

    <div
        v-if="success"
        class="success-state"
        role="status"
    >
      {{ success }}
    </div>


    <!-- Table -->
    <div class="table-card">

      <!-- Loading -->
      <div
          v-if="loading"
          class="empty-state"
          role="status"
      >
        Loading notification settings…
      </div>


      <!-- Table -->
      <div
          v-else
          class="table-container"
      >

        <table>

          <thead>

          <tr>

            <th class="admin-col">
              Admin
            </th>

            <th
                v-for="type in types"
                :key="type.key"
                class="toggle-col"
            >
              {{ type.label }}
            </th>

            <th class="status-col">
              <span class="sr-only">Status</span>
            </th>

          </tr>

          </thead>


          <tbody>

          <tr
              v-for="admin in admins"
              :key="admin.user_id"
          >

            <!-- Admin -->
            <td class="admin-col">

              <strong>
                {{ admin.email }}
              </strong>

            </td>


            <!-- Switches -->
            <td
                v-for="type in types"
                :key="type.key"
                class="toggle-col"
            >

              <input
                  v-model="admin[type.key]"
                  type="checkbox"
                  class="switch"
                  :disabled="savingId === admin.user_id"
                  :aria-label="`${type.label} for ${admin.email}`"
                  @change="save(admin)"
              >

            </td>


            <!-- Saving -->
            <td class="status-col">

              <span
                  v-if="savingId === admin.user_id"
                  class="status-badge saving"
                  role="status"
              >
                Saving…
              </span>

            </td>

          </tr>


          <!-- Empty -->
          <tr v-if="!admins.length">

            <td
                :colspan="types.length + 2"
                class="empty-cell"
            >
              No admin accounts found.
            </td>

          </tr>

          </tbody>

        </table>

      </div>

      <AppPagination :page="page" :page-size="pageSize" :total="pagination.total"
        :total-pages="pagination.totalPages" :loading="loading" @update:page="changePage" @update:page-size="changePageSize" />

    </div>

  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import api from '@/api/axios'
import AppPagination from '@/components/common/AppPagination.vue'
import { createRequestSequence } from '@/composables/useServerPagination.js'
const paginationRequestSequence = createRequestSequence()

const types = [
  { key: 'new_orders', label: 'New orders' },
  { key: 'payments', label: 'Payments' },
  { key: 'deliveries', label: 'Deliveries' },
  { key: 'reviews', label: 'Reviews' },
  { key: 'customer_requests', label: 'Other requests' }
]
const admins = ref([])
const loading = ref(true)
const savingId = ref(null)
const error = ref('')
const success = ref('')
const page = ref(1)
const pageSize = ref(25)
const pagination = ref({ total: 0, totalPages: 1 })

async function load() {
  const requestId = paginationRequestSequence.begin()
  loading.value = true
  error.value = ''
  try {
    const response = await api.get('/notifications/admin/preferences', { params: { page: page.value, pageSize: pageSize.value } })
    if (!paginationRequestSequence.isCurrent(requestId)) return
    admins.value = response.data.data || []
    pagination.value = response.data.pagination || { total: admins.value.length, totalPages: 1 }
  }
  catch (e) {
  if (!paginationRequestSequence.isCurrent(requestId)) return error.value = e.response?.data?.message || 'Unable to load notification settings.' }
  finally {
  if (!paginationRequestSequence.isCurrent(requestId)) return loading.value = false }
}
const changePage = async value => { page.value = value; await load() }
const changePageSize = async value => { pageSize.value = value; page.value = 1; await load() }
async function save(admin) {
  savingId.value = admin.user_id
  error.value = ''
  success.value = ''
  try {
    const payload = { user_id: admin.user_id }
    types.forEach(({ key }) => { payload[key] = admin[key] })
    await api.put('/notifications/admin/preferences', payload)
    success.value = `Settings saved for ${admin.email}.`
  } catch (e) { error.value = e.response?.data?.message || 'Unable to save notification settings.'; await load() }
  finally { savingId.value = null }
}
onMounted(load)
</script>

<style scoped>
.page-container {
  width: 60%;
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

.secondary-button:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
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

.toggle-col {
  text-align: center;
}

.status-col {
  width: 110px;
  text-align: right;
}

/* Admin column stays visible while scrolling sideways on small screens */
.admin-col {
  position: sticky;
  left: 0;
  z-index: 1;
  min-width: 220px;
  background: var(--color-surface);
}

thead .admin-col {
  background: var(--color-hover-bg);
}

tbody tr:hover .admin-col {
  background: var(--color-surface-hover);
}

.empty-cell {
  padding: 50px var(--spacing-xl);
  text-align: center;
  color: var(--color-text-muted);
}

/* =========================
   Toggle switch (still a real checkbox)
   ========================= */

.switch {
  appearance: none;
  position: relative;
  display: inline-block;
  width: 40px;
  height: 22px;
  margin: 0;
  border-radius: var(--radius-full);
  background: var(--color-border);
  cursor: pointer;
  vertical-align: middle;
  transition: background var(--transition-fast);
}

.switch::after {
  content: '';
  position: absolute;
  top: 3px;
  left: 3px;
  width: 16px;
  height: 16px;
  border-radius: var(--radius-full);
  background: var(--color-surface);
  box-shadow: var(--shadow-sm);
  transition: transform var(--transition-fast);
}

.switch:checked {
  background: var(--color-primary);
}

.switch:checked::after {
  transform: translateX(18px);
}

.switch:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 3px;
}

.switch:disabled {
  opacity: 0.55;
  cursor: wait;
}

/* =========================
   Badges + states
   ========================= */

.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  white-space: nowrap;
}

.status-badge.saving {
  background: var(--color-hover-bg);
  color: var(--color-text-secondary);
}

.empty-state {
  padding: 50px var(--spacing-xl);
  text-align: center;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.error-state,
.success-state {
  margin-bottom: var(--spacing-lg);
  padding: var(--spacing-md) var(--spacing-lg);
  border-radius: var(--radius-lg);
  font-size: var(--font-size-sm);
}

.error-state {
  background: var(--color-danger-bg);
  color: var(--color-danger);
}

.success-state {
  background: var(--color-success-bg);
  color: var(--color-success);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}

/* =========================
   Responsive
   ========================= */

@media (max-width: 700px) {
  .page-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .admin-col {
    min-width: 180px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .switch,
  .switch::after,
  .secondary-button,
  tbody tr {
    transition: none;
  }
}
</style>
