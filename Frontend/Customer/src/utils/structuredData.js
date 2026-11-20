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

export function productSchema(product, path, image, selectedVariant = null) {
  const name = String(
    product?.item_name || product?.name || product?.product_name || ''
  ).trim()

  const priceSource = selectedVariant || product
  const priceKeys = selectedVariant
    ? ['selling_price', 'price', 'unit_price', 'sale_price']
    : ['price', 'selling_price']

  let rawPrice = null

  for (const key of priceKeys) {
    const value = priceSource?.[key]

    if (value === null || value === undefined || value === '') continue

    const numericValue = Number(value)

    if (Number.isFinite(numericValue)) {
      rawPrice = numericValue
      break
    }
  }

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

  if (
    !product ||
    !name ||
    rawPrice == null ||
    !Number.isFinite(price) ||
    price <= 0
  ) return null

  if (
    canonicalUrl.origin !== SITE_URL ||
    canonicalUrl.search ||
    canonicalUrl.hash ||
    !/^\/product\/[a-z0-9]+(?:-[a-z0-9]+)*-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(canonicalUrl.pathname)
  ) return null

  if (
    imageUrl.protocol !== 'https:' ||
    imageUrl.username ||
    imageUrl.password ||
    imageUrl.pathname === '/'
  ) return null

  const stockSource = selectedVariant || product

  const stockKeys = [
    'available_quantity',
    'stock_quantity',
    'available_stock',
    'quantity_in_stock'
  ]

  let stockQuantity = NaN

  for (const key of stockKeys) {
    const value = stockSource?.[key]

    if (value === null || value === undefined || value === '') continue

    const numericValue = Number(value)

    if (Number.isFinite(numericValue)) {
      stockQuantity = numericValue
      break
    }
  }

  const inStock =
    stockSource?.is_active !== false &&
    stockSource?.in_stock !== false &&
    Number.isFinite(stockQuantity) &&
    stockQuantity > 0

  const brandName = String(
    product.brand_name ||
    (typeof product.brand === 'string'
      ? product.brand
      : product.brand?.name) ||
    ''
  ).trim()

  const offer = {
    '@type': 'Offer',
    priceCurrency: 'LKR',
    price: price.toFixed(2),
    url: canonicalUrl.href,
    ...(
      Number.isFinite(stockQuantity) ||
      stockSource?.is_active === false ||
      stockSource?.in_stock === false
        ? {
            availability: inStock
              ? 'https://schema.org/InStock'
              : 'https://schema.org/OutOfStock'
          }
        : {}
    )
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    description: String(product.description || '')
      .replace(/<[^>]*>/g, ' ')
      .trim()
      .slice(0, 5000) || undefined,
    image: imageUrl.href,
    sku: product.item_code || product.sku || undefined,
    brand: brandName
      ? {
          '@type': 'Brand',
          name: brandName
        }
      : undefined,
    offers: offer
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
