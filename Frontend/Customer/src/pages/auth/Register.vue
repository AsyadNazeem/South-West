<script setup>
import { ref } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import api from '@/services/api.js'
import { usePageMeta } from '@/composables/usePageMeta.js'

// Auth pages are usually noindex so Google focuses on product and category pages.
usePageMeta({
  title: 'Create Account | South-West',
  description:
      'Create your South-West account to shop online, track your orders and save your delivery details for faster checkout.',
  path: '/register',
  index: false,
})

const router = useRouter()

const form = ref({
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
})

const loading = ref(false)
const googleLoading = ref(false)
const errorMessage = ref('')
const showPassword = ref(false)

function validate() {
  if (form.value.password.length < 8) {
    return 'Your password must be at least 8 characters.'
  }

  if (new TextEncoder().encode(form.value.password).length > 72) {
    return 'Your password must not exceed 72 UTF-8 bytes.'
  }

  if (form.value.password !== form.value.confirmPassword) {
    return 'Your passwords do not match.'
  }

  return ''
}

async function register() {
  errorMessage.value = ''

  const validationError = validate()
  if (validationError) {
    errorMessage.value = validationError
    return
  }

  loading.value = true

  try {
    const response = await api.post('/customer-auth/register', {
      first_name: form.value.first_name.trim(),
      last_name: form.value.last_name.trim(),
      email: form.value.email.trim(),
      phone: form.value.phone.trim(),
      password: form.value.password,
    })

    const email = form.value.email.trim().toLowerCase()

    // Keep only the email needed for the next verification step.
    sessionStorage.setItem('pendingCustomerVerificationEmail', email)

    await router.push({
      path: '/verify-email',
      query: { email, ...(response.data?.verification_required ? { pending: '1' } : {}) },
    })
  } catch (error) {
    errorMessage.value =
        error.response?.data?.message || 'Unable to register. Please try again.'
  } finally {
    loading.value = false
  }
}

function signUpWithGoogle() {
  errorMessage.value = ''

  const apiBaseUrl = import.meta.env.VITE_API_URL

  if (!apiBaseUrl) {
    errorMessage.value = 'Google sign-up is not configured yet.'
    return
  }

  googleLoading.value = true
  // Same backend route as login: creates the account for a new Google email,
  // or signs in an existing one.
  window.location.assign(`${apiBaseUrl.replace(/\/+$/, '')}/customer-auth/google`)
}
</script>

