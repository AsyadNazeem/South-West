
import { createApp } from 'vue'
import './style.css'
import './assets/styles/Variable.css'
import App from './App.vue'
import router from './router'
import { setAnalyticsConsent } from './services/analytics'

// Temporary launch behavior: enable analytics without showing the consent prompt.
setAnalyticsConsent(true)

createApp(App)
    .use(router)
    .mount('#app')
