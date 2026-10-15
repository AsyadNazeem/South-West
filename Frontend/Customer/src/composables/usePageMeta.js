// src/composables/usePageMeta.js
// Sets <title>, description, robots, canonical, Open Graph and Twitter tags.
// No dependency needed. If you later add SSR/prerendering, swap this for @unhead/vue.
import { onMounted } from 'vue'

function upsertMeta(attr, key, content) {
    let el = document.head.querySelector(`meta[${attr}="${key}"]`)
    if (!el) {
        el = document.createElement('meta')
        el.setAttribute(attr, key)
        document.head.appendChild(el)
    }
    el.setAttribute('content', content)
}

function upsertCanonical(href) {
    let el = document.head.querySelector('link[rel="canonical"]')
    if (!el) {
        el = document.createElement('link')
        el.setAttribute('rel', 'canonical')
        document.head.appendChild(el)
    }
    el.setAttribute('href', href)
}

export function usePageMeta({
                                title,
                                description,
                                path = window.location.pathname,
                                index = true,
                                siteName = 'South-West',
                                image = '',
                            }) {
    onMounted(() => {
        const url = `${window.location.origin}${path}`

        document.title = title
        upsertMeta('name', 'description', description)
        upsertMeta('name', 'robots', index ? 'index, follow' : 'noindex, follow')
        upsertMeta('name', 'theme-color', '#263b55')
        upsertCanonical(url)

        upsertMeta('property', 'og:type', 'website')
        upsertMeta('property', 'og:site_name', siteName)
        upsertMeta('property', 'og:title', title)
        upsertMeta('property', 'og:description', description)
        upsertMeta('property', 'og:url', url)
        if (image) upsertMeta('property', 'og:image', image)

        upsertMeta('name', 'twitter:card', image ? 'summary_large_image' : 'summary')
        upsertMeta('name', 'twitter:title', title)
        upsertMeta('name', 'twitter:description', description)
        if (image) upsertMeta('name', 'twitter:image', image)
    })
}
