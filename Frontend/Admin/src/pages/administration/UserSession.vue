<template>
  <div class="user-sessions-page">

    <!-- Header -->
    <div class="page-header">
      <div>
        <h1>User Sessions</h1>

        <p v-if="user">
          Active sessions for {{ user.email }}
        </p>

        <p v-else>
          Manage active sessions for this user
        </p>
      </div>

      <!-- Revoke All -->
      <button
          v-if="hasPermission('user_sessions.revoke') && sessions.length > 0"
          class="btn btn-danger"
          @click="revokeAll"
          :disabled="revokingAll"
      >
        {{
          revokingAll
              ? 'Revoking...'
              : 'Revoke All Sessions'
        }}
      </button>
    </div>

    <!-- No View Permission -->
    <div
        v-if="!hasPermission('user_sessions.view')"
        class="error-message"
    >
      You do not have permission to view user sessions.
    </div>

    <!-- Loading -->
    <div
        v-else-if="loading"
        class="loading"
    >
      Loading sessions...
    </div>

    <!-- Error -->
    <div
        v-else-if="error"
        class="error-message"
    >
      {{ error }}
    </div>

    <!-- Empty -->
    <div
        v-else-if="sessions.length === 0"
        class="empty-state"
    >
      <h3>No active sessions</h3>

      <p>
        This user currently has no active sessions.
      </p>
    </div>

    <!-- Sessions -->
    <div
        v-else
        class="sessions-card"
    >

      <table class="sessions-table">

        <thead>
        <tr>
          <th>Session</th>
          <th>IP Address</th>
          <th>User Agent</th>
          <th>Created</th>
          <th>Expires</th>
          <th>Status</th>

          <th v-if="hasPermission('user_sessions.revoke')">
            Action
          </th>
        </tr>
        </thead>

        <tbody>

        <tr
            v-for="session in sessions"
            :key="session.id"
        >

          <!-- Session -->
          <td>
            <div class="session-info">

              <strong>
                Session #{{ session.id }}
              </strong>

              <small>
                ID: {{ session.id }}
              </small>

            </div>
          </td>

          <!-- IP -->
          <td>
            {{ session.ip_address || 'Unknown' }}
          </td>

          <!-- User Agent -->
          <td>
            <div class="user-agent">
              {{ session.user_agent || 'Unknown' }}
            </div>
          </td>

          <!-- Created -->
          <td>
            {{ formatDate(session.created_at) }}
          </td>

          <!-- Expires -->
          <td>
            {{ formatDate(session.expires_at) }}
          </td>

          <!-- Status -->
          <td>
              <span
                  class="status-badge"
                  :class="getStatusClass(session)"
              >
                {{ getStatus(session) }}
              </span>
          </td>

          <!-- Action -->
          <td
              v-if="hasPermission('user_sessions.revoke')"
          >

            <button
                v-if="!session.revoked_at"
                class="btn btn-warning"
                @click="revokeSession(session)"
                :disabled="revokingId === session.id"
            >
              {{
                revokingId === session.id
                    ? 'Revoking...'
                    : 'Revoke'
              }}
            </button>

            <span v-else>
                Revoked
              </span>

          </td>

        </tr>

        </tbody>

      </table>

      <AppPagination :page="page" :page-size="pageSize" :total="pagination.total"
        :total-pages="pagination.totalPages" :loading="loading" @update:page="changePage" @update:page-size="changePageSize" />
    </div>

  </div>
</template>


<script setup>

import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import AppPagination from '@/components/common/AppPagination.vue'

import {
  hasPermission
} from '@/auth/authorization.js'
import { createRequestSequence } from '@/composables/useServerPagination.js'
const paginationRequestSequence = createRequestSequence()


/*
|--------------------------------------------------------------------------
| Router
|--------------------------------------------------------------------------
*/

const route = useRoute()


/*
|--------------------------------------------------------------------------
| State
|--------------------------------------------------------------------------
*/

const sessions = ref([])
const user = ref(null)

const loading = ref(false)
const error = ref('')
const page = ref(1)
const pageSize = ref(25)
const pagination = ref({ total: 0, totalPages: 1 })

const revokingId = ref(null)
const revokingAll = ref(false)


/*
|--------------------------------------------------------------------------
| API
|--------------------------------------------------------------------------
*/

const API_URL = import.meta.env.VITE_API_URL


/*
|--------------------------------------------------------------------------
| User ID
|--------------------------------------------------------------------------
*/

const userId = computed(() =>
  route.params.userId ??
  route.params.id ??
  route.query.userId ??
  route.query.id
)


/*
|--------------------------------------------------------------------------
| Authentication Token
|--------------------------------------------------------------------------
*/

