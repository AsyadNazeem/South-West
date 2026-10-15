
<script setup>
import { useRoute } from 'vue-router'

const route = useRoute()

const sections = [
  { label: 'Account Overview', path: '/account', exact: true },
  { label: 'Personal Information', path: '/account/personal-information' },
  { label: 'Address Book', path: '/account/addresses' },
  { label: 'Change Password', path: '/account/change-password' },
  { label: 'My Orders', path: '/account/orders' },
  { label: 'Wishlist', path: '/account/wishlist' },
  { label: 'My Reviews', path: '/account/reviews' },
  { label: 'Returns & Cancellations', path: '/account/returns' },
]
</script>

<template>
  <nav class="side-nav" aria-label="Account navigation">
    <RouterLink
        v-for="section in sections"
        :key="section.path"
        :to="section.path"
        :class="{
        active: section.exact
          ? route.path === section.path
          : route.path === section.path
      }"
    >
      {{ section.label }}
    </RouterLink>
  </nav>
</template>

<style scoped>
.side-nav {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.side-nav a {
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  text-decoration: none;
}

.side-nav a:hover,
.side-nav a.active {
  color: var(--color-primary);
  font-weight: var(--font-weight-semibold);
}

@media (max-width: 850px) {
  .side-nav {
    flex-direction: row;
    gap: 20px;
    overflow-x: auto;
    white-space: nowrap;
    padding-bottom: 8px;
  }
}
</style>
