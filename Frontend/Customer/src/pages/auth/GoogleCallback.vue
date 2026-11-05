
<script setup>
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '@/services/api.js'

const route = useRoute()
const router = useRouter()

const message = ref('Completing Google sign-in…')

onMounted(async () => {
  // Remove the one-time code from the visible URL immediately.
  const code = typeof route.query.code === 'string'
    ? route.query.code
    : ''

  const googleError = typeof route.query.google_error === 'string'
    ? route.query.google_error
    : ''

  await router.replace({ path: '/auth/google/callback' })

  if (googleError) {
    const messages = {
      existing_account:
        'An account already exists with this email. Please sign in with your existing password.',
      cancelled: 'Google sign-in was cancelled.',
      invalid_state: 'Your sign-in session expired. Please try again.',
      not_configured: 'Google sign-in is not configured yet.',
      unverified_email: 'Google could not verify your email address.',
      profile_incomplete: 'Your Google profile is missing your first or last name.',
    }

    message.value = messages[googleError] ||
      'Google sign-in failed. Please try again.'

    return
  }

  if (!code) {
    message.value = 'The Google sign-in code is missing. Please try again.'
    return
  }

  try {
    const response = await api.post('/customer-auth/google/exchange', {
      code,
    })

    const token = response.data?.token
    const customer = response.data?.customer

    if (!token || !customer) {
      throw new Error('Incomplete authentication response')
    }

    sessionStorage.setItem('customerToken', token)
    sessionStorage.setItem(
      'customerProfile',
      JSON.stringify({
        id: customer.id,
        customer_code: customer.customer_code,
        first_name: customer.first_name,
        last_name: customer.last_name,
        email: customer.email,
      })
    )

    window.dispatchEvent(new Event('customer-auth-changed'))

    await router.replace('/')
  } catch (error) {
    console.error(
      'Google sign-in exchange failed:',
      error.response?.status || error.message
    )

    message.value =
      error.response?.data?.message ||
      'Unable to complete Google sign-in. Please try again.'
  }
})
</script>

<template>
  <main class="google-callback">
    <p role="status">{{ message }}</p>
    <RouterLink v-if="message !== 'Completing Google sign-in…'" to="/login">
      Return to login
    </RouterLink>
  </main>
</template>

<style scoped>
.google-callback {
  min-height: 60vh;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 1rem;
  padding: 2rem;
  text-align: center;
}
</style>
