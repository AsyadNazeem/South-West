
<script setup>
defineProps({
  customer: { type: Object, default: () => ({}) },
  fullName: { type: String, default: 'Customer' },
})
</script>

<template>
  <div>
    <h2 class="section-title">Account Overview</h2>
    <p class="intro">Welcome back, {{ fullName }}.</p>

    <dl class="details">
      <div>
        <dt>Full name</dt>
        <dd>{{ fullName }}</dd>
      </div>
      <div>
        <dt>Email</dt>
        <dd>{{ customer.email || 'Not provided' }}</dd>
      </div>
      <div>
        <dt>Phone</dt>
        <dd>{{ customer.phone || 'Not provided' }}</dd>
      </div>
      <div>
        <dt>Customer code</dt>
        <dd>{{ customer.customer_code || 'Not provided' }}</dd>
      </div>
    </dl>

    <RouterLink class="link" to="/account/personal-information">
      Manage personal information →
    </RouterLink>
  </div>
</template>

<style scoped>
.section-title {
  margin: 0 0 12px;
  font-size: var(--font-size-md);
  color: var(--color-text);
}

.intro {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.details {
  margin: 20px 0;
}

.details > div {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 0;
  border-bottom: 1px solid var(--color-border-soft);
  font-size: var(--font-size-sm);
}

dt {
  color: var(--color-text-muted);
}

dd {
  margin: 0;
  text-align: right;
  overflow-wrap: anywhere;
}

.link {
  color: var(--color-primary);
  font-size: var(--font-size-sm);
  text-decoration: none;
}
</style>
