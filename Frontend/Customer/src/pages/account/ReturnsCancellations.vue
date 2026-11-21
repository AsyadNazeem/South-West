<script setup>
import AccountPageHeader from '@/components/account/AccountPageHeader.vue'
</script>

<template>
  <section class="returns-page">
    <AccountPageHeader title="Returns &amp; cancellations" description="Get help with an item or an order you need to cancel." />

    <div class="list">

      <article class="row">
        <div class="text">
          <h2>Request help with an order</h2>
          <p>Find your order reference and include it when contacting South West.</p>
        </div>
        <div class="actions">
          <RouterLink class="btn" to="/account/orders">Find my order</RouterLink>
          <RouterLink class="link" to="/contact">Contact support →</RouterLink>
        </div>
      </article>

      <article class="row">
        <div class="text">
          <h2>Returns and refunds</h2>
          <p>Check eligibility and the information needed for a return.</p>
        </div>
        <div class="actions">
          <RouterLink class="link" to="/returns">Read the returns policy →</RouterLink>
        </div>
      </article>

    </div>
  </section>
</template>

<style scoped>
.returns-page { min-width: 0; color: var(--color-text); }

/* One card, two rows */
.list { overflow: hidden; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-lg); box-shadow: var(--shadow-sm); }
.row { display: flex; align-items: center; justify-content: space-between; gap: 24px; padding: 18px 20px; }
.row + .row { border-top: 1px solid var(--color-border-soft); }

.text { min-width: 0; }
h2 { margin: 0; font-family: var(--font-family-display); font-size: 15px; font-weight: 700; }
p { margin: 4px 0 0; color: var(--color-text-muted); font-size: 13px; line-height: 1.55; }

/* Actions */
.actions { display: flex; align-items: center; flex-shrink: 0; gap: 18px; }
.btn { display: inline-flex; align-items: center; justify-content: center; min-height: 36px; padding: 0 16px; background: var(--color-primary); color: var(--color-on-primary); border-radius: var(--radius-md); font: 600 13px/1 var(--font-family-base); text-decoration: none; white-space: nowrap; transition: background .15s ease; }
.btn:hover { background: var(--color-primary-hover); }
.link { color: var(--color-primary); font-size: 13px; font-weight: 600; text-decoration: none; white-space: nowrap; }
.link:hover { text-decoration: underline; }
.btn:focus-visible, .link:focus-visible { outline: 2px solid var(--color-focus-outline); outline-offset: 2px; }

@media (max-width: 640px) {
  .row { flex-direction: column; align-items: flex-start; gap: 12px; padding: 16px 14px; }
  .actions { flex-wrap: wrap; gap: 12px 18px; }
}
</style>