
import { createApp } from 'vue'
import './style.css'
import './assets/styles/Variable.css'
import App from './App.vue'
import router from './router'
import { setAnalyticsConsent } from './services/analytics'

// Reset links may carry a one-time token. Keep analytics scripts off this
// document so a tag manager cannot collect the URL before Vue routing starts.
const isPasswordResetPage = window.location.pathname === '/reset-password'
if (isPasswordResetPage) {
    const referrerPolicy = document.createElement('meta')
    referrerPolicy.name = 'referrer'
    referrerPolicy.content = 'no-referrer'
    document.head.appendChild(referrerPolicy)
} else {
    // Temporary launch behavior to enable analytics without a consent prompt.
    setAnalyticsConsent(true)
}

createApp(App)
    .use(router)
    .mount('#app')
