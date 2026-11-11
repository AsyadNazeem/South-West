<script setup>
import { computed, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import api from '@/services/api'

const route = useRoute()
let fragmentToken = ''
if (typeof window !== 'undefined') {
  fragmentToken = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('token') || ''
  if (fragmentToken) {
    window.history.replaceState(
      window.history.state,
      '',
      `${window.location.pathname}${window.location.search}`,
    )
  }
}
const token = (typeof route.query.token === 'string' ? route.query.token : '') || fragmentToken || ''
const password = ref('')
const confirmPassword = ref('')
const showPassword = ref(false)
const showConfirmPassword = ref(false)
const loading = ref(false)
const success = ref(false)
const errorMessage = ref('')
if (!token) errorMessage.value = 'This password reset link is invalid or expired.'
const passwordsMatch = computed(() => password.value === confirmPassword.value)

async function submitReset() {
  errorMessage.value = ''
  if (!token) { errorMessage.value = 'This password reset link is invalid or expired.'; return }
  if (password.value.length < 8) { errorMessage.value = 'Password must be at least 8 characters long.'; return }
  if (new TextEncoder().encode(password.value).length > 72) { errorMessage.value = 'Password must not exceed 72 UTF-8 bytes.'; return }
  if (!passwordsMatch.value) { errorMessage.value = 'Your passwords do not match.'; return }

  loading.value = true
  try {
    await api.post('/customer-auth/reset-password', { token, newPassword: password.value })
    success.value = true
    password.value = ''
    confirmPassword.value = ''
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'This password reset link is invalid or expired.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="auth-page">
    <div class="auth-shell">
      <section class="auth-card" aria-labelledby="reset-title">
        <img src="/SWLogoBlack.webp" class="auth-logo" alt="South West" />
        <header class="heading">
          <h1 id="reset-title">Create a new password</h1>
          <p>Choose a new password for your South West account.</p>
        </header>
        <form v-if="!success" class="auth-form" novalidate @submit.prevent="submitReset">
          <div class="field">
            <label class="field-label" for="new-password">New password</label>
            <div class="field-box"><input id="new-password" v-model="password" class="field-input" :type="showPassword ? 'text' : 'password'" autocomplete="new-password" required :disabled="loading" /><button class="eye-button" type="button" :aria-label="showPassword ? 'Hide password' : 'Show password'" @click="showPassword = !showPassword">{{ showPassword ? 'Hide' : 'Show' }}</button></div>
          </div>
          <div class="field">
            <label class="field-label" for="confirm-password">Confirm new password</label>
            <div class="field-box"><input id="confirm-password" v-model="confirmPassword" class="field-input" :type="showConfirmPassword ? 'text' : 'password'" autocomplete="new-password" required :disabled="loading" /><button class="eye-button" type="button" :aria-label="showConfirmPassword ? 'Hide password' : 'Show password'" @click="showConfirmPassword = !showConfirmPassword">{{ showConfirmPassword ? 'Hide' : 'Show' }}</button></div>
          </div>
          <p class="field-hint">Use at least 8 characters and no more than 72 UTF-8 bytes.</p>
          <p v-if="confirmPassword && !passwordsMatch" class="form-error" role="alert">Your passwords do not match.</p>
          <p v-if="errorMessage" class="form-error" role="alert">{{ errorMessage }}</p>
          <button class="submit-button" type="submit" :disabled="loading">{{ loading ? 'Resetting…' : 'Reset Password' }}</button>
        </form>
        <div v-else class="success-panel" role="status">
          <p>Your password has been reset. You can now sign in with your new password.</p>
          <RouterLink class="submit-button link-button" to="/login">Return to Login</RouterLink>
        </div>
        <p v-if="!success" class="footer"><RouterLink to="/login">Back to Login</RouterLink></p>
      </section>
    </div>
  </main>
</template>

<style scoped>
.auth-page { min-height: 100vh; min-height: 100dvh; display: grid; place-items: center; padding: var(--space-4); background: var(--color-store-bg); }
.auth-shell { width: min(var(--container-auth), 100%); }
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
.field-input { flex: 1; min-width: 0; height: 100%; padding: 0 var(--space-4); border: 0; outline: 0; background: transparent; color: var(--color-text); font: inherit; font-size: var(--font-size-sm); }
.eye-button { align-self: stretch; padding: 0 var(--space-3); border: 0; background: transparent; color: var(--color-primary); font: inherit; font-size: var(--font-size-xs); cursor: pointer; }
.field-hint { margin: 0; color: var(--color-text-muted); font-size: var(--font-size-xs); }
.submit-button { display: grid; place-items: center; width: 100%; min-height: var(--control-height); margin-top: var(--space-2); border: 0; border-radius: var(--radius-md); background: var(--color-primary); color: var(--color-on-primary); font: inherit; font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); text-decoration: none; cursor: pointer; }
.submit-button:disabled { opacity: .6; cursor: wait; }
.link-button { box-sizing: border-box; }
.form-error { margin: 0; padding: var(--space-3) var(--space-4); background: var(--color-danger-bg); border-left: 3px solid var(--color-danger); border-radius: var(--radius-sm); color: var(--color-danger); font-size: var(--font-size-xs); }
.success-panel p { color: var(--color-text); font-size: var(--font-size-sm); }
.footer { margin: var(--space-4) 0 0; text-align: center; font-size: var(--font-size-xs); }
.footer a { color: var(--color-primary); font-weight: var(--font-weight-semibold); text-decoration: none; }
@media (max-width: 480px) { .auth-card { padding: var(--space-6) var(--space-5); } }
</style>
