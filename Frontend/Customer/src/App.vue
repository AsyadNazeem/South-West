<script setup>
import { onMounted } from 'vue'

import SiteHeader from './layouts/AppHeader.vue'
import AppFooter from './layouts/AppFooter.vue'
import FloatingWhatsApp from './components/FloatingWhatsApp.vue'
import RouteProgress from './components/RouteProgress.vue'
import AnalyticsConsent from './components/AnalyticsConsent.vue'

import { useWebsiteTheme } from './composables/useWebsiteTheme'

const { loadActiveTheme } = useWebsiteTheme()

onMounted(() => {
  loadActiveTheme()
})
</script>

<template>
  <RouteProgress />
  <SiteHeader />

  <RouterView />
<FloatingWhatsApp />
  <AnalyticsConsent />
  <AppFooter />

</template>
