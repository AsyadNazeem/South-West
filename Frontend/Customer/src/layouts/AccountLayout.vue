
<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AccountSidebar from '@/components/account/AccountSidebar.vue'
import '@/assets/styles/account.css'
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
        'Unable to load your account. Please try again.'

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
      <nav class="crumbs" aria-label="Breadcrumb"><RouterLink to="/">Home</RouterLink><span aria-hidden="true">/</span>
        <RouterLink v-if="$route.path !== '/account'" to="/account">My account</RouterLink><span v-else aria-current="page">My account</span>
        <template v-if="$route.path !== '/account'"><span aria-hidden="true">/</span><span aria-current="page">{{ $route.meta.title }}</span></template>
      </nav>

      <p v-if="loading" class="status" role="status">Loading your account…</p>

      <div v-else-if="errorMessage" class="status error">
        <p>{{ errorMessage }}</p>
        <button class="retry" type="button" @click="loadCustomer">
          Try again
        </button>
      </div>

      <div v-else class="account-layout">
        <AccountSidebar :full-name="fullName" />

        <section class="content" aria-label="Account content">
          <RouterView :customer="customer" :full-name="fullName" />
        </section>
      </div>
    </div>
  </main>
</template>

<style scoped>
.account{min-height:70vh;background:var(--color-store-bg);padding:1.25rem 0 clamp(2rem,6vw,5rem);color:var(--color-text)}
.account-container { width: min(1440px, 94%); margin: auto; }
.account-layout { display: grid; grid-template-columns: 250px minmax(0, 1fr); gap: clamp(1.25rem, 3vw, 2.5rem); align-items: start; }
.crumbs{display:flex;flex-wrap:wrap;align-items:center;gap:.55rem;color:var(--color-text-muted);font-size:.82rem;margin-bottom:1.25rem}
.crumbs a{color:inherit;text-decoration:none;padding:.3rem 0}.crumbs a:hover{text-decoration:underline}
.content{min-width:0;overflow-wrap:anywhere}
.status{padding:1.5rem;background:var(--color-surface);border-radius:8px}
.account :deep(:focus-visible){outline:3px solid var(--color-focus);outline-offset:2px}
.account :deep(:is(input,select,textarea,fieldset)){max-width:100%;min-width:0}
.account :deep(:is(button,input:not([type=checkbox]),select)){min-height:44px}
@media(max-width:850px){.account-layout{grid-template-columns:minmax(0,1fr);gap:1.5rem}.account-container{width:min(94%,720px)}}
@media(max-width:480px){.account{padding-top:.6rem}.account-container{width:calc(100% - 28px)}.crumbs{margin-bottom:.65rem}}
</style>
