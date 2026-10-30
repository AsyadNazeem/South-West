<script setup>
// The header is rendered once here, so it shows on every page.
// Adjust the import path to where SiteHeader.vue lives in your project.
import SiteHeader from './layouts/AppHeader.vue'
import AppFooter from './layouts/AppFooter.vue'
</script>

<template>
  <SiteHeader />
  <RouterView />
      <AppFooter />
</template>
