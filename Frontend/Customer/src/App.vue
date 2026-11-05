<script setup>
import { onMounted } from 'vue'

import SiteHeader from './layouts/AppHeader.vue'
import AppFooter from './layouts/AppFooter.vue'
import FloatingWhatsApp from './components/FloatingWhatsApp.vue'

import { useWebsiteTheme } from './composables/useWebsiteTheme'

const { loadActiveTheme } = useWebsiteTheme()

onMounted(() => {
  loadActiveTheme()
})
</script>

<template>
  <SiteHeader />

  <RouterView />
<FloatingWhatsApp />
  <AppFooter />

</template>
