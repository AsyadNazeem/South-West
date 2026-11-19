const STATIC_PRODUCT_DATA_ID = 'southwest-product-data'

export function readStaticProductData(expectedPublicId, documentRef = document) {
  const element = documentRef?.getElementById?.(STATIC_PRODUCT_DATA_ID)
  if (!element?.textContent) return null

  try {
    const snapshot = JSON.parse(element.textContent)
    const product = snapshot?.product
    const publicId = String(product?.public_id || '').toLowerCase()

    if (!publicId || publicId !== String(expectedPublicId || '').toLowerCase()) {
      return null
    }

    return {
      ...product,
      variants: Array.isArray(snapshot.variants)
        ? snapshot.variants.filter(variant => variant?.is_active !== false)
        : [],
    }
  } catch {
    return null
  }
}
