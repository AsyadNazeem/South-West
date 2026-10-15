
<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AccountSidebar from '../components/account/AccountSidebar.vue'
import api from '../services/api'

const router = useRouter()
const customer = ref(null)
const loading = ref(true)
const errorMessage = ref('')

const fullName = computed(() =>
    [customer.value?.first_name, customer.value?.last_name]
        .filter(Boolean)
        .join(' ') || 'Customer'
)

async function loadCustomer() {
  if (!sessionStorage.getItem('customerToken')) {
    router.replace({ path: '/login', query: { redirect: router.currentRoute.value.fullPath } })
    return
  }

  loading.value = true
  errorMessage.value = ''

  try {
    const response = await api.get('/customer-auth/me')
    const body = response.data

    customer.value =
        body?.customer ??
        body?.data?.customer ??
        body?.data ??
        body

    if (!customer.value || typeof customer.value !== 'object') {
      throw new Error('Unable to load your account details.')
    }

    sessionStorage.setItem('customerProfile', JSON.stringify(customer.value))
  } catch (error) {
    errorMessage.value =
        error.response?.data?.message || 'Unable to load your account.'

    if (error.response?.status === 401) {
      sessionStorage.removeItem('customerToken')
      sessionStorage.removeItem('customerProfile')
      router.replace({ path: '/login', query: { redirect: router.currentRoute.value.fullPath } })
    }
  } finally {
    loading.value = false
  }
}

onMounted(loadCustomer)
</script>

<template>
  <main class="account">
    <div class="account-container">
      <h1 class="page-title">My Account</h1>

      <p v-if="loading" class="status">Loading your account…</p>

      <div v-else-if="errorMessage" class="status error">
        <p>{{ errorMessage }}</p>
        <button class="retry" type="button" @click="loadCustomer">
          Try again
        </button>
      </div>

      <div v-else class="account-layout">
        <AccountSidebar />

        <section class="content">
          <RouterView :customer="customer" :full-name="fullName" />
        </section>
      </div>
    </div>
  </main>
</template>

<style scoped>
.account {
  min-height: 70vh;
  padding: var(--space-8) 0 var(--space-16);
  background: var(--color-store-bg);
}

.account-container {
  width: min(var(--container-store), 94%);
  margin: 0 auto;
}

.page-title {
  margin: 0 0 var(--space-6);
  color: var(--color-text);
  font-family: var(--font-family-display);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
}

.account-layout {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: var(--space-8);
  align-items: start;
}

.content {
  min-width: 0;
  padding: var(--space-6);
  background: var(--color-surface);
  border: 1px solid var(--color-border-soft);
  border-radius: var(--radius-md);
}

.status {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.error {
  color: var(--color-danger);
}

.retry {
  border: 0;
  background: none;
  color: var(--color-primary);
  text-decoration: underline;
  cursor: pointer;
}

@media (max-width: 850px) {
  .account-layout {
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-5);
  }

  .content {
    padding: var(--space-5);
  }
}
</style>
