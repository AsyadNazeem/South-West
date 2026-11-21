<script setup>
import { computed } from 'vue'
import AccountPageHeader from '@/components/account/AccountPageHeader.vue'

const props = defineProps({ customer: Object, fullName: String })

const initials = computed(() =>
  (props.fullName || '').trim().split(/\s+/).slice(0, 2).map(s => s[0]).join('').toUpperCase() || '?'
)

const fields = computed(() => [
  ['First name', props.customer?.first_name],
  ['Last name', props.customer?.last_name],
  ['Email address', props.customer?.email],
  ['Phone number', props.customer?.phone],
])
</script>

<template>
  <section class="profile-page">
    <AccountPageHeader title="My profile" description="The contact details registered to your South West account." />

    <article class="card">

      <div class="col identity">
        <span class="avatar" aria-hidden="true">{{ initials }}</span>
        <div class="who">
          <h2>{{ fullName || 'Customer' }}</h2>
          <p v-if="customer?.customer_code" class="muted">Customer code · {{ customer.customer_code }}</p>
        </div>
        <RouterLink class="link" to="/contact">Contact support about a correction →</RouterLink>
      </div>

      <div class="col side">
        <h3>Personal information</h3>
        <dl class="rows">
          <div v-for="[label, value] in fields" :key="label">
            <dt>{{ label }}</dt>
            <dd :class="{ empty: !value }">{{ value || 'Not provided' }}</dd>
          </div>
        </dl>
      </div>

    </article>
  </section>
</template>

<style scoped>
.profile-page { min-width: 0; color: var(--color-text); }
.muted { margin: 0; color: var(--color-text-muted); font-size: 12px; }

/* Two-half card */
.card { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr); min-width: 0; overflow: hidden; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-lg); box-shadow: var(--shadow-sm); }
.col { display: flex; flex-direction: column; gap: 12px; min-width: 0; padding: 20px; }
.side { background: color-mix(in srgb, var(--color-primary) 5%, var(--color-surface)); border-left: 1px solid var(--color-border); }

/* Left: identity */
.avatar { display: grid; place-items: center; width: 52px; height: 52px; background: var(--color-primary); color: var(--color-on-primary); border-radius: 50%; font-size: 17px; font-weight: 700; letter-spacing: .02em; }
.who { display: grid; gap: 2px; min-width: 0; }
.who h2 { margin: 0; font-family: var(--font-family-display); font-size: 16px; font-weight: 700; overflow-wrap: anywhere; }
.link { margin-top: auto; color: var(--color-primary); font-size: 13px; font-weight: 600; text-decoration: none; }
.link:hover { text-decoration: underline; }
.link:focus-visible { outline: 2px solid var(--color-focus-outline); outline-offset: 2px; }

/* Right: details */
.side h3 { margin: 0; color: var(--color-text-muted); font-size: 12px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
.rows { margin: 0; }
.rows > div { display: grid; grid-template-columns: minmax(7rem, 9rem) minmax(0, 1fr); gap: 12px; padding: 11px 0; border-bottom: 1px solid var(--color-border); font-size: 13px; }
.rows > div:last-child { border-bottom: 0; padding-bottom: 0; }
.rows > div:first-child { padding-top: 0; }
dt { color: var(--color-text-muted); }
dd { margin: 0; font-weight: 600; overflow-wrap: anywhere; }
dd.empty { color: var(--color-text-muted); font-weight: 400; }

@media (max-width: 760px) {
  .card { grid-template-columns: minmax(0, 1fr); }
  .side { border-left: 0; border-top: 1px solid var(--color-border); }
  .col { padding: 16px; }
  .link { margin-top: 0; }
}
@media (max-width: 520px) {
  .rows > div { grid-template-columns: 1fr; gap: 2px; }
}
</style>