const getToken = () => {
  return (
      localStorage.getItem('accessToken') ||
      localStorage.getItem('token')
  )
}


/*
|--------------------------------------------------------------------------
| Fetch Sessions
|--------------------------------------------------------------------------
*/

const fetchSessions = async () => {
  const requestId = paginationRequestSequence.begin()

  loading.value = true
  error.value = ''

  try {

    const token = getToken()

    if (!token) {
      throw new Error(
          'Authentication token not found.'
      )
    }

    const id = userId.value

if (!id || !/^[1-9]\d*$/.test(String(id))) {
  throw new Error(
    'User ID is missing from the route. Open sessions from the Users page.'
  )
}

    const params = new URLSearchParams({ page: String(page.value), pageSize: String(pageSize.value) })
    const response = await fetch(
  `${API_URL}/users/${id}/sessions?${params}`,
  {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  }
)
    if (!paginationRequestSequence.isCurrent(requestId)) return
    const result = await response.json()
  if (!paginationRequestSequence.isCurrent(requestId)) return

    if (!response.ok) {

      throw new Error(
          result.message ||
          'Failed to load sessions'
      )

    }

    sessions.value = result.data || []
    pagination.value = result.pagination || { total: sessions.value.length, totalPages: 1 }

  } catch (err) {
    if (!paginationRequestSequence.isCurrent(requestId)) return

    console.error(
        'Fetch sessions error:',
        err
    )

    error.value =
        err.message ||
        'Failed to load user sessions'

  } finally {
    if (!paginationRequestSequence.isCurrent(requestId)) return

    loading.value = false

  }

}

const changePage = async value => { page.value = value; await fetchSessions() }
const changePageSize = async value => { pageSize.value = value; page.value = 1; await fetchSessions() }

/*
|--------------------------------------------------------------------------
| Revoke Session
|--------------------------------------------------------------------------
*/

const revokeSession = async (session) => {

  if (
      !hasPermission('user_sessions.revoke')
  ) {

    alert(
        'You do not have permission to revoke sessions.'
    )

    return

  }


  const confirmed = confirm(
      `Are you sure you want to revoke session #${session.id}?`
  )

  if (!confirmed) {
    return
  }


  revokingId.value = session.id


  try {

    const token = getToken()

    if (!token) {
      throw new Error(
          'Authentication token not found.'
      )
    }


    const response = await fetch(
        `${API_URL}/sessions/${session.id}/revoke`,
        {
          method: 'PUT',

          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
    )


    const result = await response.json()


    if (!response.ok) {

      throw new Error(
          result.message ||
          'Failed to revoke session'
      )

    }


    /*
    |--------------------------------------------------------------------------
    | Remove revoked session from active list
    |--------------------------------------------------------------------------
    */

    sessions.value =
        sessions.value.filter(
            item => item.id !== session.id
        )


  } catch (err) {

    console.error(
        'Revoke session error:',
        err
    )

    alert(
        err.message ||
        'Failed to revoke session'
    )

  } finally {

    revokingId.value = null

  }

}


/*
|--------------------------------------------------------------------------
| Revoke All Sessions
|--------------------------------------------------------------------------
*/

const revokeAll = async () => {

  if (
      !hasPermission('user_sessions.revoke')
  ) {

    alert(
        'You do not have permission to revoke sessions.'
    )

    return

  }


  const confirmed = confirm(
      'Are you sure you want to revoke all active sessions for this user?'
  )

  if (!confirmed) {
    return
  }


  revokingAll.value = true


  try {

    const token = getToken()

    if (!token) {
      throw new Error(
          'Authentication token not found.'
      )
    }


    const response = await fetch(
`${API_URL}/users/${userId.value}/sessions/revoke-all`,
        {
          method: 'PUT',

          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
    )


    const result = await response.json()


    if (!response.ok) {

      throw new Error(
          result.message ||
          'Failed to revoke sessions'
      )

    }


    sessions.value = []


  } catch (err) {

    console.error(
        'Revoke all sessions error:',
        err
    )

    alert(
        err.message ||
        'Failed to revoke sessions'
    )

  } finally {

    revokingAll.value = false

  }

}


/*
|--------------------------------------------------------------------------
| Date Formatting
|--------------------------------------------------------------------------
*/

const formatDate = (date) => {

  if (!date) {
    return 'N/A'
  }


  const parsedDate = new Date(date)


  if (Number.isNaN(parsedDate.getTime())) {
    return 'N/A'
  }


  return parsedDate.toLocaleString()

}


/*
|--------------------------------------------------------------------------
| Session Status
|--------------------------------------------------------------------------
*/

const getStatus = (session) => {

  if (session.revoked_at) {
    return 'Revoked'
  }


  if (
      session.expires_at &&
      new Date(session.expires_at) < new Date()
  ) {

    return 'Expired'

  }


  return 'Active'

}


/*
|--------------------------------------------------------------------------
| Status CSS Class
|--------------------------------------------------------------------------
*/

const getStatusClass = (session) => {

  const status = getStatus(session)


  if (status === 'Active') {
    return 'active'
  }


  if (status === 'Expired') {
    return 'expired'
  }


  return 'revoked'

}


/*
|--------------------------------------------------------------------------
| Load Page
|--------------------------------------------------------------------------
*/

onMounted(async () => {

  /*
  |--------------------------------------------------------------------------
  | Check View Permission
  |--------------------------------------------------------------------------
  */

  if (
      !hasPermission('user_sessions.view')
  ) {

    error.value =
        'You do not have permission to view user sessions.'

    return

  }


  /*
  |--------------------------------------------------------------------------
  | Load Sessions
  |--------------------------------------------------------------------------
  */

  await fetchSessions()

})

</script>


<style scoped>
.user-sessions-page {
  width: 100%;
  font-family: var(--font-family);
}

/* =========================
   Page Header
   ========================= */

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-lg);
  margin-bottom: var(--spacing-2xl);
}

