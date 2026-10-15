
<script setup>
defineProps({
  customer: { type: Object, default: () => ({}) },
  fullName: { type: String, default: 'Customer' },
})
</script>

<template>
  <div>
    <h2 class="section-title">Personal Information</h2>
    <p class="intro">Your account details.</p>

    <dl class="details">
      <div>
        <dt>First name</dt>
        <dd>{{ customer.first_name || 'Not provided' }}</dd>
      </div>
      <div>
        <dt>Last name</dt>
        <dd>{{ customer.last_name || 'Not provided' }}</dd>
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
  </div>
</template>

<style scoped>
.section-title {
  margin: 0 0 8px;
  font-size: var(--font-size-md);
}

.intro {
  margin-bottom: 20px;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.details {
  margin: 0;
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
</style>
