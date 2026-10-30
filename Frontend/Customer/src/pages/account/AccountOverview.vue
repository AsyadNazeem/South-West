<script setup>
import { computed } from 'vue'

const props = defineProps({
  customer: { type: Object, default: () => ({}) },
  fullName: { type: String, default: 'Customer' },
})

const initials = computed(() =>
  props.fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0].toUpperCase())
    .join('') || 'C'
)

const details = computed(() => [
  { label: 'Full name', value: props.fullName },
  { label: 'Email', value: props.customer.email },
  { label: 'Phone', value: props.customer.phone },
  { label: 'Customer code', value: props.customer.customer_code },
])
</script>

<template>
  <div class="overview">

    <!-- Heading -->
    <header class="overview-header">
      <h2 class="section-title">Account Overview</h2>
      <p class="intro">Welcome back, {{ fullName }}.</p>
    </header>

    <!-- Profile summary -->
    <div class="profile">
      <div class="avatar" aria-hidden="true">{{ initials }}</div>

      <div class="profile-text">
        <strong class="profile-name">{{ fullName }}</strong>
        <span class="profile-email">{{ customer.email || 'No email on file' }}</span>
      </div>

      <span v-if="customer.customer_code" class="code-badge">
        {{ customer.customer_code }}
      </span>
    </div>

    <!-- Details -->
    <dl class="details">
      <div
        v-for="item in details"
        :key="item.label"
        class="detail"
      >
        <dt>{{ item.label }}</dt>

        <dd :class="{ empty: !item.value }">
          {{ item.value || 'Not provided' }}
        </dd>
      </div>
    </dl>

    <!-- Action -->
    <RouterLink class="link" to="/account/personal-information">
      Manage personal information
      <span class="arrow" aria-hidden="true">→</span>
    </RouterLink>

  </div>
</template>

<style scoped>
.overview-header {
  margin-bottom: 24px;
}

.section-title {
  margin: 0;
  font-size: var(--font-size-lg, 20px);
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--color-text);
}

.intro {
  margin: 6px 0 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

/* Profile summary */

.profile {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 18px 20px;
  margin-bottom: 24px;
  background: var(--color-bg-soft, #f8fafc);
  border: 1px solid var(--color-border-soft);
  border-radius: 12px;
}

.avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--color-primary);
  color: #fff;
  font-size: var(--font-size-md);
  font-weight: 700;
  letter-spacing: 0.02em;
}

.profile-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.profile-name {
  font-size: var(--font-size-md);
  font-weight: 600;
  color: var(--color-text);
}

.profile-email {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  overflow-wrap: anywhere;
}

.code-badge {
  padding: 5px 12px;
  border: 1px solid var(--color-border-soft);
  border-radius: 999px;
  background: #fff;
  color: var(--color-text);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  white-space: nowrap;
}

/* Details grid */

.details {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0;
  margin: 0 0 28px;
  border: 1px solid var(--color-border-soft);
  border-radius: 12px;
  overflow: hidden;
}

.detail {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 18px 20px;
  border-bottom: 1px solid var(--color-border-soft);
}

.detail:nth-child(odd) {
  border-right: 1px solid var(--color-border-soft);
}

.detail:nth-last-child(-n + 2) {
  border-bottom: none;
}

dt {
  color: var(--color-text-muted);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

dd {
  margin: 0;
  color: var(--color-text);
  font-size: var(--font-size-md);
  font-weight: 500;
  overflow-wrap: anywhere;
}

dd.empty {
  color: var(--color-text-muted);
  font-weight: 400;
  font-style: italic;
}

/* Action */

.link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  border: 1px solid var(--color-primary);
  border-radius: 8px;
  color: var(--color-primary);
  font-size: var(--font-size-sm);
  font-weight: 600;
  text-decoration: none;
  transition: background 0.2s ease, color 0.2s ease;
}

.link:hover {
  background: var(--color-primary);
  color: #fff;
}

.arrow {
  transition: transform 0.2s ease;
}

.link:hover .arrow {
  transform: translateX(3px);
}

/* Responsive */

@media (max-width: 640px) {
  .profile {
    flex-wrap: wrap;
  }

  .code-badge {
    margin-left: 64px;
  }

  .details {
    grid-template-columns: 1fr;
  }

  .detail:nth-child(odd) {
    border-right: none;
  }

  .detail:nth-last-child(-n + 2) {
    border-bottom: 1px solid var(--color-border-soft);
  }

  .detail:last-child {
    border-bottom: none;
  }
}
</style>