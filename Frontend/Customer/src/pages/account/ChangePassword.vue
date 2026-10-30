
<template>
  <section class="change-password">
    <h2 class="section-title">Change Password</h2>

    <p class="muted">
      We’ll send a verification code to your registered email address
      before changing your password.
    </p>

    <div v-if="!passwordChanged" class="password-card">
      <div class="step-heading">
        <span class="step-number">1</span>
        <div>
          <h3>Verify your email</h3>
          <p class="muted">
            Request a six-digit code to continue.
          </p>
        </div>
      </div>

      <button
        type="button"
        class="primary-button"
        :disabled="sendingCode || submitting"
        @click="requestCode"
      >
        {{ sendingCode ? 'Sending code...' : codeSent ? 'Resend code' : 'Send verification code' }}
      </button>

      <p v-if="expiresIn" class="hint">
        The code expires in 10 minutes.
      </p>

      <form v-if="codeSent" class="password-form" @submit.prevent="changePassword">
        <div class="step-heading">
          <span class="step-number">2</span>
          <div>
            <h3>Set your new password</h3>
            <p class="muted">
              Enter the code from your email and choose a new password.
            </p>
          </div>
        </div>

        <label for="verification-code">Verification code</label>
        <input
          id="verification-code"
          v-model.trim="code"
          type="text"
          inputmode="numeric"
          autocomplete="one-time-code"
          maxlength="6"
          pattern="[0-9]{6}"
          placeholder="Enter 6-digit code"
          required
        />

        <label for="new-password">New password</label>
        <input
          id="new-password"
          v-model="newPassword"
          type="password"
          autocomplete="new-password"
          minlength="8"
          maxlength="72"
          placeholder="At least 8 characters"
          required
        />

        <label for="confirm-password">Confirm new password</label>
        <input
          id="confirm-password"
          v-model="confirmPassword"
          type="password"
          autocomplete="new-password"
          minlength="8"
          maxlength="72"
          placeholder="Re-enter your new password"
          required
        />

        <p class="hint">
          Use at least 8 characters. Avoid sharing your password with anyone.
        </p>

        <button
          type="submit"
          class="primary-button"
          :disabled="submitting || sendingCode"
        >
          {{ submitting ? 'Changing password...' : 'Change password' }}
        </button>
      </form>
    </div>

    <div v-else class="success-panel">
      <h3>Password changed successfully</h3>
      <p class="muted">
        Your password has been updated and your active sessions have been
        revoked. Log in again using your new password.
      </p>
      <button type="button" class="primary-button" @click="goToLogin">
        Go to login
      </button>
    </div>

    <p v-if="errorMessage" class="feedback error" role="alert">
      {{ errorMessage }}
    </p>

    <p v-if="successMessage" class="feedback success" role="status">
      {{ successMessage }}
    </p>
  </section>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import api from '../../services/api'

const router = useRouter()

const sendingCode = ref(false)
const submitting = ref(false)
const codeSent = ref(false)
const passwordChanged = ref(false)
const expiresIn = ref(false)

const code = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const errorMessage = ref('')
const successMessage = ref('')

function getErrorMessage(error, fallback) {
  return error?.response?.data?.message || fallback
}

async function requestCode() {
  errorMessage.value = ''
  successMessage.value = ''
  sendingCode.value = true

  try {
    const response = await api.post('/customer-auth/password-change/request-code')

    codeSent.value = true
    expiresIn.value = true
    code.value = ''
    successMessage.value =
      response.data?.message || 'A verification code has been sent to your email.'
  } catch (error) {
    errorMessage.value = getErrorMessage(
      error,
      'Unable to send the verification code. Please try again.'
    )
  } finally {
    sendingCode.value = false
  }
}

async function changePassword() {
  errorMessage.value = ''
  successMessage.value = ''

  if (!/^\d{6}$/.test(code.value)) {
    errorMessage.value = 'Enter the six-digit verification code.'
    return
  }

  if (newPassword.value.length < 8) {
    errorMessage.value = 'Your password must contain at least 8 characters.'
    return
  }

  if (new TextEncoder().encode(newPassword.value).length > 72) {
    errorMessage.value = 'Your password must not exceed 72 UTF-8 bytes.'
    return
  }

  if (newPassword.value !== confirmPassword.value) {
    errorMessage.value = 'The passwords do not match.'
    return
  }

  submitting.value = true

  try {
    const response = await api.post('/customer-auth/password-change/confirm', {
      code: code.value,
      newPassword: newPassword.value,
    })

    passwordChanged.value = true
    codeSent.value = false
    expiresIn.value = false
    code.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
    successMessage.value = response.data?.message || 'Password changed successfully.'

    // The backend revokes all sessions, so remove the local session too.
    sessionStorage.removeItem('customerToken')
    sessionStorage.removeItem('customerProfile')
  } catch (error) {
    errorMessage.value = getErrorMessage(
      error,
      'Unable to change your password. Please try again.'
    )
  } finally {
    submitting.value = false
  }
}

async function goToLogin() {
  await router.push('/login')
}
</script>

<style scoped>
.change-password {
  width: 100%;
  max-width: 640px;
}

.section-title {
  margin: 0 0 12px;
  font-size: var(--font-size-md);
}

.muted {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  line-height: 1.7;
}

.password-card,
.success-panel {
  margin-top: 22px;
  padding: 22px;
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 12px;
}

.step-heading {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 18px;
}

.step-number {
  display: inline-flex;
  flex: 0 0 30px;
  width: 30px;
  height: 30px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--color-primary, #111827);
  color: #fff;
  font-weight: 700;
}

h3 {
  margin: 0 0 5px;
  font-size: 15px;
}

.step-heading .muted {
  margin: 0;
}

.password-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 28px;
}

.password-form label {
  margin-top: 8px;
  font-size: 13px;
  font-weight: 600;
}

.password-form input {
  width: 100%;
  min-height: 44px;
  padding: 10px 12px;
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: 8px;
  background: var(--color-surface, #fff);
  color: var(--color-text, #111827);
  font: inherit;
  box-sizing: border-box;
}

.password-form input:focus {
  outline: 2px solid var(--color-primary, #111827);
  outline-offset: 1px;
}

.primary-button {
  min-height: 44px;
  padding: 11px 16px;
  border: none;
  border-radius: 8px;
  background: var(--color-primary, #111827);
  color: #fff;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.primary-button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.hint {
  margin: 8px 0 0;
  color: var(--color-text-muted, #6b7280);
  font-size: 12px;
  line-height: 1.6;
}

.feedback {
  margin-top: 16px;
  font-size: 13px;
  line-height: 1.6;
}

.error {
  color: #b91c1c;
}

.success {
  color: #15803d;
}

.success-panel h3 {
  margin-bottom: 10px;
}

.success-panel .primary-button {
  margin-top: 12px;
}

@media (max-width: 600px) {
  .password-card,
  .success-panel {
    padding: 16px;
  }
}
</style>
