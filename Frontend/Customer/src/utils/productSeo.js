import { decodeHTML } from 'entities/decode'

export const SITE_ORIGIN = 'https://southwest.lk'

const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const publicIdPattern = new RegExp(`^${uuid}$`, 'i')
const productSuffix = new RegExp(`-(${uuid})$`, 'i')

export function productPublicId(segment) {
  return String(segment || '').match(productSuffix)?.[1] || ''
}

export function productPathFor(product) {
  const slug = String(product?.slug || '').trim()
  const id = String(product?.public_id || '').trim()
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(slug) || !publicIdPattern.test(id)) return ''
  return `/product/${slug}-${id}`
}

export function isProductRouteIndexable(query) {
  return !query || Object.keys(query).length === 0
}

export function isDefinitiveProductAbsence({
  hasPublicId = true,
  productFound = true,
  responseStatus,
} = {}) {
  return !hasPublicId || !productFound || responseStatus === 404
}

export function shouldPreserveStaticProductMeta({
  routeName,
  routePath,
  hasQuery,
  canonicalHref,
  ogType,
  robotsContent,
}) {
  if (
    routeName !== 'product-details' ||
    hasQuery ||
    ogType !== 'product' ||
    !/^index\s*,\s*follow$/i.test(String(robotsContent || '').trim())
  ) {
    return false
  }

  try {
    const canonicalUrl = new URL(canonicalHref)
    return canonicalUrl.origin === SITE_ORIGIN && canonicalUrl.pathname === routePath
  } catch {
    return false
  }
}

