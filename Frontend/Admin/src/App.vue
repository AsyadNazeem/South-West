<script setup>
import { onMounted, onBeforeUnmount } from 'vue'
import {
  getAccessToken,
  logout as logoutSession
} from './auth/authorization'
import { heartbeat } from './api/authApi'

const INACTIVITY_TIMEOUT = 15 * 60 * 1000
const HEARTBEAT_INTERVAL = 60 * 1000

const LAST_ACTIVITY_KEY = 'admin_last_activity'

let inactivityInterval = null
let heartbeatInterval = null
let lastActivityWrite = 0
let heartbeatInProgress = false
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
      // Authentication is cleared locally by logoutSession.
    }

    window.location.replace('/login')
  }
}

const sendHeartbeat = async () => {
  if (
    !getAccessToken() ||
    logoutInProgress ||
    heartbeatInProgress
  ) {
    return
  }

  const lastActivity = Number(
    localStorage.getItem(LAST_ACTIVITY_KEY)
  )

  if (
    !Number.isFinite(lastActivity) ||
    lastActivity <= 0 ||
    Date.now() - lastActivity >= INACTIVITY_TIMEOUT
  ) {
    return
  }

  heartbeatInProgress = true

  try {
    await heartbeat()
  } catch (error) {
    if (error.response?.status === 401) {
      window.location.replace('/login')
    }
  } finally {
    heartbeatInProgress = false
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

const activityEvents = [
  'pointerdown',
  'pointermove',
  'keydown',
  'scroll',
  'wheel',
  'touchstart'
]

onMounted(() => {
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

  heartbeatInterval = window.setInterval(
    sendHeartbeat,
    HEARTBEAT_INTERVAL
  )

  checkInactivity()
})

onBeforeUnmount(() => {
  activityEvents.forEach((eventName) => {
    window.removeEventListener(eventName, recordActivity)
  })

  window.removeEventListener('storage', handleStorageChange)

  if (inactivityInterval) {
    window.clearInterval(inactivityInterval)
  }

  if (heartbeatInterval) {
    window.clearInterval(heartbeatInterval)
  }
})
</script>

<template>
  <RouterView />
</template>