<template>
  <main class="auth-page">
    <div class="auth-shell">
      <RouterLink to="/" class="back-home">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m15 18-6-6 6-6M9 12h12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>
        Back to Home
      </RouterLink>
      <section class="auth-card" aria-labelledby="register-title">
      <img src="/SWLogoBlack.webp" class="auth-logo" alt="South West" />

      <header class="heading">
        <h1 id="register-title">Create your account</h1>
        <p>It takes about a minute.</p>
      </header>

      <button
          type="button"
          class="google-button"
          :disabled="googleLoading || loading"
          @click="signUpWithGoogle"
      >
        <svg class="google-icon" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5h6.7c3.9-3.6 6-8.8 6-14.9Z" />
          <path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.8l-6.7-5c-1.8 1.2-4 2-6.8 2-5.3 0-9.8-3.6-11.4-8.4H5.7v5.2A20 20 0 0 0 24 44Z" />
          <path fill="#FBBC05" d="M12.6 27.8a12 12 0 0 1 0-7.6V15H5.7a20 20 0 0 0 0 18Z" />
          <path fill="#EA4335" d="M24 11.8c3 0 5.7 1 7.8 3.1l5.8-5.8C34.1 5.8 29.5 4 24 4A20 20 0 0 0 5.7 15l6.9 5.2c1.6-4.8 6.1-8.4 11.4-8.4Z" />
        </svg>
        {{ googleLoading ? 'Redirecting to Google…' : 'Sign up with Google' }}
      </button>

      <div class="divider" aria-hidden="true">
        <span></span>
        <span class="divider-text">or</span>
        <span></span>
      </div>

      <form class="auth-form" novalidate @submit.prevent="register">
        <div class="form-row">
          <div class="field">
            <label for="register-first-name" class="field-label">First name</label>
            <div class="field-box">
              <input
                  id="register-first-name"
                  v-model="form.first_name"
                  class="field-input"
                  name="first_name"
                  type="text"
                  autocomplete="given-name"
                  maxlength="100"
                  required
                  :disabled="loading"
              />
            </div>
          </div>
          <div class="field">
            <label for="register-last-name" class="field-label">Last name</label>
            <div class="field-box">
              <input
                  id="register-last-name"
                  v-model="form.last_name"
                  class="field-input"
                  name="last_name"
                  type="text"
                  autocomplete="family-name"
                  maxlength="100"
                  required
                  :disabled="loading"
              />
            </div>
          </div>
        </div>
        <div class="field">
          <label for="register-email" class="field-label">Email</label>
          <div class="field-box">
            <input
                id="register-email"
                v-model="form.email"
                class="field-input"
                name="email"
                type="email"
                autocomplete="email"
                placeholder="you@example.com"
                required
                :disabled="loading"
            />
          </div>
        </div>
        <div class="field">
          <label for="register-phone" class="field-label">Phone</label>
          <div class="field-box">
            <input
                id="register-phone"
                v-model="form.phone"
                class="field-input"
                name="phone"
                type="tel"
                autocomplete="tel"
                placeholder="Phone number"
                required
                :disabled="loading"
            />
          </div>
        </div>

        <!-- Password and confirm share one line -->
        <div class="form-row">
          <div class="field">
            <label for="register-password" class="field-label">Password</label>
            <div class="field-box">
              <input
                  id="register-password"
                  v-model="form.password"
                  class="field-input"
                  name="new-password"
                  :type="showPassword ? 'text' : 'password'"
                  autocomplete="new-password"
                  minlength="8"
                  placeholder="8+ characters"
                  required
                  :disabled="loading"
              />
              <button
                  type="button"
                  class="eye-button"
                  :aria-label="showPassword ? 'Hide passwords' : 'Show passwords'"
                  :aria-pressed="showPassword"
                  :disabled="loading"
                  @click="showPassword = !showPassword"
              >
                <svg v-if="!showPassword" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" />
                  <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.7" />
                </svg>
                <svg v-else viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M3 3l18 18" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
                  <path d="M10.6 6a9.6 9.6 0 0 1 1.4-.1c6 0 9.5 6.1 9.5 6.1a16.6 16.6 0 0 1-3.2 3.9M6.6 7.6A16.4 16.4 0 0 0 2.5 12S6 18.1 12 18.1c1.5 0 2.8-.4 4-.9" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
                  <path d="M9.9 10a3 3 0 0 0 4.1 4.1" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
                </svg>
              </button>
            </div>
          </div>

          <div class="field">
            <label for="register-confirm-password" class="field-label">Confirm password</label>
            <div class="field-box">
              <input
                  id="register-confirm-password"
                  v-model="form.confirmPassword"
                  class="field-input"
                  name="confirm-password"
                  :type="showPassword ? 'text' : 'password'"
                  autocomplete="new-password"
                  minlength="8"
                  placeholder="Repeat password"
                  required
                  :disabled="loading"
              />
            </div>
          </div>
        </div>

        <p v-if="errorMessage" class="form-error" role="alert">
          {{ errorMessage }}
        </p>

        <button class="submit-button" type="submit" :disabled="loading || googleLoading">
          {{ loading ? 'Creating account…' : 'Create account' }}
        </button>
      </form>

      <p class="footer">
        Already have an account?
        <RouterLink to="/login">Sign in</RouterLink>
      </p>
      </section>
    </div>
  </main>
</template>

<style scoped>
.auth-page {
  min-height: 100vh;
  min-height: 100dvh;
  display: grid;
  place-items: center;
  padding: var(--space-3) var(--space-4);
  background: var(--color-store-bg);
}

.auth-shell { width: min(620px, 100%); }
.back-home { display: inline-flex; align-items: center; gap: var(--space-2); margin: 0 0 var(--space-2) var(--space-1); color: var(--color-text-muted); font-size: var(--font-size-xs); text-decoration: none; }
.back-home:hover { color: var(--color-primary); }
.back-home:focus-visible { outline: 2px solid var(--color-focus-outline); outline-offset: 3px; }
.back-home svg { width: 16px; height: 16px; }

