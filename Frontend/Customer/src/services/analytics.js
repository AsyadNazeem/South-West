const MEASUREMENT_ID = import.meta.env?.VITE_GA_MEASUREMENT_ID
const CONSENT_KEY = 'southwestAnalyticsConsent'
const CAMPAIGN_KEY = 'southwestCampaign'
const CAMPAIGN_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content']
const PUBLIC_PATHS = new Set(['/', '/shop', '/offers', '/categories', '/brands', '/about', '/contact', '/faq', '/shipping', '/returns', '/privacy-policy', '/terms'])
let initialized = false

function getStorage(storageName) {
  try {
    return globalThis[storageName] || null
  } catch {
    return null
  }
}

export function hasAnalyticsConsent() {
  try { return getStorage('localStorage')?.getItem(CONSENT_KEY) === 'accepted' } catch { return false }
}

export function getAnalyticsChoice() {
  try { return getStorage('localStorage')?.getItem(CONSENT_KEY) || '' } catch { return 'rejected' }
}

function updateGoogleConsent(value) {
  if (initialized && typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag('consent', 'update', { analytics_storage: value })
  }
}

export function setAnalyticsConsent(accepted) {
  const storage = getStorage('localStorage')
  if (!accepted) {
    try { storage?.setItem(CONSENT_KEY, 'rejected') } catch { /* storage may be unavailable */ }
    updateGoogleConsent('denied')
    return
  }

  try {
    storage?.setItem(CONSENT_KEY, 'accepted')
    if (storage?.getItem(CONSENT_KEY) === 'accepted') {
      initializeAnalytics()
      return
    }
  } catch { /* storage may be unavailable */ }
  updateGoogleConsent('denied')
}

