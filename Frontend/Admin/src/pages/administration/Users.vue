<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '../../api/axios'

const router = useRouter()

const users = ref([])
const loading = ref(true)
const errorMessage = ref('')
const search = ref('')
const statusFilter = ref('all')

const filteredUsers = computed(() => {
  const term = search.value.toLowerCase().trim()

  return users.value.filter((user) => {
    const matchesSearch =
        !term ||
        String(user.email || '').toLowerCase().includes(term) ||
        (user.roles || []).some(role =>
            String(role.name || '').toLowerCase().includes(term)
        )

    const matchesStatus =
        statusFilter.value === 'all' ||
        (statusFilter.value === 'active' && user.is_active) ||
        (statusFilter.value === 'inactive' && !user.is_active)

    return matchesSearch && matchesStatus
  })
})

const loadUsers = async () => {
  try {
    loading.value = true
    errorMessage.value = ''

    const response = await api.get('/users')

    users.value = response.data.data || []
  } catch (error) {
    console.error('Users loading error:', error)

    errorMessage.value =
        error.response?.data?.message ||
        error.message ||
        'Failed to load users.'
  } finally {
    loading.value = false
  }
}

const goToCreate = () => {
  router.push('/admin/administration/users/create')
}

const editUser = (id) => {
  router.push(`/admin/administration/users/edit/${id}`)
}

const toggleStatus = async (user) => {
  const makeActive = !user.is_active

  if (
      !makeActive &&
      !confirm(`Are you sure you want to deactivate ${user.email}?`)
  ) {
    return
  }

  try {
    await api.put(`/users/${user.id}`, {
      is_active: makeActive
    })

    await loadUsers()
  } catch (error) {
    console.error('Status update error:', error)

    alert(
        error.response?.data?.message ||
        'Failed to update user status.'
    )
  }
}

const formatDate = (date) => {
  if (!date) return 'Never'

  try {
    return new Date(date).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return date
  }
}

onMounted(loadUsers)
</script>

<template>
  <div class="page-container">

    <!-- Header -->
    <div class="page-header">

      <div>
        <h1>Users</h1>

        <p>
          Manage administrator users and their access.
        </p>
      </div>

      <button
          type="button"
          class="primary-button"
          @click="goToCreate"
      >
        + Add User
      </button>

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
            placeholder="Search email or role..."
        />

      </div>


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


    <!-- Table -->
    <div class="table-card">

      <!-- Loading -->
      <div
          v-if="loading"
          class="empty-state"
      >
        Loading users...
      </div>


      <!-- Empty -->
      <div
          v-else-if="!filteredUsers.length"
          class="empty-state"
      >
        No users found.
      </div>


      <!-- Table -->
      <div
          v-else
          class="table-container"
      >

        <table>

          <thead>

          <tr>

            <th>#</th>

            <th>
              Email
            </th>

            <th>
              Role
            </th>

            <th>
              Email Verified
            </th>

            <th>
              Status
            </th>

            <th>
              Last Login
            </th>

            <th>
              Created At
            </th>

            <th>
              Actions
            </th>

          </tr>

          </thead>


          <tbody>

          <tr
              v-for="user in filteredUsers"
              :key="user.id"
          >

            <!-- ID -->
            <td>{{ user.id }}</td>


            <!-- Email -->
            <td>

              <strong>
                {{ user.email }}
              </strong>

            </td>


            <!-- Role -->
            <td>

              <span
                  v-for="role in user.roles"
                  :key="role.id"
                  class="role-badge"
              >
                {{ role.name }}
              </span>

              <span v-if="!user.roles || !user.roles.length">-</span>

            </td>


            <!-- Email Verified -->
            <td>

              <span
                  class="status-badge"
                  :class="user.email_verified_at ? 'verified' : 'unverified'"
              >
                {{ user.email_verified_at ? 'Verified' : 'Not Verified' }}
              </span>

            </td>


            <!-- Status -->
            <td>

              <span
                  class="status-badge"
                  :class="user.is_active ? 'active' : 'inactive'"
              >
                {{ user.is_active ? 'Active' : 'Inactive' }}
              </span>

            </td>


            <!-- Last Login -->
            <td>
              {{ formatDate(user.last_login_at) }}
            </td>


            <!-- Created -->
            <td>
              {{ formatDate(user.created_at) }}
            </td>


            <!-- Actions -->
            <td>

              <div class="action-buttons">

                <button
                    type="button"
                    class="action-button edit"
                    @click="editUser(user.id)"
                >
                  Edit
                </button>


                <button
                    type="button"
                    class="action-button"
                    :class="{ delete: user.is_active }"
                    @click="toggleStatus(user)"
                >
                  {{ user.is_active ? 'Deactivate' : 'Activate' }}
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
  border: none;
  border-radius: var(--radius-lg);
  background: var(--color-primary);
  color: var(--color-text-light);
  font-family: inherit;
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  text-decoration: none;
  white-space: nowrap;
  cursor: pointer;
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
  white-space: nowrap;
  cursor: pointer;
  transition: background var(--transition-fast),
  color var(--transition-fast),
  border-color var(--transition-fast);
}

.action-button:hover {
  background: var(--color-hover-bg);
  color: var(--color-text-primary);
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

/* =========================
   Badges
   ========================= */

.role-badge {
  display: inline-flex;
  align-items: center;
  margin-right: var(--spacing-xs);
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

.status-badge.active,
.status-badge.verified {
  background: var(--color-success-bg);
  color: var(--color-success);
}

.status-badge.inactive,
.status-badge.unverified {
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

@media (max-width: 900px) {
  .filter-card {
    flex-wrap: wrap;
  }

  .search-box {
    flex-basis: 100%;
    max-width: none;
  }
}

@media (max-width: 700px) {
  .page-header,
  .filter-card {
    flex-direction: column;
    align-items: stretch;
  }

  .page-header {
    align-items: flex-start;
  }

  .filter-card select {
    width: 100%;
  }
}
</style>
