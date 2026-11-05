<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import api from '@/services/api'

const route = useRoute()
const router = useRouter()

const email = ref(
    typeof route.query.email === 'string'
        ? route.query.email.trim().toLowerCase()
        : sessionStorage.getItem('pendingCustomerVerificationEmail') || '',
)

const code = ref('')
const loading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const validCode = computed(() => /^\d{6}$/.test(code.value.trim()))

onMounted(() => {
  if (!email.value) {
    errorMessage.value = 'Registration email not found. Please register again.'
  }
})

async function verifyEmail() {
  errorMessage.value = ''
  successMessage.value = ''

  if (!email.value || !validCode.value) {
    errorMessage.value = 'Enter the six-digit code sent to your email.'
    return
  }

  loading.value = true

  try {
    const response = await api.post('/customer-auth/verify-email', {
      email: email.value,
      code: code.value.trim(),
      purpose: 'registration',
    })

    successMessage.value = response.data.message || 'Your email has been verified.'

    sessionStorage.removeItem('pendingCustomerVerificationEmail')

    // Give the customer time to read the confirmation.
    window.setTimeout(() => {
      router.push('/login')
    }, 1200)
  } catch (error) {
    errorMessage.value =
        error.response?.data?.message || 'Unable to verify your email. Please try again.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="auth-page">
    <section class="auth-card" aria-labelledby="verify-title">
      <RouterLink to="/" class="wordmark" aria-label="South West home">
        SOUTH<span>WEST</span>
      </RouterLink>

      <header class="heading">
        <h1 id="verify-title">Verify your email</h1>
        <p>
          Enter the six-digit code sent to
          <strong class="email">{{ email || 'your email address' }}</strong>.
        </p>
      </header>

      <form class="auth-form" novalidate @submit.prevent="verifyEmail">
        <div class="field">
          <label for="code" class="field-label">Verification code</label>
          <div class="field-box">
            <input
                id="code"
                v-model="code"
                class="field-input code-input"
                type="text"
                inputmode="numeric"
                autocomplete="one-time-code"
                pattern="[0-9]{6}"
                maxlength="6"
                placeholder="000000"
                required
                :disabled="loading || !!successMessage"
            />
          </div>
          <p class="field-hint">The code expires after 10 minutes.</p>
        </div>

        <p v-if="errorMessage" class="form-error" role="alert">
          {{ errorMessage }}
        </p>

        <p v-if="successMessage" class="form-success" role="status">
          {{ successMessage }} Redirecting to sign in…
        </p>

        <button
            class="submit-button"
            type="submit"
            :disabled="loading || !!successMessage"
        >
          {{ loading ? 'Verifying…' : 'Verify email' }}
        </button>
      </form>

      <p class="footer">
        Already verified?
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

.heading p {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-base);
}

.email {
  color: var(--color-text);
  font-weight: var(--font-weight-semibold);
  word-break: break-all;
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

/* Code is easier to read with wide spacing and centred digits */
.code-input {
  text-align: center;
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0.5em;
}

.field-input::placeholder {
  color: var(--color-text-muted);
  letter-spacing: 0.5em;
}

.field-input:disabled {
  cursor: not-allowed;
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
  margin: 0;
  padding: var(--space-3) var(--space-4);
  background: var(--color-success-bg);
  border-left: 3px solid var(--color-success);
  border-radius: var(--radius-sm);
  color: var(--color-success);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
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
