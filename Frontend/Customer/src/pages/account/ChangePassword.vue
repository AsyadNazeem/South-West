<script setup>
import AccountPageHeader from '@/components/account/AccountPageHeader.vue'
import { accountFeedback } from '@/utils/accountFeedback'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/services/api'

const router = useRouter()
const showPasswords = ref(false)

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
  return accountFeedback(error,fallback)
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

<template>
  <section class="change-password">
    <AccountPageHeader title="Account security" description="Change your password using a code sent to your registered email." />

    <p v-if="errorMessage" class="notice error" role="alert">{{ errorMessage }}</p>
    <p v-if="successMessage && !passwordChanged" class="notice success" role="status">{{ successMessage }}</p>

    <article v-if="!passwordChanged" class="card">

      <!-- Step 1 -->
      <div class="col">
        <div class="step">
          <span class="step-number" :class="{ done: codeSent }">
            <svg v-if="codeSent" viewBox="0 0 24 24" aria-hidden="true"><path d="m5.5 12.5 4.2 4.2L18.5 8" /></svg>
            <template v-else>1</template>
          </span>
          <div>
            <h3>Verify your email</h3>
            <p class="muted">Request a six-digit code to continue.</p>
          </div>
        </div>

        <button type="button" class="btn" :class="{ primary: !codeSent }" :disabled="sendingCode || submitting" @click="requestCode">
          {{ sendingCode ? 'Sending code…' : codeSent ? 'Resend code' : 'Send verification code' }}
        </button>

        <p v-if="expiresIn" class="muted">The code expires in 10 minutes.</p>
      </div>

      <!-- Step 2 -->
      <div class="col side">
        <div class="step">
          <span class="step-number" :class="{ off: !codeSent }">2</span>
          <div>
            <h3>Set your new password</h3>
            <p class="muted">Enter the code from your email and choose a new password.</p>
          </div>
        </div>

        <form v-if="codeSent" class="password-form" @submit.prevent="changePassword">
          <div class="field">
            <label for="verification-code">Verification code</label>
            <input id="verification-code" v-model.trim="code" type="text" inputmode="numeric" autocomplete="one-time-code"
                   maxlength="6" pattern="[0-9]{6}" placeholder="6-digit code" required />
          </div>

          <div class="field">
            <label for="new-password">New password</label>
            <input id="new-password" v-model="newPassword" :type="showPasswords ? 'text' : 'password'" autocomplete="new-password"
                   minlength="8" maxlength="72" placeholder="At least 8 characters" required />
          </div>

          <div class="field">
            <label for="confirm-password">Confirm new password</label>
            <input id="confirm-password" v-model="confirmPassword" :type="showPasswords ? 'text' : 'password'" autocomplete="new-password"
                   minlength="8" maxlength="72" placeholder="Re-enter your new password" required />
          </div>

          <button type="button" class="link" :aria-pressed="showPasswords" @click="showPasswords = !showPasswords">
            {{ showPasswords ? 'Hide passwords' : 'Show passwords' }}
          </button>

          <p class="muted">Use at least 8 characters. Avoid sharing your password with anyone.</p>

          <button type="submit" class="btn primary" :disabled="submitting || sendingCode">
            {{ submitting ? 'Changing password…' : 'Change password' }}
          </button>
        </form>

        <p v-else class="locked">Request a code first to unlock this step.</p>
      </div>

    </article>

    <!-- Success -->
    <div v-else class="state">
      <h3>Password changed successfully</h3>
      <p class="muted">Your password has been updated and your active sessions have been revoked. Log in again using your new password.</p>
      <button type="button" class="btn primary" @click="goToLogin">Go to login</button>
    </div>
  </section>
</template>

<style scoped>
.change-password { width: 100%; min-width: 0; color: var(--color-text); }
.muted { margin: 0; color: var(--color-text-muted); font-size: 12px; line-height: 1.55; }
button:disabled { cursor: not-allowed; opacity: .55; }

