import { escapeHtml, updateMeta, updateCanonical } from './htmlMeta.mjs'
import { removeHomepageOrganizationSchema } from './homepageStructuredData.mjs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { loadEnv } from 'vite'
import { selectDefaultVariant } from '../src/utils/productOffer.js'
import { productSchema as sharedProductSchema } from '../src/utils/structuredData.js'

import { productMetadata, productPathFor, SITE_ORIGIN as SITE_URL } from '../src/utils/productSeo.js'
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
      const path = productPathFor(product)
      if (product?.is_active === false || !path) continue

      urls.add(path)
      products.push({ ...product, path })
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

function createStaticProductData(product, variants) {
  return JSON.stringify({ product, variants: variants || [] })
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026')
}

function createProductHtml(template, product, variant, variants) {
  const name = String(
    product.item_name || product.name || product.product_name || 'Product'
  ).trim()

  const { title, description, canonicalUrl, image: imageUrl, type } = productMetadata(product)

  const productSchema = variant
    ? sharedProductSchema(
        product,
        canonicalUrl,
        getActualProductImage(product),
        variant
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
  html = updateMeta(html, 'property', 'og:type', type)
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

      const key = schema === productSchema ? 'product' : 'breadcrumb'
      return `<script id="southwest-jsonld-${key}" type="application/ld+json">${json}</script>`
    })
    .join('\n    ')

  const staticProductData = `<script id="southwest-product-data" type="application/json">${createStaticProductData(product, variants)}</script>`

  const initialContent = `<main class="product-page" data-static-product-preview>
      <nav class="breadcrumbs" aria-label="Breadcrumb">
        <a href="/">Home</a>
        <span aria-hidden="true">/</span>
        <a href="/shop">Shop</a>
        <span aria-hidden="true">/</span>
        <span aria-current="page">${escapeHtml(name)}</span>
      </nav>
      <section class="state-message">
        <h1>${escapeHtml(name)}</h1>
        <p>Product details require JavaScript to load.</p>
      </section>
    </main>`

  const appContainer = '<div id="app"></div>'

  if (html.split(appContainer).length !== 2) {
    throw new Error('Expected exactly one empty application container.')
  }

  return html
    .replace(appContainer, () => `<div id="app">${initialContent}</div>`)
    .replace('</head>', () => `    ${jsonLd}\n    ${staticProductData}\n</head>`)
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
      const variant = selectDefaultVariant(variants)

      const outputDirectory = resolve('dist', 'product')
      const outputFile = resolve('dist', '.' + product.path + '.html')

      await mkdir(outputDirectory, { recursive: true })
      await writeFile(
        outputFile,
        createProductHtml(template, product, variant, variants),
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
  template = removeHomepageOrganizationSchema(
    await readFile(distIndex, 'utf8')
  )
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
