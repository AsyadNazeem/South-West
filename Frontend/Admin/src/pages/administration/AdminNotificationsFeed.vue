<template>
  <section class="page">
    <header class="feed-header">
      <div>
        <h1>Notifications</h1>
        <p>Updates about customer activity and requests.</p>
      </div>

      <button
        class="refresh-button"
        type="button"
        :disabled="loading"
        @click="load"
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" :class="{ spinning: loading }">
          <path
            d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        Refresh
      </button>
    </header>

    <p v-if="error" class="error" role="alert">{{ error }}</p>

    <div v-if="loading" class="empty" role="status">
      <span class="spinner" aria-hidden="true"></span>
      Loading notifications…
    </div>

    <div v-else-if="!items.length" class="empty">
      <span class="empty-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none">
          <path
            d="M18 16v-5a6 6 0 1 0-12 0v5l-2 2h16l-2-2ZM10 21h4"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </span>
      You’re all caught up.
    </div>

    <article
      v-for="item in items"
      :key="item.id"
      :class="{ unread: !item.is_read }"
      :tabindex="item.is_read ? undefined : 0"
      @click="markRead(item)"
      @keydown.enter.self="markRead(item)"
    >
      <span class="dot"></span>

      <div class="notification-content">
        <strong>{{ item.title }}</strong>
        <p>{{ item.message }}</p>
        <small>{{ formatDate(item.created_at) }}</small>
      </div>

      <div class="notification-actions">
        <button
          v-if="!item.is_read"
          class="read"
          type="button"
          @click.stop="markRead(item)"
        >
          Mark read
        </button>
        <button class="remove" type="button" @click.stop="removeNotification(item)">
          Remove
        </button>
      </div>
    </article>

    <footer class="feed-footer">
      <router-link to="/admin/administration/notification-history" @click="emit('history')">
        View notification history
      </router-link>
    </footer>
  </section>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import api from '@/api/axios'

const emit = defineEmits(['updated', 'history'])

const items = ref([])
const loading = ref(true)
const error = ref('')

async function load() {
  loading.value = true
  error.value = ''

  try {
    const response = await api.get('/notifications/admin/mine', { params: { page: 1, pageSize: 100, view: 'feed' } })
    items.value = response.data.data || []
    emit('updated')
  } catch (e) {
    error.value =
      e.response?.data?.message ||
      'Unable to load notifications.'
  } finally {
    loading.value = false
  }
}

async function markRead(item) {
  if (item.is_read) return

  try {
    await api.patch(
      `/notifications/admin/mine/${item.id}/read`
    )

    item.is_read = true
    emit('updated')
  } catch (e) {
    error.value =
      e.response?.data?.message ||
      'Unable to update notification.'
  }
}

async function removeNotification(item) {
  try {
    await api.patch(`/notifications/admin/mine/${item.id}/dismiss`)
    items.value = items.value.filter(notification => notification.id !== item.id)
    emit('updated')
  } catch (e) {
    error.value = e.response?.data?.message || 'Unable to remove notification.'
  }
}

const formatDate = value =>
  new Date(value).toLocaleString()

onMounted(load)
</script>

