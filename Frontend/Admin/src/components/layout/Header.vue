<template>
  <header class="header">

    <div class="header-left">

      <!-- Mobile Menu Button -->
      <button
          class="mobile-menu-button"
          type="button"
          aria-label="Open navigation"
          @click="handleMenuClick"
      >
        <Menu :size="21" :stroke-width="1.8" />
      </button>

      <h1>Admin Panel</h1>

    </div>

    <div class="header-user">

      <div
    v-if="canViewNotifications"
    ref="notificationWrapper"
    class="notification-wrapper"
>
    <button
        type="button"
        class="icon-button notification-button"
        aria-label="Notifications"
        :aria-expanded="showNotifications"
        @click="toggleNotifications"
    >
        <Bell :size="20" :stroke-width="1.75" />

        <span
            v-if="unreadCount > 0"
            class="notification-badge"
        >
            {{ unreadCount > 99 ? '99+' : unreadCount }}
        </span>
    </button>

    <div
        v-if="showNotifications"
        class="notification-panel"
        :class="{ 'mobile-notification-panel': isMobile }"
    >
        <div class="notification-panel-header">
            <h2>Notifications</h2>

            <button
                type="button"
                class="notification-close"
                aria-label="Close notifications"
                @click="closeNotifications"
            >
                <span v-if="isMobile">Back</span>
                <span v-else>×</span>
            </button>
        </div>

        <AdminNotificationsFeed @updated="refreshUnreadCount" @history="closeNotifications" />
    </div>
</div>

      <span class="divider"></span>

      <div class="user-profile">

        <div class="avatar">
          {{ initial }}
        </div>

        <div class="user-info">
          <strong>
            {{ user?.email || "Administrator" }}
          </strong>

          <span>
            Administrator
          </span>
        </div>

      </div>

    </div>

  </header>
</template>

<script setup>
import {
  computed,
  ref,
  onMounted,
  onUnmounted,
  defineAsyncComponent
} from 'vue'
import { Menu, Bell } from 'lucide-vue-next'
import api from '@/api/axios'
const AdminNotificationsFeed = defineAsyncComponent(() =>
  import('@/pages/administration/AdminNotificationsFeed.vue')
)
import { hasPermission } from '@/auth/authorization'

defineProps({
  sidebarCollapsed: { type: Boolean, default: false }
})

const emit = defineEmits(['toggle-sidebar', 'toggle-mobile-sidebar'])

const handleMenuClick = () => {
  if (window.innerWidth <= 768) {
    emit('toggle-mobile-sidebar')
  } else {
    emit('toggle-sidebar')
  }
}

const user = computed(() => {
  const storedUser = localStorage.getItem('user')

  return storedUser
      ? JSON.parse(storedUser)
      : null
})

const initial = computed(() =>
    (user.value?.email || 'A').charAt(0).toUpperCase()
)
const canViewNotifications = computed(() => hasPermission('notifications.view'))

const showNotifications = ref(false)
const notificationWrapper = ref(null)
const isMobile = ref(false)

function updateNotificationLayout() {
    isMobile.value = window.matchMedia('(max-width: 767px)').matches
}

function toggleNotifications() {
    updateNotificationLayout()
    showNotifications.value = !showNotifications.value
}

function closeNotifications() {
    showNotifications.value = false
}

function handleNotificationOutsideClick(event) {
    if (
        showNotifications.value &&
        notificationWrapper.value &&
        !notificationWrapper.value.contains(event.target)
    ) {
        closeNotifications()
    }
}

function handleNotificationEscape(event) {
    if (event.key === 'Escape') {
        closeNotifications()
    }
}

