<script setup>
import { onMounted } from 'vue'
import { useRoute } from 'vue-router'

import SiteHeader from './layouts/AppHeader.vue'
import AppFooter from './layouts/AppFooter.vue'
import FloatingWhatsApp from './components/FloatingWhatsApp.vue'
import RouteProgress from './components/RouteProgress.vue'

import { useWebsiteTheme } from './composables/useWebsiteTheme'

const { loadActiveTheme } = useWebsiteTheme()
const route = useRoute()
const isStandaloneAuthPage = () => [
  'customer-login',
  'customer-register',
  'customer-verify-email',
  'customer-forgot-password',
  'customer-reset-password',
].includes(route.name)

onMounted(() => {
  loadActiveTheme()
})
</script>

<template>
  <RouteProgress />
  <SiteHeader v-if="!isStandaloneAuthPage()" />

  <RouterView />
  <FloatingWhatsApp v-if="!isStandaloneAuthPage()" />
  <AppFooter v-if="!isStandaloneAuthPage()" />

</template>