<style scoped>
/*
  Every colour, radius and spacing value comes from a CSS variable.
  Each one reads your global token first and falls back to the value this
  page used before, so nothing changes if a token is missing.
  To retheme the page, change the global tokens (or override the --n-* values below).
*/
.page {
  --n-primary: var(--color-primary, #087f8c);
  --n-primary-hover: var(--color-primary-hover, #066c77);
  --n-on-primary: var(--color-on-primary, #fff);
  --n-surface: var(--color-surface, #fff);
  --n-surface-muted: var(--color-surface-muted, #f4f7fa);
  --n-unread-bg: color-mix(in srgb, var(--n-primary) 6%, var(--n-surface));
  --n-unread-border: color-mix(in srgb, var(--n-primary) 38%, var(--n-surface));
  --n-border: var(--color-border-soft, #e5eaf0);
  --n-border-strong: var(--color-border, #d3dae4);
  --n-text: var(--color-text, #172a3a);
  --n-text-secondary: var(--color-text-secondary, #475569);
  --n-muted: var(--color-text-muted, #64748b);
  --n-dot-read: var(--color-text-disabled, #9ca3af);
  --n-danger: var(--color-danger, #b42318);
  --n-danger-bg: var(--color-danger-bg, #fdecec);
  --n-focus: var(--color-focus-outline, var(--n-primary));

  --n-radius: var(--radius-md, 10px);
  --n-radius-sm: var(--radius-sm, 8px);
  --n-radius-pill: var(--radius-pill, 999px);
  --n-space-1: var(--space-1, 4px);
  --n-space-2: var(--space-2, 8px);
  --n-space-3: var(--space-3, 12px);
  --n-space-4: var(--space-4, 16px);
  --n-space-5: var(--space-5, 20px);
  --n-transition: var(--transition-fast, 0.15s ease);

  padding: var(--n-space-5);
  max-width: 100%;
  margin: 0;
  overflow-y: auto;
  color: var(--n-text);
}

/* ---------- Header ---------- */
.feed-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--n-space-3);
  margin-bottom: var(--n-space-5);
}

.feed-header h1 {
  margin: 0;
  font-family: var(--font-family-display, inherit);
  font-size: 20px;
  font-weight: 700;
  color: var(--n-text);
}

.feed-header p {
  margin: 5px 0 0;
  font-size: 13px;
  color: var(--n-muted);
}

/* ---------- Buttons ---------- */
.refresh-button,
.read {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 0;
  border-radius: var(--n-radius-sm);
  font: inherit;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  transition:
    background-color var(--n-transition),
    color var(--n-transition),
    border-color var(--n-transition);
}

.refresh-button {
  padding: 9px 14px;
  background: var(--n-primary);
  color: var(--n-on-primary);
  font-size: 13px;
}

.refresh-button svg {
  width: 15px;
  height: 15px;
}

.refresh-button:hover:not(:disabled) {
  background: var(--n-primary-hover);
}

.refresh-button:disabled {
  opacity: 0.65;
  cursor: wait;
}

/* Quiet text button, so the primary action stays the Refresh button */
.read {
  padding: 6px 12px;
  border: 1px solid var(--n-unread-border);
  background: var(--n-surface);
  color: var(--n-primary);
  font-size: 12px;
}

.notification-actions {
  display: flex;
  align-items: center;
  gap: var(--n-space-2);
  margin-left: auto;
}

.remove {
  padding: 6px 10px;
  border: 1px solid var(--n-border-strong);
  border-radius: var(--n-radius-sm);
  background: var(--n-surface);
  color: var(--n-danger);
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.remove:hover {
  border-color: var(--n-danger);
  background: var(--n-danger-bg);
}

.feed-footer {
  display: flex;
  justify-content: flex-end;
  padding: var(--n-space-2) 0 0;
}

.feed-footer a {
  color: var(--n-primary);
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
}

.feed-footer a:hover {
  color: var(--n-primary-hover);
  text-decoration: underline;
}

.read:hover {
  background: var(--n-primary);
  border-color: var(--n-primary);
  color: var(--n-on-primary);
}

.refresh-button:focus-visible,
.read:focus-visible,
.remove:focus-visible,
.feed-footer a:focus-visible,
article:focus-visible {
  outline: 2px solid var(--n-focus);
  outline-offset: 2px;
}

/* ---------- Notification cards ---------- */
article {
  position: relative;
  display: flex;
  gap: var(--n-space-3);
  align-items: flex-start;
  margin-bottom: 10px;
  padding: 14px var(--n-space-4);
  overflow: hidden;
  background: var(--n-surface);
  border: 1px solid var(--n-border);
  border-radius: var(--n-radius);
  cursor: default;
  transition:
    border-color var(--n-transition),
    box-shadow var(--n-transition),
    background-color var(--n-transition);
}

@media (hover: hover) {
  article:hover {
    border-color: var(--n-border-strong);
    box-shadow: 0 4px 14px rgb(16 24 40 / 7%);
  }
}

article.unread {
  border-color: var(--n-unread-border);
  background: var(--n-unread-bg);
  cursor: pointer;
}

/* Accent bar on unread items */
article.unread::before {
  content: '';
  position: absolute;
  inset: 0 auto 0 0;
  width: 3px;
  background: var(--n-primary);
}

.dot {
  flex: none;
  width: 9px;
  height: 9px;
  margin-top: 6px;
  border-radius: 50%;
  background: var(--n-dot-read);
}

.unread .dot {
  background: var(--n-primary);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--n-primary) 18%, transparent);
}

.notification-content {
  flex: 1;
  min-width: 0;
}

article strong {
  font-size: 14px;
  font-weight: 600;
  color: var(--n-text);
}

article:not(.unread) strong {
  font-weight: 500;
}

article p {
  margin: 4px 0 8px;
  font-size: 13px;
  line-height: 1.55;
  color: var(--n-text-secondary);
  overflow-wrap: anywhere;
}

small {
  font-size: 12px;
  color: var(--n-muted);
}

/* ---------- Empty / loading / error ---------- */
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--n-space-3);
  padding: 40px var(--n-space-4);
  border: 1px dashed var(--n-border-strong);
  border-radius: var(--n-radius);
  background: var(--n-surface-muted);
  font-size: 14px;
  color: var(--n-muted);
  text-align: center;
}

.empty-icon {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--n-primary) 10%, var(--n-surface));
  color: var(--n-primary);
}

.empty-icon svg {
  width: 24px;
  height: 24px;
}

.spinner {
  width: 24px;
  height: 24px;
  border: 3px solid var(--n-border);
  border-top-color: var(--n-primary);
  border-radius: 50%;
  animation: n-spin 0.8s linear infinite;
}

.spinning {
  animation: n-spin 0.8s linear infinite;
}

@keyframes n-spin {
  to {
    transform: rotate(360deg);
  }
}

.error {
  margin: 0 0 var(--n-space-4);
  padding: 10px var(--n-space-3);
  border-left: 3px solid var(--n-danger);
  border-radius: var(--n-radius-sm);
  background: var(--n-danger-bg);
  font-size: 13px;
  color: var(--n-danger);
}

/* ---------- Phones ---------- */
@media (max-width: 767px) {
  .page {
    padding: var(--n-space-4);
  }

  .feed-header h1 {
    font-size: 19px;
  }

  article {
    padding: 15px var(--n-space-3);
  }
}

@media (max-width: 480px) {
  /* Mark read drops under the text so long messages keep their width */
  article {
    flex-wrap: wrap;
  }

  .notification-content {
    flex-basis: calc(100% - 30px);
  }

  .notification-actions {
    margin-left: 21px;
  }
}

@media (prefers-reduced-motion: reduce) {
  article,
  .refresh-button,
  .read {
    transition: none;
  }

  .spinner,
  .spinning {
    animation-duration: 1.8s;
  }
}
</style>
