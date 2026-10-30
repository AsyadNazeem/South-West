<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import api from '../../services/api'

const router = useRouter()

const notifications = ref([])
const loading = ref(true)
const refreshing = ref(false)
const errorMessage = ref('')
const markingRead = ref({})

const unreadCount = computed(() =>
  notifications.value.filter(item => !item.is_read).length
)

function formatDate(value) {
  if (!value) return 'Date unavailable'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return 'Date unavailable'

  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function isOrderNotification(item) {
  return String(item.reference_type || '').toLowerCase() === 'order'
    && item.reference_id != null
}

async function loadNotifications(isRefresh = false) {
  if (!sessionStorage.getItem('customerToken')) {
    router.replace({
      path: '/login',
      query: { redirect: router.currentRoute.value.fullPath }
    })
    return
  }

  if (isRefresh) refreshing.value = true
  else loading.value = true

  errorMessage.value = ''

  try {
    const response = await api.get('/my/notifications')
    const body = response.data

    notifications.value = Array.isArray(body?.data)
      ? body.data
      : Array.isArray(body?.data?.data)
        ? body.data.data
        : []

    notifications.value.sort((a, b) =>
      new Date(b.created_at || 0).getTime()
      - new Date(a.created_at || 0).getTime()
    )
  } catch (error) {
    errorMessage.value =
      error.response?.data?.message ||
      'Unable to load your notifications. Please try again.'

    if (error.response?.status === 401) {
      sessionStorage.removeItem('customerToken')
      sessionStorage.removeItem('customerProfile')
      router.replace({
        path: '/login',
        query: { redirect: router.currentRoute.value.fullPath }
      })
    }
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

async function markAsRead(item) {
  if (item.is_read || markingRead.value[item.id]) return

  markingRead.value = { ...markingRead.value, [item.id]: true }
  errorMessage.value = ''

  try {
    const response = await api.patch(`/my/notifications/${item.id}/read`)
    const updated = response.data?.data

    notifications.value = notifications.value.map(notification =>
      notification.id === item.id
        ? {
            ...notification,
            is_read: true,
            read_at: updated?.read_at || notification.read_at || new Date().toISOString()
          }
        : notification
    )
  } catch (error) {
    errorMessage.value =
      error.response?.data?.message ||
      'Unable to mark this notification as read.'
  } finally {
    markingRead.value = { ...markingRead.value, [item.id]: false }
  }
}

async function openNotification(item) {
  if (!item.is_read) {
    await markAsRead(item)
  }

  if (isOrderNotification(item)) {
    router.push({
      path: '/account/orders',
      query: { orderId: String(item.reference_id) }
    })
  }
}

onMounted(() => loadNotifications())
</script>

<template>
  <section class="notifications-page">
    <header class="heading">
      <div>
        <h2 class="section-title">Notifications</h2>
        <p class="muted">Stay up to date with your orders and account.</p>
      </div>

      <button
        class="secondary-button"
        type="button"
        :disabled="loading || refreshing"
        @click="loadNotifications(true)"
      >
        {{ refreshing ? 'Refreshing…' : 'Refresh' }}
      </button>
    </header>

    <div v-if="!loading && !errorMessage" class="summary">
      <span>{{ notifications.length }} total</span>
      <span class="unread-count">{{ unreadCount }} unread</span>
    </div>

    <div v-if="loading" class="state" aria-live="polite">
      Loading your notifications…
    </div>

    <div v-else-if="errorMessage" class="state error" role="alert">
      <p>{{ errorMessage }}</p>
      <button
        class="secondary-button"
        type="button"
        @click="loadNotifications()"
      >
        Try again
      </button>
    </div>

    <div v-else-if="notifications.length === 0" class="empty-state">
      <div class="empty-icon" aria-hidden="true">♧</div>
      <h3>You're all caught up</h3>
      <p class="muted">New order and account updates will appear here.</p>
    </div>

    <div v-else class="notification-list">
      <article
        v-for="item in notifications"
        :key="item.id"
        class="notification-card"
        :class="{ unread: !item.is_read }"
      >
        <span
          class="unread-dot"
          :class="{ invisible: item.is_read }"
          aria-hidden="true"
        ></span>

        <div class="notification-content">
          <div class="notification-heading">
            <h3>{{ item.title }}</h3>
            <span v-if="!item.is_read" class="badge">New</span>
          </div>

          <p class="message">{{ item.message }}</p>
          <time class="date" :datetime="item.created_at">
            {{ formatDate(item.created_at) }}
          </time>

          <div class="actions">
            <button
              v-if="!item.is_read"
              type="button"
              class="text-button"
              :disabled="markingRead[item.id]"
              @click="markAsRead(item)"
            >
              {{ markingRead[item.id] ? 'Saving…' : 'Mark as read' }}
            </button>

            <button
              v-if="isOrderNotification(item)"
              type="button"
              class="text-button"
              @click="openNotification(item)"
            >
              View order
            </button>
          </div>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.notifications-page {
  min-width: 0;
  color: var(--color-text);
}

.heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
}

.section-title {
  margin: 0 0 6px;
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
}

.muted {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  line-height: 1.6;
}

.secondary-button {
  flex-shrink: 0;
  padding: 9px 13px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text);
  cursor: pointer;
}

.secondary-button:disabled,
.text-button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.unread-count,
.badge {
  color: var(--color-primary);
  font-weight: var(--font-weight-semibold);
}

.notification-list {
  display: grid;
  gap: 12px;
}

.notification-card {
  display: flex;
  gap: 12px;
  padding: 16px;
  border: 1px solid var(--color-border-soft);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.notification-card.unread {
  border-color: var(--color-border);
  background: var(--color-store-bg);
}

.unread-dot {
  flex: 0 0 9px;
  width: 9px;
  height: 9px;
  margin-top: 7px;
  border-radius: 50%;
  background: var(--color-primary);
}

.invisible {
  visibility: hidden;
}

.notification-content {
  flex: 1;
  min-width: 0;
}

.notification-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.notification-heading h3 {
  margin: 0;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  overflow-wrap: anywhere;
}

.badge {
  font-size: var(--font-size-xs);
}

.message {
  margin: 8px 0;
  font-size: var(--font-size-sm);
  line-height: 1.65;
  overflow-wrap: anywhere;
}

.date {
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  margin-top: 12px;
}

.text-button {
  padding: 0;
  border: 0;
  background: none;
  color: var(--color-primary);
  font: inherit;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  text-align: left;
  cursor: pointer;
}

.state,
.empty-state {
  padding: 32px 16px;
  text-align: center;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.error {
  color: var(--color-danger);
}

.empty-state h3 {
  margin: 12px 0 8px;
  color: var(--color-text);
  font-size: var(--font-size-md);
}

.empty-icon {
  font-size: 30px;
  color: var(--color-primary);
}

@media (max-width: 480px) {
  .heading {
    flex-direction: column;
  }

  .notification-card {
    padding: 13px;
  }
}
</style>
