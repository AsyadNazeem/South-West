import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { loadEnv } from 'vite'

const SITE_URL = 'https://southwest.lk'
const env = loadEnv('production', process.cwd(), '')
const apiBase = (process.env.VITE_API_URL || env.VITE_API_URL)?.replace(/\/+$/, '')

if (!apiBase) {
  throw new Error('Set VITE_API_URL before generating SEO pages.')
}

const staticPaths = [
  '/',
  '/shop',
  '/categories',
  '/brands',
  '/offers',
  '/about',
  '/contact',
  '/faq',
  '/shipping',
  '/returns',
  '/privacy-policy',
  '/terms',
]

const urls = new Set(staticPaths)
const seenCursors = new Set()
const products = []

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/i
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function fetchProducts() {
  let seed = ''
  let cursor = ''

  for (let page = 0; page < 1000; page += 1) {
    const params = new URLSearchParams({
      paginate: '1',
      limit: '100',
    })

    if (seed) params.set('seed', seed)
    if (cursor) params.set('cursor', cursor)

    const response = await fetch(
      `${apiBase}/store/products?${params}`,
      { signal: AbortSignal.timeout(20000) }
    )

    if (!response.ok) {
      throw new Error(`Product API returned HTTP ${response.status}`)
    }

    const payload = await response.json()

    if (
      !payload ||
      payload.success === false ||
      !Array.isArray(payload.data) ||
      !payload.pagination
    ) {
      throw new Error('Product API returned an unexpected paginated response.')
    }

    for (const product of payload.data) {
      const slug = String(product?.slug || '').trim()
      const publicId = String(product?.public_id || '').trim()

      if (
        product?.is_active === false ||
        !slugPattern.test(slug) ||
        !uuidPattern.test(publicId)
      ) {
        continue
      }

      const path = `/product/${slug}-${publicId}`

      urls.add(path)
      products.push({ ...product, slug, publicId, path })
    }

    const pagination = payload.pagination

    if (pagination.hasMore === false) break

    if (
      pagination.hasMore !== true ||
      typeof pagination.nextCursor !== 'string' ||
      !pagination.nextCursor.trim()
    ) {
      throw new Error('Product API returned invalid pagination cursor metadata.')
    }

    if (
      typeof pagination.seed !== 'string' ||
      !pagination.seed.trim() ||
      (seed && pagination.seed !== seed)
    ) {
      throw new Error('Product API returned invalid pagination seed metadata.')
    }

    seed = pagination.seed
    cursor = pagination.nextCursor

    if (seenCursors.has(cursor)) {
      throw new Error('Product API repeated a sitemap pagination cursor.')
    }

    seenCursors.add(cursor)

    if (page === 999) {
      throw new Error('Product pagination stopped after 1000 pages.')
    }
  }
}

async function fetchVariants(product) {
  try {
    const response = await fetch(
      `${apiBase}/store/products/${encodeURIComponent(product.id)}/variants`,
      { signal: AbortSignal.timeout(15000) }
    )

    if (!response.ok) {
      throw new Error(`Variant API returned HTTP ${response.status}`)
    }

    const payload = await response.json()

    if (!payload || payload.success === false || !Array.isArray(payload.data)) {
      throw new Error('Variant API returned an unexpected response.')
    }

    return payload.data.filter(variant => variant?.is_active !== false)
  } catch (error) {
    console.warn(
      `Could not retrieve variants for product ${product.id}: ${error.message}`
    )
    return null
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function decodeHtmlEntities(value) {
  return String(value || '')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&reg;/gi, '®')
    .replace(/&trade;/gi, '™')
    .replace(/&times;/gi, '×')
    .replace(/&#(\d+);/g, (_, code) => {
      const point = Number(code)
      return point <= 0x10ffff ? String.fromCodePoint(point) : ''
    })
    .replace(/&#x([\da-f]+);/gi, (_, code) => {
      const point = Number.parseInt(code, 16)
      return point <= 0x10ffff ? String.fromCodePoint(point) : ''
    })
}

