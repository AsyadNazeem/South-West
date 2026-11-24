<script setup>
import { computed } from 'vue'
import { useWebsiteTheme } from '@/composables/useWebsiteTheme'

const { themeSlug, floralArtwork } = useWebsiteTheme()
const isAvurudu = computed(() => themeSlug.value === 'sinhala-tamil-new-year')
const ornaments = computed(() => isAvurudu.value
  ? ['erabadu', 'mango-garland', 'oil-lamp', 'flowers', 'header']
  : ['rose', 'header'])
</script>

<template>
  <div class="floral-band" aria-hidden="true">
    <div v-for="side in ['left','right']" :key="side" :class="['floral-wing', side]">
      <img v-for="name in ornaments" :key="name" :class="'ornament-' + name"
        :src="floralArtwork + name + '.webp'" alt="" />
    </div>
    <div class="floral-band-center">
      <img :src="floralArtwork + (isAvurudu ? 'sun' : 'rose') + '.webp'" alt="" />
      <span v-if="isAvurudu" lang="si">අලුත් අවුරුදු අසිරිය</span>
    </div>
  </div>
</template>
