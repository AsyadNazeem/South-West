<script setup>
import AccountPageHeader from '@/components/account/AccountPageHeader.vue'
import { accountFeedback } from '@/utils/accountFeedback'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/services/api'

const router = useRouter()

const notifications = ref([])
const loading = ref(true)
const refreshing = ref(false)
const errorMessage = ref('')
const markingRead = ref({})

const unreadCount = computed(() =>
  notifications.value.filter(item => !item.is_read).length
)


const activeTab = ref('all')

const visibleNotifications = computed(() =>
  activeTab.value === 'unread'
    ? notifications.value.filter(item => !item.is_read)
    : notifications.value
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
      accountFeedback(error, 'Unable to load your notifications. Please try again.')

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
      accountFeedback(error, 'Unable to mark this notification as read.')
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
    <AccountPageHeader title="Notifications" description="Order updates and messages from South West.">
      <button class="btn" type="button" :disabled="loading || refreshing" @click="loadNotifications(true)">
        {{ refreshing ? 'Refreshing…' : 'Refresh' }}
      </button>
    </AccountPageHeader>

    <div v-if="!loading && !errorMessage && notifications.length" class="tabs" role="group" aria-label="Filter notifications">
      <button type="button" class="tab" :class="{ active: activeTab === 'all' }" :aria-pressed="activeTab === 'all'" @click="activeTab = 'all'">
        All<span class="count">{{ notifications.length }}</span>
      </button>
      <button type="button" class="tab" :class="{ active: activeTab === 'unread' }" :aria-pressed="activeTab === 'unread'" @click="activeTab = 'unread'">
        Unread<span class="count" :class="{ hot: unreadCount }">{{ unreadCount }}</span>
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="list" aria-busy="true" aria-label="Loading your notifications">
      <div v-for="n in 3" :key="n" class="row skeleton" aria-hidden="true">
        <span class="icon skeleton-line"></span>
        <div class="body"><div class="skeleton-line short"></div><div class="skeleton-line"></div></div>
      </div>
    </div>

    <!-- Error -->
    <div v-else-if="errorMessage" class="state" role="alert">
      <h3>Something went wrong</h3>
      <p class="muted">{{ errorMessage }}</p>
      <button class="btn" type="button" @click="loadNotifications()">Try again</button>
    </div>

    <!-- Empty -->
    <div v-else-if="notifications.length === 0" class="state">
      <h3>You're all caught up</h3>
      <p class="muted">New order and account updates will appear here.</p>
      <RouterLink class="btn" to="/account/orders">View my orders</RouterLink>
    </div>

    <div v-else-if="visibleNotifications.length === 0" class="state">
      <h3>No unread notifications</h3>
      <p class="muted">You've read everything.</p>
      <button class="btn" type="button" @click="activeTab = 'all'">Show all</button>
    </div>

    <!-- List -->
    <div v-else class="list">
      <article v-for="item in visibleNotifications" :key="item.id" class="row" :class="{ unread: !item.is_read }">

        <span class="icon" aria-hidden="true">
          <svg v-if="isOrderNotification(item)" viewBox="0 0 24 24">
            <path d="M3 7l9-4 9 4v11l-9 4-9-4z M3 7l9 4 9-4 M12 11v11" />
          </svg>
          <svg v-else viewBox="0 0 24 24">
            <path d="M4 17h16l-2-3V9a6 6 0 0 0-12 0v5z M10 20a2 2 0 0 0 4 0" />
          </svg>
        </span>

        <div class="body">
          <div class="top">
            <h3>{{ item.title }}</h3>
            <span v-if="!item.is_read" class="new">New</span>
          </div>
          <p class="message">{{ item.message }}</p>

          <div v-if="!item.is_read || isOrderNotification(item)" class="actions">
            <button v-if="isOrderNotification(item)" type="button" class="link-button" @click="openNotification(item)">
              View order →
            </button>
            <button v-if="!item.is_read" type="button" class="link-button quiet" :disabled="markingRead[item.id]" @click="markAsRead(item)">
              {{ markingRead[item.id] ? 'Saving…' : 'Mark as read' }}
            </button>
          </div>
        </div>

        <time class="date" :datetime="item.created_at">{{ formatDate(item.created_at) }}</time>
      </article>
    </div>
  </section>
</template>

<style scoped>
.notifications-page { min-width: 0; color: var(--color-text); }
.muted { margin: 0; color: var(--color-text-muted); font-size: 13px; }
button:disabled { cursor: not-allowed; opacity: .55; }

/* Buttons */
.btn { display: inline-flex; align-items: center; justify-content: center; min-height: 36px; padding: 0 14px; background: var(--color-surface); color: var(--color-text); border: 1px solid var(--color-border); border-radius: var(--radius-md); font: 600 13px/1 var(--font-family-base); text-decoration: none; white-space: nowrap; cursor: pointer; transition: border-color .15s ease, color .15s ease; }
.btn:hover:not(:disabled) { border-color: var(--color-primary); color: var(--color-primary); }
.link-button { padding: 4px 0; background: none; border: 0; color: var(--color-primary); font: 600 13px/1.4 var(--font-family-base); white-space: nowrap; cursor: pointer; }
.link-button:hover:not(:disabled) { text-decoration: underline; }
.link-button.quiet { color: var(--color-text-muted); font-weight: 500; }
.link-button.quiet:hover:not(:disabled) { color: var(--color-text); }

/* Tabs */
.tabs { display: flex; gap: 22px; margin-bottom: 14px; border-bottom: 1px solid var(--color-border-soft); }
.tab { display: inline-flex; align-items: center; gap: 7px; margin-bottom: -1px; padding: 10px 0; background: none; border: 0; border-bottom: 2px solid transparent; color: var(--color-text-muted); font: 600 14px/1 var(--font-family-base); cursor: pointer; }
.tab:hover:not(.active) { color: var(--color-text); }
.tab.active { color: var(--color-primary); border-bottom-color: var(--color-primary); }
.count { min-width: 20px; padding: 2px 6px; background: var(--color-surface-muted); color: var(--color-text-muted); border-radius: var(--radius-pill); font-size: 11px; font-weight: 600; text-align: center; }
.count.hot { background: var(--color-primary); color: var(--color-on-primary); }

/* List */
.list { overflow: hidden; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-lg); box-shadow: var(--shadow-sm); }

