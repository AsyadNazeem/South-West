const SITE_ORIGIN = 'https://southwest.lk'

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
