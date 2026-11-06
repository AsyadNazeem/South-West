const SITE_URL = 'https://southwest.lk'

export function setStructuredData(key, value) {
  const id = `southwest-jsonld-${key}`
  let script = document.getElementById(id)
  if (!value) {
    script?.remove()
    return
  }
  if (!script) {
    script = document.createElement('script')
    script.id = id
    script.type = 'application/ld+json'
    document.head.appendChild(script)
  }
  script.textContent = JSON.stringify(value)
}

export function organizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'South West',
    url: SITE_URL,
    logo: `${SITE_URL}/SWLogo.webp`,
  }
}

export function websiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'South West',
    url: SITE_URL,
  }
}

export function productSchema(product, path, image) {
  const name = String(product?.item_name || product?.name || product?.product_name || '').trim()
  const rawPrice = product?.price ?? product?.selling_price
  const price = Number(rawPrice)
  const productPath = String(path || '')
  let canonicalUrl
  let imageUrl
  try {
    canonicalUrl = new URL(productPath, SITE_URL)
    imageUrl = new URL(String(image || ''), SITE_URL)
  } catch {
    return null
  }
  if (!product || !name || rawPrice == null || rawPrice === '' || !Number.isFinite(price) || price <= 0) return null
  if (canonicalUrl.origin !== SITE_URL || canonicalUrl.search || canonicalUrl.hash || !/^\/product\/[a-z0-9]+(?:-[a-z0-9]+)*-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(canonicalUrl.pathname)) return null
  if (imageUrl.protocol !== 'https:' || imageUrl.username || imageUrl.password || imageUrl.pathname === '/') return null

  const rawStock = product.stock_quantity ?? product.available_quantity ?? product.available_stock ?? product.quantity_in_stock
  const knownStock = rawStock !== null && rawStock !== undefined && rawStock !== '' && Number.isFinite(Number(rawStock)) && Number(rawStock) >= 0
  const stock = product.in_stock === false || (knownStock && Number(rawStock) === 0)
    ? 'https://schema.org/OutOfStock'
    : product.in_stock === true || knownStock
      ? 'https://schema.org/InStock'
      : null
  const offer = {
    '@type': 'Offer',
    priceCurrency: 'LKR',
    price: price.toFixed(2),
    url: canonicalUrl.href,
  }
  if (stock) offer.availability = stock
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    description: String(product.description || '').replace(/<[^>]*>/g, ' ').trim().slice(0, 5000) || undefined,
    image: imageUrl.href,
    sku: product.item_code || product.sku || undefined,
    brand: product.brand_name || product.brand?.name ? { '@type': 'Brand', name: product.brand_name || product.brand?.name } : undefined,
    offers: offer,
  }
}

export function breadcrumbSchema(entries) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: entries.map((entry, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: entry.name,
      item: `${SITE_URL}${entry.path}`,
    })),
  }
}

export function itemListSchema(items) {
  const validItems = items.filter((item) => {
    try {
      const url = new URL(String(item?.path || ''), SITE_URL)
      return url.origin === SITE_URL && /^\/product\/[a-z0-9]+(?:-[a-z0-9]+)*-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(url.pathname) && Boolean(String(item?.name || '').trim())
    } catch {
      return false
    }
  })
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: validItems.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: `${SITE_URL}${item.path}`,
      name: item.name,
    })),
  }
}
