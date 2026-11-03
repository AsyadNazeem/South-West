<script setup>
import { onMounted, onBeforeUnmount } from 'vue'
import {
  getAccessToken,
  logout as logoutSession
} from './auth/authorization'

const INACTIVITY_TIMEOUT = 15 * 60 * 1000
const LAST_ACTIVITY_KEY = 'admin_last_activity'

let inactivityInterval = null
let lastActivityWrite = 0
let logoutInProgress = false

const recordActivity = () => {
  if (!getAccessToken() || logoutInProgress) return

  const now = Date.now()

  if (now - lastActivityWrite < 1000) return

  lastActivityWrite = now
  localStorage.setItem(LAST_ACTIVITY_KEY, String(now))
}

const checkInactivity = async () => {
  if (!getAccessToken() || logoutInProgress) return

  const lastActivity = Number(
    localStorage.getItem(LAST_ACTIVITY_KEY)
  )

  if (
    !Number.isFinite(lastActivity) ||
    lastActivity <= 0 ||
    Date.now() - lastActivity >= INACTIVITY_TIMEOUT
  ) {
    logoutInProgress = true

    try {
      await logoutSession()
    } catch {
      // Local authentication is cleared by the logout function.
    }

    window.location.replace('/login')
  }
}

const handleStorageChange = (event) => {
  if (event.key === LAST_ACTIVITY_KEY) {
    lastActivityWrite = 0
  }

  if (event.key === 'token' && !event.newValue) {
    window.location.replace('/login')
  }
}

onMounted(() => {
  const activityEvents = [
    'pointerdown',
    'pointermove',
    'keydown',
    'scroll',
    'wheel',
    'touchstart'
  ]

  activityEvents.forEach((eventName) => {
    window.addEventListener(eventName, recordActivity, {
      passive: true
    })
  })

  window.addEventListener('storage', handleStorageChange)

  inactivityInterval = window.setInterval(
    checkInactivity,
    1000
  )

  checkInactivity()
})

onBeforeUnmount(() => {
  const activityEvents = [
    'pointerdown',
    'pointermove',
    'keydown',
    'scroll',
    'wheel',
    'touchstart'
  ]

  activityEvents.forEach((eventName) => {
    window.removeEventListener(eventName, recordActivity)
  })

  window.removeEventListener('storage', handleStorageChange)

  if (inactivityInterval) {
    window.clearInterval(inactivityInterval)
  }
})
</script>

<template>
  <RouterView />
</template>
