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

function getOriginalImageValue(value) {
  if (typeof value === 'string') return value
  if (!value || typeof value !== 'object') return ''

  return [
    value.url,
    value.image_url,
    value.file_path,
    value.src,
    value.thumbnail,
    value.image,
  ].find(candidate => typeof candidate === 'string' && candidate.trim()) || ''
}

/** Resolve a legacy image URL or an image record through the existing media URL rules. */
export function getResponsiveImageUrl(value) {
  return getMediaUrl(getOriginalImageValue(value))
}

/** Build a srcset from backend-confirmed responsive candidates only. */
export function getResponsiveImageSrcSet(candidates) {
  if (!Array.isArray(candidates)) return ''

  const byWidth = new Map()
  for (const candidate of candidates) {
    const width = candidate?.width
    if (!Number.isSafeInteger(width) || width <= 0) continue

    const url = getMediaUrl(candidate?.url)
    if (!url || byWidth.has(width)) continue

    byWidth.set(width, url)
  }

  return [...byWidth.entries()]
    .sort(([left], [right]) => left - right)
    .map(([width, url]) => `${url} ${width}w`)
    .join(', ')
}