.page-header h1 {
  margin: 0;
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
}

.page-header p {
  margin: 5px 0 0;
  font-size: var(--font-size-md);
  color: var(--color-text-secondary);
}

/* =========================
   Card / Table
   ========================= */

.sessions-card {
  width: 100%;
  overflow-x: auto;
  background: var(--color-surface);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.sessions-table {
  width: 100%;
  border-collapse: collapse;
}

.sessions-table th {
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

.sessions-table td {
  padding: 14px var(--spacing-lg);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  border-bottom: 1px solid var(--color-border-light);
  vertical-align: middle;
}

.sessions-table tbody tr {
  transition: background var(--transition-fast);
}

.sessions-table tbody tr:hover {
  background: var(--color-surface-hover);
}

.sessions-table tbody tr:last-child td {
  border-bottom: none;
}

/* =========================
   Session Information
   ========================= */

.session-info {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.session-info strong {
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.session-info small {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.user-agent {
  max-width: 300px;
  font-size: var(--font-size-xs);
  line-height: 1.5;
  word-break: break-word;
}

/* =========================
   Buttons
   ========================= */

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md);
  padding: 6px var(--spacing-md);
  font-family: inherit;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  white-space: nowrap;
  cursor: pointer;
  transition: background var(--transition-fast),
  color var(--transition-fast),
  border-color var(--transition-fast);
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Row action: Revoke */
.btn-warning {
  background: var(--color-surface);
  color: var(--color-text-secondary);
}

.btn-warning:hover:not(:disabled) {
  background: var(--color-danger-bg);
  border-color: var(--color-danger-light);
  color: var(--color-danger);
}

/* Header action: Revoke All Sessions */
.btn-danger {
  height: 40px;
  padding: 0 var(--spacing-lg);
  border: none;
  border-radius: var(--radius-lg);
  background: var(--color-danger);
  color: var(--color-text-light);
  font-size: var(--font-size-md);
}

.btn-danger:hover:not(:disabled) {
  opacity: 0.9;
}

/* =========================
   Status Badge
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

.status-badge.active {
  background: var(--color-success-bg);
  color: var(--color-success);
}

.status-badge.expired {
  background: var(--color-warning-bg, #fef3c7);
  color: var(--color-warning, #92400e);
}

.status-badge.revoked {
  background: var(--color-danger-bg);
  color: var(--color-danger);
}

/* =========================
   States
   ========================= */

.loading {
  padding: 50px var(--spacing-xl);
  text-align: center;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  background: var(--color-surface);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.error-message {
  margin-bottom: var(--spacing-lg);
  padding: var(--spacing-md) var(--spacing-lg);
  border: 1px solid var(--color-danger-light);
  border-radius: var(--radius-lg);
  background: var(--color-danger-bg);
  color: var(--color-danger);
  font-size: var(--font-size-sm);
}

.empty-state {
  padding: 50px var(--spacing-xl);
  text-align: center;
  background: var(--color-surface);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.empty-state h3 {
  margin: 0 0 var(--spacing-sm);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.empty-state p {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

/* =========================
   Responsive
   ========================= */

@media (max-width: 700px) {
  .page-header {
    flex-direction: column;
    align-items: stretch;
  }

  .btn-danger {
    width: 100%;
  }
}
</style>
