export function selectDefaultVariant(variants) {
  const list = Array.isArray(variants)
    ? variants.filter(variant => variant.is_active !== false)
    : []

  return (
    list.find(
      variant =>
        variant.is_default === true ||
        variant.is_default === 1
    ) ||
    list.find(
      variant =>
        variant.in_stock !== false &&
        Number(variant.available_quantity) > 0
    ) ||
    list[0] ||
    null
  )
}
