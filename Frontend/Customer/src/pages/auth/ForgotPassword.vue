<script setup>
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import api from '@/services/api'

const email = ref('')
const loading = ref(false)
const submitted = ref(false)
const errorMessage = ref('')
const genericMessage = 'If an account exists with this email address, you will receive instructions to reset your password.'

async function submitRequest() {
  errorMessage.value = ''
  submitted.value = false
  const normalized = email.value.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    errorMessage.value = 'Enter a valid email address.'
    return
  }

  loading.value = true
  try {
    await api.post('/customer-auth/forgot-password', { email: normalized })
    submitted.value = true
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Unable to process your request. Please try again later.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="auth-page">
    <div class="auth-shell">
      <RouterLink to="/" class="back-home">← Back to Home</RouterLink>
      <section class="auth-card" aria-labelledby="forgot-title">
        <img src="/SWLogoBlack.webp" class="auth-logo" alt="South West" />
        <header class="heading">
          <h1 id="forgot-title">Forgot your password?</h1>
          <p>Enter the email address associated with your account and we’ll send reset instructions.</p>
        </header>
        <form class="auth-form" novalidate @submit.prevent="submitRequest">
          <div class="field">
            <label class="field-label" for="forgot-email">Email</label>
            <div class="field-box"><input id="forgot-email" v-model="email" class="field-input" type="email" autocomplete="email" maxlength="255" required :disabled="loading" /></div>
          </div>
          <p v-if="errorMessage" class="form-error" role="alert">{{ errorMessage }}</p>
          <p v-if="submitted" class="form-success" role="status">{{ genericMessage }}</p>
          <button class="submit-button" type="submit" :disabled="loading">{{ loading ? 'Sending…' : 'Send Reset Link' }}</button>
        </form>
        <p class="footer"><RouterLink to="/login">Back to Login</RouterLink></p>
      </section>
    </div>
  </main>
</template>

<style scoped>
.auth-page { min-height: 100vh; min-height: 100dvh; display: grid; place-items: center; padding: var(--space-4); background: var(--color-store-bg); }
.auth-shell { width: min(var(--container-auth), 100%); }
.back-home { display: inline-block; margin: 0 0 var(--space-3) var(--space-1); color: var(--color-text-muted); font-size: var(--font-size-xs); text-decoration: none; }
.auth-card { width: 100%; padding: var(--space-8); background: var(--color-surface); border: 1px solid var(--color-border-soft); border-radius: var(--radius-lg); box-shadow: var(--shadow-sm); }
.auth-logo { display: block; width: clamp(160px, 28vw, 210px); height: 54px; object-fit: contain; object-position: left center; margin-bottom: var(--space-4); }
.heading { margin-bottom: var(--space-4); }
.heading h1 { margin: 0 0 var(--space-1); color: var(--color-text); font-family: var(--font-family-display); font-size: var(--font-size-lg); font-weight: var(--font-weight-bold); line-height: var(--line-height-tight); }
.heading p { margin: 0; color: var(--color-text-muted); font-size: var(--font-size-sm); }
.auth-form { display: flex; flex-direction: column; gap: var(--space-3); }
.field { display: flex; flex-direction: column; gap: var(--space-2); }
.field-label { color: var(--color-text-label); font-size: var(--font-size-xs); font-weight: var(--font-weight-semibold); }
.field-box { display: flex; align-items: center; height: var(--control-height); border: var(--border-width-field) solid var(--color-border); border-radius: var(--radius-md); background: var(--color-surface); }
.field-box:focus-within { border-color: var(--color-focus); box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-focus-outline) 40%, transparent); }
.field-input { width: 100%; height: 100%; padding: 0 var(--space-4); border: 0; outline: 0; background: transparent; color: var(--color-text); font: inherit; font-size: var(--font-size-sm); }
.submit-button { width: 100%; height: var(--control-height); margin-top: var(--space-2); border: 0; border-radius: var(--radius-md); background: var(--color-primary); color: var(--color-on-primary); font: inherit; font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); cursor: pointer; }
.submit-button:disabled { opacity: .6; cursor: wait; }
.form-error,.form-success { margin: 0; padding: var(--space-3) var(--space-4); border-radius: var(--radius-sm); font-size: var(--font-size-xs); }
.form-error { background: var(--color-danger-bg); border-left: 3px solid var(--color-danger); color: var(--color-danger); }
.form-success { background: var(--color-surface-muted); color: var(--color-text); }
.footer { margin: var(--space-4) 0 0; text-align: center; font-size: var(--font-size-xs); }
.footer a { color: var(--color-primary); font-weight: var(--font-weight-semibold); text-decoration: none; }
@media (max-width: 480px) { .auth-card { padding: var(--space-6) var(--space-5); } }
</style>
