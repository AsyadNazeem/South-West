<script setup>
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'

import SiteHeader from './layouts/AppHeader.vue'
import AppFooter from './layouts/AppFooter.vue'
import FloatingWhatsApp from './components/FloatingWhatsApp.vue'
import './assets/styles/ramadan.css'
import './assets/styles/eid.css'
import './assets/styles/floral.css'
import './assets/styles/christmas.css'
import './assets/styles/seasonal-filters.css'
import RouteProgress from './components/RouteProgress.vue'

import { useWebsiteTheme } from './composables/useWebsiteTheme'

const { loadActiveTheme, themeSlug, floralArtwork, effects } = useWebsiteTheme()
const balloonColors = ['red', 'burgundy', 'pink', 'rose-gold', 'champagne']
const balloons = computed(() => {
  if (themeSlug.value !== 'valentines-day') return []
  return Array.from({ length: 20 }, (_, index) => {
    const duration = 12 + Math.random() * 13
    return {
      '--foil': `url('/themes/valentines-day/valentine-balloon-${balloonColors[index % balloonColors.length]}.webp')`,
      '--left': Math.random() * 96 + '%',
      '--size': 12 + Math.random() * 18 + 'px',
      '--duration': duration + 's',
      '--start': -Math.random() * duration + 's',
      '--swing': (Math.random() - 0.5) * 50 + 'px',
      '--tilt': (Math.random() - 0.5) * 24 + 'deg',
      '--alpha': 0.42 + Math.random() * 0.3,
    }
  })
})
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
  <div v-if="themeSlug === 'ramadan' && !isStandaloneAuthPage()" class="ramadan-ambient" aria-hidden="true">
    <i v-for="n in 6" :key="n" />
  </div>
  <div v-if="themeSlug === 'eid' && effects.confetti !== false && !isStandaloneAuthPage()" class="eid-ambient" aria-hidden="true">
    <i v-for="n in 8" :key="n" />
  </div>
  <div v-if="floralArtwork && effects.petals !== false && !isStandaloneAuthPage()" class="floral-ambient" aria-hidden="true">
    <i v-for="n in (themeSlug === 'valentines-day' ? 3 : 10)" :key="n" :style="{ '--i': n }" />
    <span v-for="(style, index) in balloons" :key="'balloon-' + index" class="foil-balloon" :style="style" />
  </div>
  <FloatingWhatsApp v-if="!isStandaloneAuthPage()" />
  <AppFooter v-if="!isStandaloneAuthPage()" />

</template>
