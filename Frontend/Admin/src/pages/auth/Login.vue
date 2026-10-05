<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { login as loginRequest } from '../../api/authApi'
import { setAuthenticatedSession } from '../../auth/authorization'

const router = useRouter()

const email = ref('')
const password = ref('')
const loading = ref(false)
const errorMessage = ref('')

const login = async () => {
  errorMessage.value = ''

  if (!email.value || !password.value) {
    errorMessage.value = 'Email and password are required.'
    return
  }

  try {
    loading.value = true

    const session = await loginRequest({
      email: email.value,
      password: password.value
    })

    setAuthenticatedSession(session)

    router.replace('/admin/dashboard')
  } catch (error) {
    errorMessage.value =
        error.response?.data?.message ||
        error.message ||
        'Login failed. Please check your credentials.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-card">

      <div class="login-header">
        <h1>South West</h1>
        <p>Admin Portal</p>
      </div>

      <form @submit.prevent="login">

        <div class="form-group">
          <label>Email</label>

          <input
              v-model="email"
              type="email"
              placeholder="Enter your email"
              autocomplete="email"
          />
        </div>

        <div class="form-group">
          <label>Password</label>

          <input
              v-model="password"
              type="password"
              placeholder="Enter your password"
              autocomplete="current-password"
          />
        </div>

        <div v-if="errorMessage" class="error-message">
          {{ errorMessage }}
        </div>

        <button
            type="submit"
            :disabled="loading"
        >
          {{ loading ? 'Signing in...' : 'Sign In' }}
        </button>

      </form>

    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-xl, 24px);
  background: var(--color-background, #f9fafb);
  font-family: var(--font-family, inherit);
  box-sizing: border-box;
}

/* =========================
   Card
   ========================= */

.login-card {
  width: 100%;
  max-width: 400px;
  padding: 36px 32px;
  background: var(--color-surface, #ffffff);
  border: 1px solid var(--color-border-light, #e5e7eb);
  border-radius: var(--radius-lg, 12px);
  box-shadow: var(--shadow-sm, 0 1px 3px rgba(0, 0, 0, 0.08));
  box-sizing: border-box;
}

/* =========================
   Header
   ========================= */

.login-header {
  margin-bottom: 28px;
  text-align: center;
}

.login-header h1 {
  margin: 0;
  font-size: var(--font-size-2xl, 28px);
  font-weight: var(--font-weight-bold, 700);
  color: var(--color-text-primary, #111827);
}

.login-header p {
  margin: 6px 0 0;
  font-size: var(--font-size-md, 14px);
  color: var(--color-text-secondary, #6b7280);
}

/* =========================
   Form
   ========================= */

.form-group {
  display: flex;
  flex-direction: column;
  margin-bottom: 18px;
}

.form-group label {
  margin-bottom: 7px;
  font-size: var(--font-size-sm, 13px);
  font-weight: var(--font-weight-semibold, 600);
  color: var(--color-text-secondary, #374151);
}

.form-group input {
  width: 100%;
  height: 42px;
  padding: 0 var(--spacing-lg, 14px);
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: var(--radius-lg, 8px);
  background: var(--color-surface, #ffffff);
  color: var(--color-text-primary, #111827);
  font-family: inherit;
  font-size: var(--font-size-md, 14px);
  outline: none;
  box-sizing: border-box;
  transition: border-color var(--transition-fast, 0.15s ease),
  box-shadow var(--transition-fast, 0.15s ease);
}

.form-group input::placeholder {
  color: var(--color-text-muted, #9ca3af);
}

.form-group input:focus {
  border-color: var(--color-primary, #2563eb);
  box-shadow: 0 0 0 3px var(--color-primary-light, rgba(37, 99, 235, 0.12));
}

/* =========================
   Error
   ========================= */

.error-message {
  margin-bottom: 18px;
  padding: var(--spacing-md, 10px) var(--spacing-lg, 14px);
  border-radius: var(--radius-lg, 8px);
  background: var(--color-danger-bg, #fef2f2);
  color: var(--color-danger, #b91c1c);
  font-size: var(--font-size-sm, 13px);
}

/* =========================
   Button
   ========================= */

button[type="submit"] {
  width: 100%;
  height: 42px;
  border: none;
  border-radius: var(--radius-lg, 8px);
  background: var(--color-primary, #2563eb);
  color: var(--color-text-light, #ffffff);
  font-family: inherit;
  font-size: var(--font-size-md, 14px);
  font-weight: var(--font-weight-semibold, 600);
  cursor: pointer;
  transition: background var(--transition-fast, 0.15s ease);
}

button[type="submit"]:hover:not(:disabled) {
  background: var(--color-primary-hover, #1d4ed8);
}

button[type="submit"]:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--color-primary-light, rgba(37, 99, 235, 0.2));
}

button[type="submit"]:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* =========================
   Responsive
   ========================= */

@media (max-width: 480px) {
  .login-page {
    padding: 16px;
  }

  .login-card {
    padding: 28px 20px;
  }
}
</style>