.auth-card {
  width: 100%;
  padding: var(--space-6) var(--space-8);
  background: var(--color-surface);
  border: 1px solid var(--color-border-soft);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.auth-logo { display: block; width: clamp(160px, 28vw, 210px); height: 54px; object-fit: contain; object-position: left center; margin: 0 0 var(--space-4); }

/* Heading */
.heading {
  margin-bottom: var(--space-4);
}

.heading h1 {
  margin: 0 0 var(--space-1);
  color: var(--color-text);
  font-family: var(--font-family-display);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  letter-spacing: var(--letter-spacing-heading);
  line-height: var(--line-height-tight);
}

.heading p {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

/* Google */
.google-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  width: 100%;
  height: var(--control-height);
  border: var(--border-width-field) solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text);
  font: inherit;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: background var(--transition-fast), border-color var(--transition-fast);
}

.google-button:hover:not(:disabled) {
  background: var(--color-surface-muted);
}

.google-button:focus-visible {
  outline: 2px solid var(--color-focus-outline);
  outline-offset: 2px;
}

.google-button:disabled {
  opacity: 0.6;
  cursor: wait;
}

.google-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

/* Divider */
.divider {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin: var(--space-5) 0;
}

.divider span:first-child,
.divider span:last-child {
  height: 1px;
  flex: 1;
  background: var(--color-border-soft);
}

.divider-text {
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
}

/* Form: two columns on desktop, one on mobile */
.auth-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

/* Only password and confirm password share a row */

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-5);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
}

.field-label {
  color: var(--color-text-label);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
}

/* Input and eye button share one box, so fields match in height */
.field-box {
  display: flex;
  align-items: center;
  height: 46px;
  background: var(--color-surface);
  border: var(--border-width-field) solid var(--color-border);
  border-radius: var(--radius-md);
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.field-box:hover {
  border-color: var(--color-text-muted);
}

.field-box:focus-within {
  border-color: var(--color-focus);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-focus-outline) 40%, transparent);
}

.field-box:has(.field-input:disabled) {
  background: var(--color-surface-muted);
}

.field-input {
  flex: 1;
  min-width: 0;
  height: 100%;
  padding: 0 var(--space-4);
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--color-text);
  font: inherit;
  font-size: var(--font-size-sm);
}

.field-input::placeholder {
  color: var(--color-text-muted);
}

.field-input:disabled {
  cursor: not-allowed;
}

/* Eye button: no border or fill */
.eye-button {
  display: grid;
  place-items: center;
  align-self: stretch;
  width: 44px;
  padding: 0;
  border: 0;
  border-radius: 0 var(--radius-md) var(--radius-md) 0;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: color var(--transition-fast);
}

.eye-button svg {
  width: 18px;
  height: 18px;
}

.eye-button:hover:not(:disabled) {
  color: var(--color-primary);
}

.eye-button:focus-visible {
  outline: 2px solid var(--color-focus-outline);
  outline-offset: -4px;
}

.eye-button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

/* Submit: flat primary colour */
.submit-button {
  width: 100%;
  height: 46px;
  margin-top: 0;
  border: 0;
  border-radius: var(--radius-md);
  background: var(--color-primary);
  color: var(--color-on-primary);
  font: inherit;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.submit-button:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.submit-button:focus-visible {
  outline: 2px solid var(--color-focus-outline);
  outline-offset: 3px;
}

.submit-button:disabled {
  opacity: 0.6;
  cursor: wait;
}

.form-error {
  margin: 0;
  padding: var(--space-3) var(--space-4);
  background: var(--color-danger-bg);
  border-left: 3px solid var(--color-danger);
  border-radius: var(--radius-sm);
  color: var(--color-danger);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
}

/* Footer */
.footer {
  margin: var(--space-4) 0 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  text-align: center;
}

.footer a {
  margin-left: var(--space-1);
  color: var(--color-primary);
  font-weight: var(--font-weight-semibold);
  text-decoration: none;
}

.footer a:hover {
  text-decoration: underline;
}

.footer a:focus-visible {
  outline: 2px solid var(--color-focus-outline);
  outline-offset: 2px;
}

@media (max-width: 480px) {
  .auth-page { place-items: start center; padding-top: var(--space-3); }
  .auth-card {
    padding: var(--space-5) var(--space-4);
  }

  .form-row {
    grid-template-columns: 1fr;
  }
}
</style>