const unreadCount = ref(0)
let refreshTimer
async function refreshUnreadCount() {
  if (!canViewNotifications.value) { unreadCount.value = 0; return }
  try {
    const response = await api.get('/notifications/admin/unread-count')
    const count = Number(response.data?.count)
    if (Number.isFinite(count) && count >= 0) unreadCount.value = count
  } catch {
    // Keep the last known badge count if a refresh fails.
  }
}
const handleNotificationsUpdated = () => refreshUnreadCount()
onMounted(() => {
    refreshUnreadCount()
    refreshTimer = window.setInterval(refreshUnreadCount, 60000)
    window.addEventListener('admin-notifications-updated', handleNotificationsUpdated)
})
onUnmounted(() => {
    window.clearInterval(refreshTimer)
    window.removeEventListener('admin-notifications-updated', handleNotificationsUpdated)
})

onMounted(() => {
    updateNotificationLayout()
    window.addEventListener('resize', updateNotificationLayout)
    document.addEventListener('pointerdown', handleNotificationOutsideClick)
    document.addEventListener('keydown', handleNotificationEscape)
})

onUnmounted(() => {
    window.removeEventListener('resize', updateNotificationLayout)
    document.removeEventListener('pointerdown', handleNotificationOutsideClick)
    document.removeEventListener('keydown', handleNotificationEscape)
})

</script>

<style scoped>
.header {
  height: var(--topbar-height);
  position: sticky;
  top: 0;
  z-index: 900;

  display: flex;
  align-items: center;
  justify-content: space-between;

  padding: 0 var(--content-padding);

  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);

  transition:
      padding var(--transition-normal),
      height var(--transition-normal);
}

/* =========================================
   HEADER LEFT
========================================= */

.header-left {
  display: flex;
  align-items: center;
  gap: var(--spacing-lg);

  min-width: 0;
}

.header-left h1 {
  margin: 0;

  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);

  color: var(--color-text-primary);

  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* =========================================
   HEADER USER
========================================= */

.header-user {
  display: flex;
  align-items: center;
  gap: var(--spacing-lg);

  min-width: 0;
}

/* =========================================
   ICON BUTTON
========================================= */

.icon-button {
  width: 40px;
  height: 40px;

  position: relative;

  display: flex;
  align-items: center;
  justify-content: center;

  flex-shrink: 0;

  border: none;
  border-radius: var(--radius-lg);

  background: transparent;
  color: var(--color-text-secondary);

  cursor: pointer;

  transition:
      background var(--transition-normal),
      color var(--transition-normal);
}

.icon-button:hover {
  background: var(--color-surface-hover);
  color: var(--color-text-primary);
}

.icon-button:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* =========================================
   NOTIFICATION BADGE
========================================= */

.notification-badge {
  min-width: 18px;
  height: 18px;

  position: absolute;
  top: 3px;
  right: 3px;

  padding: 0 5px;

  display: flex;
  align-items: center;
  justify-content: center;

  border-radius: var(--radius-full);
  border: 2px solid var(--color-surface);

  background: var(--color-danger);
  color: var(--color-text-light);

  font-size: 10px;
  font-weight: var(--font-weight-bold);
  line-height: 1;
}

/* =========================================
   DIVIDER
========================================= */

.divider {
  width: 1px;
  height: 28px;

  flex-shrink: 0;

  background: var(--color-border);
}

/* =========================================
   USER PROFILE
========================================= */

.user-profile {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);

  min-width: 0;
}

/* =========================================
   AVATAR
========================================= */

.avatar {
  width: 36px;
  height: 36px;

  flex-shrink: 0;

  display: flex;
  align-items: center;
  justify-content: center;

  border-radius: var(--radius-full);

  background: var(--color-primary-light);
  color: var(--color-primary);

  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
}

/* =========================================
   USER INFO
========================================= */

.user-info {
  min-width: 0;

  display: flex;
  flex-direction: column;

  line-height: 1.3;
}

.user-info strong {
  max-width: 220px;

  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);

  color: var(--color-text-primary);

  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-info span {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);

  white-space: nowrap;
}

.mobile-menu-button {
  display: flex;
  width: 40px;
  height: 40px;

  align-items: center;
  justify-content: center;

  border: none;
  border-radius: var(--radius-lg);

  background: transparent;
  color: var(--color-text-secondary);

  cursor: pointer;

  transition:
      background var(--transition-normal),
      color var(--transition-normal);
}