// Keep labels with their values so units, qualifiers and connector direction survive.
const featureLabels = new Set([
  'processor', 'ram', 'storage', 'read speed', 'sequential read speed', 'module type',
  'interface', 'input interface', 'output interface', 'connectivity', 'display size',
  'screen size', 'battery capacity', 'speed adjustment', 'maximum power', 'cable type',
  'available lengths', 'usb ports', 'ac outlets', 'output power', 'material',
  'form factor', 'switch type', 'layout', 'speaker output', 'cable length',
  'capacity', 'charging technology', 'color temperature', 'color temperature (cct)',
  'led beads', 'charging power', 'supported drive', 'maximum height', 'rated voltage',
  'sound pickup', 'mount type', 'mounting', 'dimensions', 'lighting modes',
  'power supply', 'frequency response', 'maximum data transfer speed', 'usb standard',
  'supported ssd sizes', 'number of keys', 'connector', 'connection type',
  'charging interface', 'plug type', 'lighting', 'device compatibility', 'compatibility',
  'microphone type', 'transmission range', 'pickup pattern', 'applications', 'battery',
  'height adjustment', 'total usb power', 'power cord length', 'output type', 'power output',
  'maximum suction power', 'suction modes', 'color temperature range', 'brightness control',
  'remote control', 'mobile phone wireless charging output', 'wireless earbuds charging output',
  'smartwatch wireless charging output', 'total maximum output power',
])
const uncertainOrCommercial = /\b(?:unverified|typically|around|verify|depending|varies|approx(?:imately)?|as listed|as specified|not specified|best|cheapest|premium|unbeatable|#1|on sale|guaranteed?|number one|available at|in stock|out of stock|available now|delivery|shipping|warranty|price|discount|LKR|Rs|(?<!-)free|sale)\b/i

const unsupportedOutcome = /\b(?:cures?|heals?|treats?|eliminates? pain|relieves? pain|pain relief|improves? blood circulation|accelerates? recovery|prevents? injury|clinically proven|medical[- ]grade)\b/i

function descriptionLines(html) {
  return decodeHTML(String(html || '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<br\b[^>]*>|<\/(?:li|p|div|tr|h[1-6])\s*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '))
    .split(/\n+/)
    .map(line => line.replace(/^[\s•●▪-]+/, '').replace(/\s+/g, ' ').replace(/\s+([,:.])/g, '$1').trim())
    .filter(Boolean)
}

function productSnippet(name, product) {
  const lines = descriptionLines(product.description)
  const facts = []
  const prose = []
  const secondary = []
  for (const line of lines) {
    if (unsupportedOutcome.test(line) || uncertainOrCommercial.test(line) || /[<>~]|#1\b|&(?:#\w+|\w+);/.test(line)) continue
    const match = /^([^:]+?)(?::\s*|\s+-\s+)(.+)$/.exec(line)
    if (match && featureLabels.has(match[1].toLowerCase())) {
      if (!name.toLowerCase().includes(match[2].toLowerCase())) facts.push(line)
    } else if (match && /^(?:product type|design|weight|dimensions|input|color|colour|application)$/i.test(match[1])) {
      if (!name.toLowerCase().includes(match[2].toLowerCase())) secondary.push(line)
    } else if (!match && /^(?:supports? |compatible with |designed for |bluetooth \d|\d+(?:\.\d+)?\s*(?:mm|metre|inch|built-in))/i.test(line)
      && !line.toLowerCase().includes(name.toLowerCase())) {
      prose.push(line)
    }
  }

  const lead = /[.!?]$/.test(name) ? name : name + '.'
  let description = lead
  const seenFacts = new Set()
  for (const fact of [...facts, ...prose, ...secondary]) {
    const key = fact.toLowerCase().replace(/\s+/g, ' ').replace(/[.!?]+$/, '').trim()
    if (seenFacts.has(key)) continue
    seenFacts.add(key)
    const sentence = /[.!?]$/.test(fact) ? fact : fact + '.'
    if (description.length + sentence.length + 1 <= 160) description += ' ' + sentence
  }
  if (description === lead) {
    // A catalog paragraph may already open with a complete, named product description.
    for (const line of lines) {
      const opening = line.match(/^.+?[.!?](?=\s|$)/)?.[0]
      if (opening && opening.length <= 160 && !unsupportedOutcome.test(opening) && !uncertainOrCommercial.test(opening)
        && !/[<>]|&\w+;/.test(opening)
        && opening.replace(/^the /i, '').toLowerCase().startsWith(name.toLowerCase() + ' ')) {
        return opening
      }
    }
    const fallback = `Explore ${name} at South West Sri Lanka.`
    if (fallback.length <= 160) return fallback
    return lead
  }
  return description
}

// Preserve the complete product identity; shorten only store branding.
export function productTitle(displayName) {
  const name = String(displayName || 'Product').trim() || 'Product'
  const fullTitle = name + ' | South West Sri Lanka'
  return fullTitle.length <= 60
    ? fullTitle
    : name + ' | South West'
}

export function productMetadata(product = {}) {
  const name = String(product.item_name || product.name || product.product_name || 'Product').trim() || 'Product'
  const brand = String(product.brand_name || product.brand?.name || (typeof product.brand === 'string' ? product.brand : '')).trim()
  let displayName = name.replace(/\s+/g, ' ')
  if (brand) {
    const escaped = brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    displayName = displayName.replace(new RegExp(`^(${escaped})(?:\\s+${escaped})+(?=\\s|$)`, 'i'), '$1')
    if (!new RegExp(`(?:^|[^\\p{L}\\p{N}])${escaped}(?=$|[^\\p{L}\\p{N}])`, 'iu').test(displayName)) displayName = brand + ' ' + displayName
  }
  const path = productPathFor(product)
  const images = Array.isArray(product.images) ? product.images : []
  const primary = images.find(item => item?.is_primary) || images[0]
  let image = SITE_ORIGIN + '/SWShareImage.png'
  for (const source of [product.image, product.image_url, primary?.url]) {
    if (typeof source !== 'string' || !source.trim()) continue
    try {
      const url = new URL(source, SITE_ORIGIN)
      if (['https:', 'http:'].includes(url.protocol) && !url.username && !url.password) {
        image = url.href
        break
      }
    } catch { /* Try the next catalog image. */ }
  }
  return {
    title: productTitle(displayName),
    description: productSnippet(displayName, product),
    path,
    canonicalUrl: path ? SITE_ORIGIN + path : null,
    type: 'product',
    image,
  }
}
