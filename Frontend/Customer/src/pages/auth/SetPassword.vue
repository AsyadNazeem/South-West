<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL

const token = ref('')
const password = ref('')
const confirmPassword = ref('')
const loading = ref(true)
const submitting = ref(false)
const validToken = ref(false)
const showPassword = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const passwordsMatch = computed(() => password.value === confirmPassword.value)

onMounted(async () => {
  // Read the invitation token without logging or displaying it.
  const params = new URLSearchParams(window.location.search)
  token.value = params.get('token') || ''

  if (!token.value) {
    errorMessage.value = 'This password setup link is invalid or expired.'
    loading.value = false
    return
  }

  try {
    const response = await axios.post(
        `${API_URL}/customer-auth/validate-password-setup`,
        { token: token.value }
    )

    validToken.value = response.data.valid === true

    // Remove the token from the visible URL after reading it.
    window.history.replaceState({}, document.title, window.location.pathname)

    if (!validToken.value) {
      errorMessage.value = 'This password setup link is invalid or expired.'
    }
  } catch {
    errorMessage.value =
        'This password setup link is invalid or expired. Please request a new invitation if needed.'
  } finally {
    loading.value = false
  }
})

async function submitPassword() {
  errorMessage.value = ''
  successMessage.value = ''

  if (password.value.length < 8) {
    errorMessage.value = 'Your password must be at least 8 characters long.'
    return
  }

  if (new TextEncoder().encode(password.value).length > 72) {
    errorMessage.value = 'Your password is too long. Please use at most 72 UTF-8 bytes.'
    return
  }

  if (!passwordsMatch.value) {
    errorMessage.value = 'Your passwords do not match.'
    return
  }

  submitting.value = true

  try {
    const response = await axios.post(`${API_URL}/customer-auth/set-password`, {
      token: token.value,
      password: password.value,
      confirmPassword: confirmPassword.value,
    })

    successMessage.value =
        response.data.message || 'Your password has been created successfully.'

    validToken.value = false
    password.value = ''
    confirmPassword.value = ''
    token.value = ''
  } catch (error) {
    errorMessage.value =
        error.response?.data?.message || 'Unable to set your password. Please try again.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <main class="auth-page">
    <section class="auth-card" aria-labelledby="set-password-title">
      <RouterLink to="/" class="wordmark" aria-label="South West home">
        SOUTH<span>WEST</span>
      </RouterLink>

      <header class="heading">
        <h1 id="set-password-title">Set your password</h1>
        <p>Create a password to access your customer account.</p>
      </header>

      <p v-if="loading" class="status">Checking your invitation link…</p>

      <div v-else-if="successMessage" class="form-success" role="status">
        <p class="success-title">{{ successMessage }}</p>
        <p>You can now sign in to your account.</p>
        <RouterLink to="/login" class="success-link">Go to sign in</RouterLink>
      </div>

      <form v-else-if="validToken" class="auth-form" novalidate @submit.prevent="submitPassword">
        <div class="field">
          <label for="password" class="field-label">New password</label>
          <div class="field-box">
            <input
                id="password"
                v-model="password"
                class="field-input"
                :type="showPassword ? 'text' : 'password'"
                autocomplete="new-password"
                minlength="8"
                maxlength="72"
                placeholder="8+ characters"
                required
                :disabled="submitting"
            />
            <button
                type="button"
                class="eye-button"
                :aria-label="showPassword ? 'Hide passwords' : 'Show passwords'"
                :aria-pressed="showPassword"
                :disabled="submitting"
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
          <label for="confirmPassword" class="field-label">Confirm password</label>
          <div class="field-box">
            <input
                id="confirmPassword"
                v-model="confirmPassword"
                class="field-input"
                :type="showPassword ? 'text' : 'password'"
                autocomplete="new-password"
                minlength="8"
                maxlength="72"
                placeholder="Repeat password"
                required
                :disabled="submitting"
            />
          </div>
        </div>

        <p class="field-hint">Your invitation expires after 10 minutes.</p>

        <p v-if="errorMessage" class="form-error" role="alert">
          {{ errorMessage }}
        </p>

        <button class="submit-button" type="submit" :disabled="submitting">
          {{ submitting ? 'Setting password…' : 'Create password' }}
        </button>
      </form>

      <p v-else-if="errorMessage" class="form-error" role="alert">
        {{ errorMessage }}
      </p>

      <p v-if="!successMessage" class="footer">
        Already set up?
        <RouterLink to="/login">Sign in</RouterLink>
      </p>
    </section>
  </main>
</template>

<style scoped>
.auth-page {
  min-height: 100vh;
  min-height: 100dvh;
  display: grid;
  place-items: center;
  padding: var(--space-4);
  background: var(--color-store-bg);
}

.auth-card {
  width: min(var(--container-auth), 100%);
  padding: var(--space-8) var(--space-10);
  background: var(--color-surface);
  border: 1px solid var(--color-border-soft);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.wordmark {
  display: inline-block;
  margin-bottom: var(--space-6);
  color: var(--color-primary);
  font-family: var(--font-family-display);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-bold);
  letter-spacing: 0.16em;
  text-decoration: none;
}

.wordmark span {
  color: var(--color-accent-deep);
  font-weight: var(--font-weight-medium);
}

.heading {
  margin-bottom: var(--space-5);
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

.heading p,
.status {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-base);
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.field-label {
  color: var(--color-text-label);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
}

.field-box {
  display: flex;
  align-items: center;
  height: var(--field-height);
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

.field-hint {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
}

.submit-button {
  width: 100%;
  height: var(--field-height);
  margin-top: var(--space-1);
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

.form-success {
  padding: var(--space-4);
  background: var(--color-success-bg);
  border-left: 3px solid var(--color-success);
  border-radius: var(--radius-sm);
  color: var(--color-success);
  font-size: var(--font-size-sm);
}

.form-success p {
  margin: 0;
}

.success-title {
  font-weight: var(--font-weight-semibold);
}

.success-link {
  display: inline-block;
  margin-top: var(--space-3);
  color: var(--color-primary);
  font-weight: var(--font-weight-semibold);
  text-decoration: none;
}

.footer {
  margin: var(--space-5) 0 0;
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

@media (max-width: 480px) {
  .auth-card {
    padding: var(--space-6) var(--space-5);
  }
}
</style>
