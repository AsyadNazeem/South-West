import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const apiBase = process.env.VITE_API_URL?.replace(/\/+$/, '')
if (!apiBase) throw new Error('Set VITE_API_URL to the public API base URL before generating the sitemap.')

const urls = new Set([
  '/', '/shop', '/categories', '/brands', '/offers', '/about', '/contact',
  '/faq', '/shipping', '/returns', '/privacy-policy', '/terms',
])
const seenCursors = new Set()
let seed = ''
let cursor = ''

for (let page = 0; page < 1000; page += 1) {
  const params = new URLSearchParams({ paginate: '1', limit: '100' })
  if (seed) params.set('seed', seed)
  if (cursor) params.set('cursor', cursor)
  const response = await fetch(`${apiBase}/store/products?${params}`, { signal: AbortSignal.timeout(20000) })
  if (!response.ok) throw new Error(`Product API returned HTTP ${response.status}`)
  const payload = await response.json()
  if (!payload || payload.success === false || !Array.isArray(payload.data) || !payload.pagination) {
    throw new Error('Product API returned an unexpected paginated response.')
  }
  for (const product of payload.data) {
    const slug = String(product?.slug || '').trim()
    const publicId = String(product?.public_id || '').trim()
    if (product?.is_active === false || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(slug)) continue
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(publicId)) continue
    urls.add(`/product/${slug}-${publicId}`)
  }
  const pagination = payload.pagination
  if (pagination.hasMore === false) break
  if (pagination.hasMore !== true || typeof pagination.nextCursor !== 'string' || !pagination.nextCursor.trim()) {
    throw new Error('Product API returned invalid pagination cursor metadata.')
  }
  if (typeof pagination.seed !== 'string' || !pagination.seed.trim() || (seed && pagination.seed !== seed)) {
    throw new Error('Product API returned invalid pagination seed metadata.')
  }
  seed = pagination.seed
  cursor = pagination.nextCursor
  if (seenCursors.has(cursor)) throw new Error('Product API repeated a sitemap pagination cursor.')
  seenCursors.add(cursor)
  if (page === 999) throw new Error('Sitemap generation stopped after 1000 pages.')
}

const xmlEscape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;')
const body = [...urls].map(path => `  <url><loc>${xmlEscape(`https://southwest.lk${path}`)}</loc></url>`).join('\n')
const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`
await writeFile(resolve('public/sitemap.xml'), xml)
console.log(`Wrote ${urls.size} public URLs to public/sitemap.xml`)