/* Notices */
.notice { margin: 0 0 14px; padding: 10px 14px; border-radius: var(--radius-md); font-size: 13px; line-height: 1.5; }
.notice.success { background: #ecfdf3; color: #166534; border: 1px solid #bbf7d0; }
.notice.error { background: #fef2f2; color: #b42318; border: 1px solid #fecaca; }

/* Two-half card */
.card { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr); min-width: 0; overflow: hidden; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-lg); box-shadow: var(--shadow-sm); }
.col { display: flex; flex-direction: column; align-items: flex-start; gap: 14px; min-width: 0; padding: 20px; }
.side { align-items: stretch; background: color-mix(in srgb, var(--color-primary) 5%, var(--color-surface)); border-left: 1px solid var(--color-border); }

/* Steps */
.step { display: flex; align-items: flex-start; gap: 12px; }
.step h3 { margin: 0 0 2px; font-family: var(--font-family-display); font-size: 15px; font-weight: 700; }
.step-number { display: grid; place-items: center; flex: none; width: 26px; height: 26px; background: var(--color-primary); color: var(--color-on-primary); border-radius: 50%; font-size: 12px; font-weight: 700; }
.step-number.off { background: var(--color-border); color: var(--color-text-muted); }
.step-number svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; }
.locked { margin: 0; padding: 14px; color: var(--color-text-muted); font-size: 13px; text-align: center; border: 1px dashed var(--color-border); border-radius: var(--radius-md); }

/* Buttons */
.btn { display: inline-flex; align-items: center; justify-content: center; min-height: 40px; padding: 0 18px; background: var(--color-surface); color: var(--color-text); border: 1px solid var(--color-border); border-radius: var(--radius-md); font: 600 13px/1 var(--font-family-base); white-space: nowrap; cursor: pointer; transition: border-color .15s ease, color .15s ease, background .15s ease; }
.btn:hover:not(:disabled) { border-color: var(--color-primary); color: var(--color-primary); }
.btn.primary { background: var(--color-primary); border-color: var(--color-primary); color: var(--color-on-primary); }
.btn.primary:hover:not(:disabled) { background: var(--color-primary-hover); border-color: var(--color-primary-hover); color: var(--color-on-primary); }
.link { align-self: flex-start; padding: 0; background: none; border: 0; color: var(--color-primary); font: 600 12px/1.4 var(--font-family-base); cursor: pointer; }
.link:hover { text-decoration: underline; }
.btn:focus-visible, .link:focus-visible { outline: 2px solid var(--color-focus-outline); outline-offset: 2px; }

/* Form */
.password-form { display: flex; flex-direction: column; gap: 14px; }
.password-form .btn { align-self: flex-start; }
.field { display: flex; flex-direction: column; gap: 6px; }
.field label { color: var(--color-text-label); font-size: 12px; font-weight: 600; }
.field input { box-sizing: border-box; width: 100%; height: 40px; padding: 0 12px; background: var(--color-surface); color: var(--color-text); border: 1px solid var(--color-border); border-radius: var(--radius-md); font: 400 14px var(--font-family-base); transition: border-color .15s ease, box-shadow .15s ease; }
.field input::placeholder { color: var(--color-text-muted); }
.field input:focus { outline: none; border-color: var(--color-focus); box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-focus) 16%, transparent); }
#verification-code { font-variant-numeric: tabular-nums; letter-spacing: .15em; }

/* Success */
.state { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 48px 20px; text-align: center; background: var(--color-surface); border: 1px solid var(--color-border-soft); border-radius: var(--radius-lg); }
.state h3 { margin: 0; font-family: var(--font-family-display); font-size: 16px; }
.state .muted { max-width: 46ch; margin-bottom: 10px; font-size: 13px; }

@media (max-width: 760px) {
  .card { grid-template-columns: minmax(0, 1fr); }
  .side { border-left: 0; border-top: 1px solid var(--color-border); }
  .col { padding: 16px; }
}
@media (max-width: 560px) { .field input { font-size: 16px; } }
</style>