.mobile-menu-button:hover {
  background: var(--color-surface-hover);
  color: var(--color-text-primary);
}

/* =========================================
   LARGE DESKTOP
   1440px+
========================================= */

@media (min-width: 1440px) {
  .header {
    padding: 0 32px;
  }

  .header-left h1 {
    font-size: var(--font-size-xl);
  }

  .header-user {
    gap: 20px;
  }
}

/* =========================================
   DESKTOP
   1024px - 1439px
========================================= */

@media (max-width: 1439px) {
  .header {
    padding: 0 24px;
  }
}

/* =========================================
   TABLET
   768px - 1023px
========================================= */

@media (max-width: 1023px) {
  .header {
    padding: 0 20px;
  }

  .header-left {
    gap: var(--spacing-md);
  }

  .header-left h1 {
    font-size: var(--font-size-lg);
  }

  .header-user {
    gap: var(--spacing-md);
  }

  .user-info strong {
    max-width: 160px;
  }
}

/* =========================================
   MOBILE
   480px - 767px
========================================= */

@media (max-width: 767px) {
  .header {
    height: 60px;
    padding: 0 16px;
  }

  .header-left h1 {
    font-size: var(--font-size-lg);
  }

  .header-user {
    gap: 10px;
  }

  .user-info {
    display: none;
  }

  .divider {
    display: none;
  }

  .avatar {
    width: 34px;
    height: 34px;
  }

  .icon-button {
    width: 36px;
    height: 36px;
  }
}

/* =========================================
   SMALL MOBILE
   < 480px
========================================= */

@media (max-width: 479px) {
  .header {
    height: 56px;
    padding: 0 12px;
  }

  .header-left h1 {
    max-width: 150px;

    font-size: var(--font-size-md);
  }

  .header-user {
    gap: 6px;
  }

  .avatar {
    width: 32px;
    height: 32px;

    font-size: var(--font-size-sm);
  }

  .icon-button {
    width: 34px;
    height: 34px;
  }

  .notification-badge {
    top: 1px;
    right: 1px;
  }
}


/* Notification dropdown */
.notification-wrapper {
    position: relative;
    display: flex;
    align-items: center;
}

.notification-panel {
    position: absolute;
    top: calc(100% + 12px);
    right: 0;
    width: 420px;
    max-width: calc(100vw - 24px);
    max-height: min(600px, calc(100vh - 100px));
    background: var(--color-surface, #ffffff);
    border: 1px solid var(--color-border, #e5eaf0);
    border-radius: 12px;
    box-shadow: 0 12px 35px rgba(0, 0, 0, 0.16);
    z-index: 1100;
    overflow: hidden;
}

.notification-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 18px;
    border-bottom: 1px solid var(--color-border, #e5eaf0);
}

.notification-panel-header h2 {
    margin: 0;
    font-size: 17px;
    color: var(--color-text-primary, #172a3a);
}

.notification-close {
    border: none;
    background: transparent;
    color: var(--color-text-secondary, #64748b);
    font-size: 24px;
    cursor: pointer;
    padding: 4px 8px;
}

.notification-panel :deep(.page) {
    max-height: min(520px, calc(100vh - 170px));
    overflow-y: auto;
}

@media (max-width: 767px) {
    .notification-panel.mobile-notification-panel {
        position: fixed;
        inset: 0;
        width: 100%;
        height: 100%;
        height: 100dvh;
        max-width: none;
        max-height: none;
        border: none;
        border-radius: 0;
        z-index: 2000;
        display: flex;
        flex-direction: column;
    }

    .mobile-notification-panel .notification-panel-header {
        flex-shrink: 0;
        padding: 16px;
    }

    .mobile-notification-panel :deep(.page) {
        flex: 1;
        min-height: 0;
        max-height: none;
        overflow-y: auto;
    }
}

</style>