function getPlainDescription(value) {
  return decodeHtmlEntities(
    String(value || '')
      .replace(/<\s*br\s*\/?\s*>/gi, '\n')
      .replace(/<\/\s*(?:li|p|div|tr|h[1-6])\s*>/gi, '\n')
      .replace(/<[^>]*>/g, ' ')
  )
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim()
}

function cleanProductDescription(value) {
  return getPlainDescription(value).slice(0, 5000)
}

function createMetaDescription(product) {
  const name = String(
    product.item_name || product.name || product.product_name || 'Product'
  ).trim()

  const brand = String(
    product.brand_name ||
    (typeof product.brand === 'string' ? product.brand : product.brand?.name) ||
    ''
  ).trim()

  const displayName =
    brand && !name.toLowerCase().startsWith(brand.toLowerCase())
      ? `${brand} ${name}`
      : name

  const excludedValue =
    /\b(verify|depending on|varies by|varies depending|if included|where applicable|not specified|to be confirmed|tbc)\b|\bapprox(?:imately)?\b|~/i

  const nameLower = name.toLowerCase()

  const priorities = [
    /^(processor|cpu)\s*:/i,
    /^(sequential read speed|read speed)\s*:/i,
    /^(memory speed|available speeds)\s*:/i,
    /^(usb standard)\s*:/i,
    /^(colour temperature|color temperature|cct)\s*:/i,
    /^(led beads|led count|number of leds)\s*:/i,
    /^(battery capacity)\s*:/i,
    /^(display size|screen size|panel size)\s*:/i,
    /^(storage|storage capacity|capacity)\s*:/i,
    /^(ram)\s*:/i,
    /^(form factor)\s*:/i,
    /^(interface|connection|connectivity)\s*:/i,
    /^(brightness|dimming)\s*:/i,
  ]

  const description = getPlainDescription(product.description)

  const lines = description
    .split('\n')
    .map(line => line.replace(/^[\s•●▪\-]+/, '').trim())
    .filter(Boolean)

  const features = []

  for (const pattern of priorities) {
    const line = lines.find(item => pattern.test(item))
    if (!line || excludedValue.test(line)) continue

    const value = line.replace(/^[^:：]+[:：]\s*/, '').trim()
    const valueLower = value.toLowerCase()

    const titleNumbers = nameLower.match(/\d+(?:\.\d+)?/g) || []
    const featureNumbers = valueLower.match(/\d+(?:\.\d+)?/g) || []

    const numbersAlreadyInTitle =
      featureNumbers.length > 0 &&
      featureNumbers.every(number => titleNumbers.includes(number))

    if (
      !value ||
      value.length > 65 ||
      excludedValue.test(value) ||
      nameLower.includes(valueLower) ||
      numbersAlreadyInTitle ||
      features.some(item => item.toLowerCase() === valueLower)
    ) {
      continue
    }

    features.push(value)

    if (features.length === 2) break
  }

  const suffix = 'at South West Sri Lanka.'

  const candidates = [
    features.length === 2
      ? `Shop ${displayName} featuring ${features.join(' and ')} ${suffix}`
      : '',
    features.length === 1
      ? `Shop ${displayName} featuring ${features[0]} ${suffix}`
      : '',
  ].filter(Boolean)

  for (const candidate of candidates) {
    if (candidate.length <= 160) return candidate
  }

  if (description && !excludedValue.test(description)) {
    const cleanDescription = description.replace(/\s+/g, ' ').trim()
    const descriptiveCandidate = `${cleanDescription} ${suffix}`

    if (descriptiveCandidate.length <= 160) {
      return descriptiveCandidate
    }

    const availableLength = 157 - suffix.length
    const truncatedDescription = cleanDescription
      .slice(0, availableLength)
      .replace(/[\s,;:.-]+$/, '')

    return `${truncatedDescription}...`
  }

  const fallback = `Shop ${displayName} ${suffix}`

  if (fallback.length <= 160) return fallback

  const truncated = fallback.slice(0, 157)
  const lastSpace = truncated.lastIndexOf(' ')

  return `${truncated.slice(0, lastSpace > 100 ? lastSpace : 157).replace(/[\s,;:.-]+$/, '')}...`
}
function getProductImage(product) {
  const primaryImage = Array.isArray(product.images)
    ? product.images.find(image => image?.is_primary) || product.images[0]
    : null

  return (
    product.image ||
    product.image_url ||
    primaryImage?.url ||
    `${SITE_URL}/SWShareImage.png`
  )
}

