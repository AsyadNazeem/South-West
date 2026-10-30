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
  { label: 'First name', value: props.customer.first_name },
  { label: 'Last name', value: props.customer.last_name },
  { label: 'Email', value: props.customer.email },
  { label: 'Phone', value: props.customer.phone },
  { label: 'Customer code', value: props.customer.customer_code },
])
</script>

<template>
  <div class="personal">

    <!-- Heading -->
    <header class="personal-header">
      <h2 class="section-title">Personal Information</h2>
      <p class="intro">Your account details.</p>
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

  </div>
</template>

<style scoped>
.personal-header {
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

/* Details grid
   The 1px gap shows the container background, which draws the
   dividers without any per-cell border juggling. */

.details {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1px;
  margin: 0;
  background: var(--color-border-soft);
  border: 1px solid var(--color-border-soft);
  border-radius: 12px;
  overflow: hidden;
}

.detail {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 18px 20px;
  background: #fff;
}

/* An odd last item spans the full width */
.detail:last-child:nth-child(odd) {
  grid-column: 1 / -1;
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
}
</style>