const SITE_URL = 'https://southwest.lk'
const DEFAULT_DESCRIPTION = 'Discover products from South West, Sri Lanka. Browse our online store by category and brand.'

function setMeta(selector, attr, key, content) {
  if (content == null || content === '') return
  let el = document.head.querySelector(selector)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', String(content))
}

export function setPageMeta({ title = 'South West | Online Store', description = DEFAULT_DESCRIPTION, path = '/', index = true, image = '/SWShareImage.png', type = 'website' } = {}) {
  const safePath = String(path || '/').split('?')[0]
  const url = new URL(safePath.startsWith('/') ? safePath : `/${safePath}`, SITE_URL).href
  document.title = title
  setMeta('meta[name="description"]', 'name', 'description', description)
  setMeta('meta[name="robots"]', 'name', 'robots', index ? 'index, follow' : 'noindex, nofollow')
  setMeta('meta[property="og:type"]', 'property', 'og:type', type)
  setMeta('meta[property="og:site_name"]', 'property', 'og:site_name', 'South West')
  setMeta('meta[property="og:title"]', 'property', 'og:title', title)
  setMeta('meta[property="og:description"]', 'property', 'og:description', description)
  setMeta('meta[property="og:url"]', 'property', 'og:url', url)
  setMeta('meta[property="og:image"]', 'property', 'og:image', new URL(image, SITE_URL).href)
  setMeta('meta[name="twitter:card"]', 'name', 'twitter:card', 'summary_large_image')
  setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', title)
  setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', description)
  setMeta('meta[name="twitter:image"]', 'name', 'twitter:image', new URL(image, SITE_URL).href)
  let canonical = document.head.querySelector('link[rel="canonical"]')
  if (!canonical) {
    canonical = document.createElement('link')
    canonical.rel = 'canonical'
    document.head.appendChild(canonical)
  }
  canonical.href = url
}

export function usePageMeta(options) {
  setPageMeta(options)
}