function getActualProductImage(product) {
  const primaryImage = Array.isArray(product.images)
    ? product.images.find(image => image?.is_primary) || product.images[0]
    : null

  return (
    product.image ||
    product.image_url ||
    primaryImage?.url ||
    null
  )
}

function getProductSchema(product, variant, canonicalUrl, imageUrl) {
  const priceSource = variant || product
  const rawPrice =
    priceSource?.selling_price ??
    priceSource?.price ??
    priceSource?.unit_price ??
    priceSource?.sale_price ??
    product.price

  const price = Number(rawPrice)

  if (!Number.isFinite(price) || price <= 0) return null

  let parsedImage

  try {
    parsedImage = new URL(imageUrl)
  } catch {
    return null
  }

  if (parsedImage.protocol !== 'https:' || parsedImage.pathname === '/') {
    return null
  }

  const stockSource = variant || product
  const rawQuantity =
    stockSource.available_quantity ??
    stockSource.stock_quantity ??
    stockSource.available_stock ??
    stockSource.quantity_in_stock

  const quantity =
    rawQuantity !== null && rawQuantity !== undefined && rawQuantity !== ''
      ? Number(rawQuantity)
      : NaN

  const hasStockInformation =
    Number.isFinite(quantity) ||
    typeof stockSource.in_stock === 'boolean'

  if (!hasStockInformation) return null

  const inStock =
    stockSource.is_active !== false &&
    stockSource.in_stock !== false &&
    (Number.isFinite(quantity) ? quantity > 0 : stockSource.in_stock === true)

  const brandName = String(
    product.brand_name ||
    (typeof product.brand === 'string' ? product.brand : product.brand?.name) ||
    ''
  ).trim()

  const name = String(
    product.item_name || product.name || product.product_name || ''
  ).trim()

  if (!name) return null

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    description: cleanProductDescription(product.description),
    image: parsedImage.href,
    sku: product.item_code || product.sku || undefined,
    brand: brandName
      ? {
          '@type': 'Brand',
          name: brandName,
        }
      : undefined,
    offers: {
      '@type': 'Offer',
      priceCurrency: 'LKR',
      price: price.toFixed(2),
      url: canonicalUrl,
      availability: inStock
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
    },
  }
}

function updateMeta(html, attribute, key, content) {
  const escapedKey = escapeRegex(key)
  const pattern = new RegExp(
    `<meta\\s+[^>]*${attribute}\\s*=\\s*["']${escapedKey}["'][^>]*>`,
    'i'
  )

  const tag = `<meta ${attribute}="${escapeHtml(key)}" content="${escapeHtml(content)}"/>`

  if (pattern.test(html)) {
    return html.replace(pattern, () => tag)
  }

  return html.replace('</head>', () => `    ${tag}\n</head>`)
}

