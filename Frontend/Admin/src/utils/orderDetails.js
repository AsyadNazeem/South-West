const money = value => {
  const amount = Number(value)
  return Number.isFinite(amount) ? amount : 0
}

const text = value => String(value ?? '').trim()

const uniqueParts = values => {
  const seen = new Set()

  return values.map(text).filter(value => {
    if (!value) return false

    const key = value.toLocaleLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function getShippingDetails(address, fallbackName = '') {
  const deliveryAddress = uniqueParts([
    address?.address_line_1,
    address?.address_line_2
  ]).join(', ')

  return {
    customerName: text(address?.recipient_name) || text(fallbackName),
    deliveryAddress,
    city: text(address?.city),
    district: text(address?.district?.district_name),
    area: text(address?.area?.area_name),
    postalCode: text(address?.postal_code),
    phone: text(address?.phone)
  }
}

export function buildFullShippingAddress(details) {
  return [
    text(details?.customerName),
    text(details?.deliveryAddress),
    ...uniqueParts([
      details?.city,
      details?.district,
      details?.area
    ]),
    text(details?.postalCode) ? `Postal Code: ${text(details.postalCode)}` : '',
    text(details?.phone) ? `Phone: ${text(details.phone)}` : ''
  ].filter(Boolean).join('\n')
}

export function getOrderAmounts(order = {}) {
  const toCents = value => Math.round(money(value) * 100)
  const fromCents = value => value / 100
  const subtotalCents = toCents(order.subtotal)
  const discountCents = Math.max(0, toCents(order.discount_amount))

  return {
    subtotal: fromCents(subtotalCents),
    discount: fromCents(discountCents),
    tax: fromCents(toCents(order.tax_amount)),
    shipping: fromCents(toCents(order.shipping_amount)),
    actualProductValue: fromCents(Math.max(0, subtotalCents - discountCents)),
    total: fromCents(toCents(order.total_amount)),
    hasDiscount: discountCents > 0
  }
}

export function getOrderSummaryRows(order = {}) {
  const amounts = getOrderAmounts(order)

  return [
    { key: 'subtotal', label: 'Subtotal', value: amounts.subtotal },
    ...(amounts.hasDiscount
      ? [{ key: 'discount', label: 'Discount', value: amounts.discount, negative: true }]
      : []),
    { key: 'tax', label: 'Tax', value: amounts.tax },
    { key: 'shipping', label: 'Shipping', value: amounts.shipping },
    ...(amounts.hasDiscount
      ? [{
          key: 'actualProductValue',
          label: 'Actual Product Value',
          value: amounts.actualProductValue
        }]
      : []),
    { key: 'total', label: 'Total', value: amounts.total, total: true }
  ]
}
