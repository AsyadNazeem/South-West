<script setup>
import { computed, ref } from 'vue'
import { analyticsConfigured, getAnalyticsChoice, setAnalyticsConsent } from '@/services/analytics'

const choice = ref(getAnalyticsChoice())
const settingsOpen = ref(!choice.value)
const enabled = analyticsConfigured
const visible = computed(() => settingsOpen.value && enabled)

function choose(accepted) {
  setAnalyticsConsent(accepted)
  choice.value = accepted ? 'accepted' : 'rejected'
  settingsOpen.value = false
}
</script>

<template>
  <aside v-if="visible" class="analytics-consent" role="dialog" aria-label="Analytics preferences">
    <p>We use optional analytics to understand how the store is used. You can continue without analytics.</p>
    <div>
      <button type="button" @click="choose(false)">Decline</button>
      <button type="button" @click="choose(true)">Accept analytics</button>
    </div>
  </aside>
  <button v-else-if="enabled" class="analytics-settings" type="button" @click="settingsOpen = true">
    Analytics settings
  </button>
</template>

<style scoped>
.analytics-consent{position:fixed;z-index:1200;left:16px;bottom:16px;max-width:520px;padding:16px;background:#fff;border:1px solid #dce2e7;border-radius:10px;box-shadow:0 8px 30px #172b3a24;color:#263238;font:14px/1.5 inherit}
.analytics-consent p{margin:0 0 12px}.analytics-consent div{display:flex;justify-content:flex-end;gap:8px}.analytics-consent button{padding:8px 12px;border:1px solid #147d78;border-radius:6px;background:#fff;color:#176b68;cursor:pointer}.analytics-consent button:last-child{background:#147d78;color:#fff}
.analytics-settings{position:fixed;z-index:1199;left:12px;bottom:10px;padding:5px 8px;border:1px solid #dce2e7;border-radius:5px;background:#fff;color:#52616b;font-size:11px;cursor:pointer}
</style>
