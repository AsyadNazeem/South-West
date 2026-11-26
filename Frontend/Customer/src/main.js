
import { createApp } from 'vue'
import './style.css'
import './assets/styles/Variable.css'
import App from './App.vue'
import router from './router'
import { nextTick } from 'vue'
import { useWebsiteTheme } from './composables/useWebsiteTheme'
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

const app = createApp(App).use(router)
const { loadActiveTheme } = useWebsiteTheme()

async function prepareSeasonalDecorations(theme) {
    const slug = theme?.slug
    const components = {}

    if (['christmas', 'ramadan', 'eid'].includes(slug)) {
        components.seasonal = import('./components/SeasonalDecorations.vue')
    }

    if (['sinhala-tamil-new-year', 'valentines-day'].includes(slug)) {
        components.floral = import('./components/FloralHeader.vue')
    }

    if (slug === 'new-year') {
        components.fireworks = import('./components/NewYearFireworks.vue')
    }

    window.__websiteThemeComponents = components

    let timer

    try {
        await Promise.race([
            Promise.allSettled(Object.values(components)),
            new Promise(resolve => {
                timer = setTimeout(resolve, 1000)
            })
        ])
    } finally {
        clearTimeout(timer)
    }
}

async function initializeStorefront() {
    try {
        const [theme] = await Promise.all([
            loadActiveTheme(),
            router.isReady()
        ])

        await prepareSeasonalDecorations(theme)

        app.mount('#app')
        await nextTick()
    } finally {
        clearTimeout(window.__websiteThemeRevealTimer)
        document.documentElement.removeAttribute('data-theme-pending')
    }
}

initializeStorefront().catch(error => {
    console.error('Storefront initialization failed:', error)
})
