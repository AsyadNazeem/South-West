<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const active = ref(false)
const width = ref(0)
let timer
let finishTimer
let showTimer
let navigationPending = false
let activeNavigationId = 0
let nextNavigationId = 0
const requests = new Set()
const navigationIds = new WeakMap()
let removeBeforeEach
let removeAfterEach
let removeOnError

function updateProgress() {
  const pending = navigationPending || requests.size > 0
  if (!pending) {
    clearTimeout(showTimer)
    showTimer = null
    clearInterval(timer)
    timer = null
    width.value = 100
    clearTimeout(finishTimer)
    finishTimer = setTimeout(() => {
      active.value = false
      width.value = 0
      finishTimer = null
    }, active.value ? 180 : 0)
    return
  }
  clearTimeout(finishTimer)
  if (!active.value) {
    clearTimeout(showTimer)
    showTimer = setTimeout(() => {
      showTimer = null
      if (navigationPending || requests.size) active.value = true
    }, 110)
  }
  const reducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  if (reducedMotion) {
    clearInterval(timer)
    timer = null
    width.value = 80
  } else if (!timer) {
    width.value = Math.max(width.value, 12)
    timer = setInterval(() => { width.value = Math.min(92, width.value + Math.max(1, (92 - width.value) * 0.08)) }, 120)
  }
}

function onRequestStart(event) {
  if (event.detail?.id == null) return
  requests.add(event.detail.id)
  updateProgress()
}
function onRequestEnd(event) {
  if (event.detail?.id == null) return
  requests.delete(event.detail.id)
  updateProgress()
}

removeBeforeEach = router.beforeEach(to => {
  const id = ++nextNavigationId
  navigationIds.set(to, id)
  activeNavigationId = id
  navigationPending = true
  updateProgress()
})
function finishNavigation(to) {
  const id = to && navigationIds.get(to)
  if (!id || id !== activeNavigationId) return
  navigationPending = false
  updateProgress()
}
removeAfterEach = router.afterEach(to => finishNavigation(to))
removeOnError = router.onError((_error, to) => finishNavigation(to))

onMounted(() => {
  window.addEventListener('southwest:progress-start', onRequestStart)
  window.addEventListener('southwest:progress-end', onRequestEnd)
})

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('southwest:progress-start', onRequestStart)
    window.removeEventListener('southwest:progress-end', onRequestEnd)
  }
  removeBeforeEach?.()
  removeAfterEach?.()
  removeOnError?.()
  navigationPending = false
  requests.clear()
  clearTimeout(showTimer); clearTimeout(finishTimer); clearInterval(timer)
})

const style = computed(() => ({ width: `${width.value}%` }))
</script>

<template>
  <div class="route-progress-track" :class="{ visible: active }" aria-hidden="true">
    <div class="route-progress-bar" :style="style" />
  </div>
</template>

<style scoped>
.route-progress-track{position:fixed;top:0;left:0;width:100%;height:3px;z-index:2000;pointer-events:none;opacity:0;transition:opacity .12s ease}.route-progress-track.visible{opacity:1}.route-progress-bar{height:100%;background:#168b83;box-shadow:0 0 7px #168b8370;transition:width .16s ease}
@media(prefers-reduced-motion:reduce){.route-progress-track,.route-progress-bar{transition:none}}
</style>
