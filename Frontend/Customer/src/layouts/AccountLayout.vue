
<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AccountSidebar from '@/components/account/AccountSidebar.vue'
import api from '@/services/api'

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
  min-height: 70dvh;
  padding: var(--space-8) 0 var(--space-16);
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
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
  overflow-wrap: anywhere;
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
  overflow-wrap: anywhere;
  overflow-x: auto; /* wide tables/forms scroll instead of breaking the page */
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

/* ---------- Small laptops / tablet landscape ---------- */
@media (max-width: 1024px) {
  .account-layout {
    grid-template-columns: 190px minmax(0, 1fr);
    gap: var(--space-6);
  }

  .content {
    padding: var(--space-5);
  }
}

/* ---------- Tablet portrait / unfolded foldables: stacked ---------- */
@media (max-width: 850px) {
  .account {
    padding: var(--space-6) 0 var(--space-8);
  }

  .account-layout {
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-5);
  }

  .content {
    padding: var(--space-5);
  }
}

/* ---------- Phones ---------- */
@media (max-width: 600px) {
  .account {
    padding: var(--space-5) 0 var(--space-8);
  }

  .page-title {
    margin-bottom: var(--space-4);
    font-size: calc(var(--font-size-lg) * 0.88);
  }

  .account-layout {
    gap: var(--space-4);
  }

  .content {
    padding: var(--space-4);
  }
}

/* ---------- Small phones / fold cover screens (≈280–360px) ---------- */
@media (max-width: 360px) {
  .account-container {
    width: 96%;
  }

  .page-title {
    font-size: calc(var(--font-size-lg) * 0.8);
  }

  .content {
    padding: 12px;
    border-radius: var(--radius-sm);
  }
}

/* ---------- Dual-screen foldables spanned across the hinge ---------- */
@media (horizontal-viewport-segments: 2) {
  .account-container {
    width: 100%;
  }

  .account-layout {
    grid-template-columns:
        env(viewport-segment-width 0 0)
        env(viewport-segment-width 1 0);
    gap: calc(
        env(viewport-segment-left 1 0) -
        env(viewport-segment-right 0 0)
    );
  }
}

/* ---------- Landscape phones (short viewport) ---------- */
@media (max-height: 480px) and (orientation: landscape) {
  .account {
    min-height: auto;
    padding-top: var(--space-4);
    padding-bottom: var(--space-6);
  }

  .page-title {
    margin-bottom: var(--space-3, 12px);
  }
}

/* ---------- Touch targets ---------- */
@media (pointer: coarse) {
  .retry {
    min-height: 44px;
    padding: 0 var(--space-3, 12px);
  }
}
</style>
