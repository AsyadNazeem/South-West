const API_ORIGIN = (() => {
  try {
    return new URL(import.meta.env.VITE_API_URL).origin
  } catch {
    return ''
  }
})()

/**
 * Resolve backend-uploaded media for local and production environments.
 * Absolute URLs and browser-generated URLs are preserved.
 */
export function getMediaUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return ''

  const raw = value.trim()

  if (/^(https?:|blob:|data:)/i.test(raw)) return raw
  if (raw.startsWith('//')) return `${window.location.protocol}${raw}`
  if (!API_ORIGIN) return ''

  const normalized = raw.replace(/\\/g, '/').replace(/^\/+/, '')
  const uploadPath = normalized.startsWith('uploads/')
    ? normalized
    : `uploads/${normalized}`

  return new URL(`/${uploadPath}`, `${API_ORIGIN}/`).href
}