function initializeAnalytics() {
  if (!MEASUREMENT_ID || !hasAnalyticsConsent() || typeof window === 'undefined' || typeof document === 'undefined') return

  if (!window.dataLayer) window.dataLayer = []
  if (typeof window.gtag !== 'function') {
    window.gtag = function gtag() { window.dataLayer.push(arguments) }
  }

  if (initialized) {
    updateGoogleConsent('granted')
    return
  }

  initialized = true
  window.gtag('js', new Date())
  window.gtag('consent', 'default', { analytics_storage: 'denied' })
  window.gtag('consent', 'update', { analytics_storage: 'granted' })
  window.gtag('config', MEASUREMENT_ID, { send_page_view: false })

  const scriptUrl = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(MEASUREMENT_ID)}`
  const existingScript = document.querySelector?.(`script[src="${scriptUrl}"]`)
  if (!existingScript) {
    const script = document.createElement('script')
    script.async = true
    script.src = scriptUrl
    document.head.appendChild(script)
  }
}

export function trackEvent(name, params = {}) {
  try {
    initializeAnalytics()
    if (!initialized || !hasAnalyticsConsent() || typeof window === 'undefined' || typeof window.gtag !== 'function') return false
    window.gtag('event', name, params)
    return true
  } catch {
    return false
  }
}

function analyticsStorageKey(prefix, name, identity) {
  let hash = 2166136261
  let secondHash = 0x9e3779b9
  for (const character of String(identity)) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
    secondHash = Math.imul(secondHash ^ character.charCodeAt(0), 0x5bd1e995)
  }
  return `${prefix}:${name}:${(hash >>> 0).toString(36)}${(secondHash >>> 0).toString(36)}`
}

export function trackEventOncePerSession(name, identity, params = {}) {
  if (!name || !identity || !hasAnalyticsConsent()) return false
  const storage = getStorage('sessionStorage')
  if (!storage) return false
  const key = analyticsStorageKey('southwestGa4Event', name, identity)

  try {
    const existing = storage.getItem(key)
    const recordedAt = Number(existing?.split(':').at(-1))
    if (existing && (!Number.isFinite(recordedAt) || Date.now() - recordedAt < 30 * 60 * 1000)) return false
    storage.setItem(key, `pending:${Date.now()}`)
  } catch {
    return false
  }

  if (!trackEvent(name, params)) {
    try { storage.removeItem(key) } catch { /* storage may be unavailable */ }
    return false
  }

  try { storage.setItem(key, String(Date.now())) } catch { /* pending marker still prevents a duplicate */ }
  return true
}

export function trackPurchaseOnce(orderIdentity, params = {}) {
  if (!orderIdentity || !hasAnalyticsConsent() || !Array.isArray(params.items) || !params.items.length) return false
  const storage = getStorage('localStorage')
  if (!storage) return false
  const key = analyticsStorageKey('southwestGa4Purchase', 'purchase', orderIdentity)
  const legacyKey = `southwestPurchaseTracked:${orderIdentity}`

  try {
    if (storage.getItem(key) || storage.getItem(legacyKey)) return false
    storage.setItem(key, 'pending')
  } catch {
    return false
  }

  // Order identifiers are used only as a local deduplication key; never send them to GA4.
  const safeParams = { ...params }
  delete safeParams.transaction_id
  delete safeParams.order_id
  delete safeParams.customer_id
  if (!trackEvent('purchase', safeParams)) {
    try { storage.removeItem(key) } catch { /* keep the reservation if it cannot be cleared */ }
    return false
  }

  try { storage.setItem(key, 'sent') } catch { /* pending marker still prevents a duplicate */ }
  return true
}

function safeCampaignValue(value) {
  const normalized = String(value || '').trim().slice(0, 200)
  if (!normalized || /@|https?:\/\/|(?:\+?\d[\s().-]*){8,}|^[a-f\d]{32,}$/i.test(normalized)) return ''
  return normalized
}

export function trackPageView(route) {
  if (!route || route.meta?.requiresCustomerAuth || route.meta?.noAnalytics) return
  if (/^\/(account|cart|checkout|login|register|set-password|verify-email)(\/|$)/.test(route.path)) return
  const pagePath = String(route.path || '')
  const isProductPath = /^\/product\/[a-z0-9]+(?:-[a-z0-9]+)*-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pagePath)
  if (!PUBLIC_PATHS.has(pagePath) && !isProductPath) return

  const params = new URLSearchParams()
  for (const key of CAMPAIGN_KEYS) {
    const raw = route.query?.[key]
    const value = safeCampaignValue(Array.isArray(raw) ? raw[0] : raw)
    if (value) params.set(key, value)
  }
  const query = params.toString()
  const pageTitle = typeof document !== 'undefined' ? document.title : ''
  trackEvent('page_view', {
    page_title: String(pageTitle).slice(0, 200),
    page_location: `https://southwest.lk${pagePath}${query ? `?${query}` : ''}`,
  })
}

export function analyticsItem(product, quantity = 1) {
  const publicId = product?.public_id
  return {
    item_id: publicId == null ? undefined : String(publicId),
    item_name: String(product?.item_name ?? product?.name ?? product?.product_name ?? 'Product').slice(0, 200),
    item_brand: product?.brand_name || product?.brand?.name || undefined,
    item_category: product?.category_name || product?.category?.name || undefined,
    price: Number(product?.price ?? product?.selling_price) || 0,
    quantity: Number(quantity) || 1,
  }
}

export function trackProductView(product, priceOverride) {
  const item = analyticsItem(product)
  if (Number.isFinite(Number(priceOverride)) && Number(priceOverride) > 0) item.price = Number(priceOverride)
  trackEvent('view_item', { currency: 'LKR', value: item.price, items: [item] })
}

export function trackAddToCart(product, quantity = 1, priceOverride) {
  const item = analyticsItem(product, quantity)
  if (Number.isFinite(Number(priceOverride)) && Number(priceOverride) > 0) item.price = Number(priceOverride)
  trackEvent('add_to_cart', { currency: 'LKR', value: item.price * item.quantity, items: [item] })
}

export function rememberCampaignParams(search) {
  const storage = getStorage('sessionStorage')
  if (!storage) return
  try {
    const params = new URLSearchParams(search || '')
    const campaign = {}
    for (const key of CAMPAIGN_KEYS) {
      const value = safeCampaignValue(params.get(key))
      if (value) campaign[key] = value
    }
    if (Object.keys(campaign).length) storage.setItem(CAMPAIGN_KEY, JSON.stringify(campaign))
  } catch { /* storage may be unavailable */ }
}