.row { position: relative; display: grid; grid-template-columns: 36px minmax(0, 1fr) auto; align-items: start; gap: 14px; padding: 16px 18px; border-bottom: 1px solid var(--color-border-soft); }
.row:last-child { border-bottom: 0; }

/* Read: calm and muted */
.row:not(.unread) { background: var(--color-surface-muted); }
.row:not(.unread) .message { color: var(--color-text-muted); }

/* Unread: white, bold, accent bar */
.row.unread { background: var(--color-surface); }
.row.unread::before { content: ''; position: absolute; top: 0; bottom: 0; left: 0; width: 3px; background: var(--color-primary); }

.icon { display: grid; place-items: center; width: 36px; height: 36px; background: var(--color-border-soft); color: var(--color-text-muted); border-radius: 50%; }
.icon svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
.row.unread .icon { background: var(--color-primary); color: var(--color-on-primary); }

.body { min-width: 0; }
.top { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.top h3 { margin: 0; font-size: 14px; font-weight: 600; line-height: 1.4; overflow-wrap: anywhere; }
.row.unread .top h3 { font-weight: 700; }
.new { padding: 2px 8px; background: color-mix(in srgb, var(--color-primary) 10%, var(--color-surface)); color: var(--color-primary); border-radius: var(--radius-pill); font-size: 11px; font-weight: 700; }

.message { margin: 4px 0 0; color: var(--color-text); font-size: 14px; line-height: 1.55; overflow-wrap: anywhere; }
.actions { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 18px; margin-top: 8px; }
.date { padding-top: 2px; color: var(--color-text-muted); font-size: 12px; font-variant-numeric: tabular-nums; white-space: nowrap; }

/* States */
.state { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 48px 20px; text-align: center; background: var(--color-surface); border: 1px solid var(--color-border-soft); border-radius: var(--radius-lg); }
.state h3 { margin: 0; font-family: var(--font-family-display); font-size: 16px; }
.state .muted { margin-bottom: 10px; }

/* Loading */
.skeleton-line { height: 11px; margin-top: 8px; background: var(--color-border-soft); border-radius: 4px; animation: pulse 1.4s ease-in-out infinite; }
.skeleton-line:first-child { margin-top: 0; }
.skeleton-line.short { width: 35%; }
.icon.skeleton-line { margin: 0; background: var(--color-border-soft); }
.row.skeleton { grid-template-columns: 36px minmax(0, 1fr); }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .5; } }

.btn:focus-visible, .tab:focus-visible, .link-button:focus-visible { outline: 2px solid var(--color-focus-outline); outline-offset: 2px; }

@media (max-width: 560px) {
  .row { grid-template-columns: 36px minmax(0, 1fr); gap: 12px; padding: 14px; }
  .date { grid-column: 2; grid-row: 2; padding-top: 0; }
  .body { grid-row: 1; grid-column: 2; }
}

@media (prefers-reduced-motion: reduce) { .skeleton-line { animation: none; } }
</style>
