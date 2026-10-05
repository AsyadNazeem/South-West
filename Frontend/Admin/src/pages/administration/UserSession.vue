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

    </div>

  </div>
</template>


<script setup>

import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'

import {
  hasPermission
} from '../../auth/authorization.js'


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

const userId = route.params.userId


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

  loading.value = true
  error.value = ''

  try {

    const token = getToken()

    if (!token) {
      throw new Error(
          'Authentication token not found.'
      )
    }

    const response = await fetch(
        `${API_URL}/users/${userId}/sessions`,
        {
          method: 'GET',

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
          'Failed to load sessions'
      )

    }

    sessions.value = result.data || []

  } catch (err) {

    console.error(
        'Fetch sessions error:',
        err
    )

    error.value =
        err.message ||
        'Failed to load user sessions'

  } finally {

    loading.value = false

  }

}


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
        `${API_URL}/users/${userId}/sessions/revoke-all`,
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
  padding: 24px;
}


/*
|--------------------------------------------------------------------------
| Header
|--------------------------------------------------------------------------
*/

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 24px;
}

.page-header h1 {
  margin: 0 0 6px;
}

.page-header p {
  margin: 0;
  color: #666;
}


/*
|--------------------------------------------------------------------------
| Card
|--------------------------------------------------------------------------
*/

.sessions-card {
  width: 100%;
  overflow-x: auto;
  background: #fff;
  border-radius: 10px;
  border: 1px solid #e5e7eb;
}


/*
|--------------------------------------------------------------------------
| Table
|--------------------------------------------------------------------------
*/

.sessions-table {
  width: 100%;
  border-collapse: collapse;
}

.sessions-table th,
.sessions-table td {
  padding: 14px 16px;
  text-align: left;
  border-bottom: 1px solid #eee;
}

.sessions-table th {
  font-weight: 600;
  background: #f8f9fa;
}


/*
|--------------------------------------------------------------------------
| Session Information
|--------------------------------------------------------------------------
*/

.session-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.session-info small {
  color: #777;
}


/*
|--------------------------------------------------------------------------
| User Agent
|--------------------------------------------------------------------------
*/

.user-agent {
  max-width: 300px;
  word-break: break-word;
  font-size: 13px;
}


/*
|--------------------------------------------------------------------------
| Buttons
|--------------------------------------------------------------------------
*/

.btn {
  border: none;
  border-radius: 6px;
  padding: 8px 14px;
  cursor: pointer;
  font-size: 14px;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-warning {
  background: #f59e0b;
  color: #fff;
}

.btn-danger {
  background: #dc2626;
  color: #fff;
}


/*
|--------------------------------------------------------------------------
| Status
|--------------------------------------------------------------------------
*/

.status-badge {
  display: inline-block;
  padding: 5px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
}

.status-badge.active {
  background: #dcfce7;
  color: #166534;
}

.status-badge.expired {
  background: #fef3c7;
  color: #92400e;
}

.status-badge.revoked {
  background: #fee2e2;
  color: #991b1b;
}


/*
|--------------------------------------------------------------------------
| Loading
|--------------------------------------------------------------------------
*/

.loading {
  padding: 40px;
  text-align: center;
  color: #666;
}


/*
|--------------------------------------------------------------------------
| Error
|--------------------------------------------------------------------------
*/

.error-message {
  padding: 20px;
  border-radius: 8px;
  background: #fee2e2;
  color: #991b1b;
}


/*
|--------------------------------------------------------------------------
| Empty
|--------------------------------------------------------------------------
*/

.empty-state {
  padding: 60px 20px;
  text-align: center;
  background: #f9fafb;
  border-radius: 10px;
}

.empty-state h3 {
  margin-bottom: 8px;
}

.empty-state p {
  color: #666;
}

</style>