function updateCanonical(html, canonicalUrl) {
  const pattern = /<link\s+[^>]*rel=["']canonical["'][^>]*>/i
  const tag = `<link rel="canonical" href="${escapeHtml(canonicalUrl)}"/>`

  return pattern.test(html)
    ? html.replace(pattern, () => tag)
    : html.replace('</head>', () => `    ${tag}\n</head>`)
}

function createProductHtml(template, product, variant) {
  const name = String(
    product.item_name || product.name || product.product_name || 'Product'
  ).trim()

  const title = `${name} | South West Sri Lanka`
  const description = createMetaDescription(product)

  const canonicalUrl = `${SITE_URL}${product.path}`

  let imageUrl = getProductImage(product)

  try {
    imageUrl = new URL(imageUrl, SITE_URL).href
  } catch {
    imageUrl = `${SITE_URL}/SWShareImage.png`
  }

  const productSchema = variant
    ? getProductSchema(
        product,
        variant,
        canonicalUrl,
        getActualProductImage(product)
      )
    : null

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: SITE_URL,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Shop',
        item: `${SITE_URL}/shop`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name,
        item: canonicalUrl,
      },
    ],
  }

  const schemas = [
    ...(productSchema ? [productSchema] : []),
    breadcrumbSchema,
  ]

  let html = template.replace(
    /<title>[\s\S]*?<\/title>/i,
    () => `<title>${escapeHtml(title)}</title>`
  )

  html = updateMeta(html, 'name', 'description', description)
  html = updateMeta(html, 'name', 'robots', 'index, follow')
  html = updateMeta(html, 'property', 'og:type', 'product')
  html = updateMeta(html, 'property', 'og:title', title)
  html = updateMeta(html, 'property', 'og:description', description)
  html = updateMeta(html, 'property', 'og:url', canonicalUrl)
  html = updateMeta(html, 'property', 'og:image', imageUrl)
  html = updateMeta(html, 'name', 'twitter:title', title)
  html = updateMeta(html, 'name', 'twitter:description', description)
  html = updateMeta(html, 'name', 'twitter:image', imageUrl)
  html = updateCanonical(html, canonicalUrl)

  const jsonLd = schemas
    .map(schema => {
      const json = JSON.stringify(schema)
        .replaceAll('<', '\\u003c')
        .replaceAll('>', '\\u003e')
        .replaceAll('&', '\\u0026')

      return `<script type="application/ld+json">${json}</script>`
    })
    .join('\n    ')

  return html.replace('</head>', () => `    ${jsonLd}\n</head>`)
}

async function generateProductPages(template) {
  let generated = 0
  const concurrency = 6

  for (let start = 0; start < products.length; start += concurrency) {
    const batch = products.slice(start, start + concurrency)

    const results = await Promise.all(
      batch.map(async product => ({
        product,
        variants: await fetchVariants(product),
      }))
    )

    for (const { product, variants } of results) {
      const variant =
        variants?.find(item => item.is_default === true) ||
        variants?.[0] ||
        null

      const outputDirectory = resolve('dist', 'product', `${product.slug}-${product.publicId}`)
      const outputFile = resolve(outputDirectory, 'index.html')

      await mkdir(outputDirectory, { recursive: true })
      await writeFile(
        outputFile,
        createProductHtml(template, product, variant),
        'utf8'
      )

      generated += 1
    }

    console.log(
      `Generated product SEO pages: ${Math.min(start + batch.length, products.length)}/${products.length}`
    )
  }

  return generated
}

function xmlEscape(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

await fetchProducts()

products.sort((a, b) => a.path.localeCompare(b.path))

const sitemapBody = [...urls].sort((a, b) => a.localeCompare(b))
  .map(path => `  <url><loc>${xmlEscape(`${SITE_URL}${path}`)}</loc></url>`)
  .join('\n')

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapBody}\n</urlset>\n`

await mkdir(resolve('public'), { recursive: true })
await writeFile(resolve('public/sitemap.xml'), sitemap, 'utf8')

const distIndex = resolve('dist/index.html')
let generatedPages = 0
let template = null

try {
  template = await readFile(distIndex, 'utf8')
} catch (error) {
  if (error.code !== 'ENOENT') throw error

  console.log('No dist/index.html found. Sitemap generated; product HTML generation skipped.')
}

if (template) {
  generatedPages = await generateProductPages(template)
  await writeFile(resolve('dist/sitemap.xml'), sitemap, 'utf8')
}

console.log(`Sitemap contains ${urls.size} URLs.`)
console.log(`Generated ${generatedPages} static product HTML pages.`)
