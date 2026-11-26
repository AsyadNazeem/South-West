const normalized = value => String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
export const isColorKey = key => /(?:^| )colou?rs?(?: name)?$/.test(normalized(key).replace(/[_-]/g, ' '))

export function normalizeAttributes(value) {
  if (typeof value === 'string') {
    try { value = JSON.parse(value) } catch { return {} }
  }
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

export function variantColors(variant) {
  const rawColors = Array.isArray(variant?.colors)
    ? variant.colors
    : []

  const entries = rawColors
    .map(color => ({
      name: String(
        typeof color === 'string'
          ? color
          : color?.color_name || color?.name || ''
      ).trim(),
      hex: color?.hex_code || color?.hex || ''
    }))
    .filter(entry =>
      entry.name &&
      entry.name.toLowerCase() !== 'default'
    )

  const colorAttribute = Object.entries(normalizeAttributes(variant?.attributes))
    .find(([key]) => isColorKey(key))

  // A comma-separated Color attribute represents one combined colour.
  if (
    colorAttribute &&
    typeof colorAttribute[1] === 'string' &&
    colorAttribute[1].includes(',')
  ) {
    const names = colorAttribute[1]
      .split(',')
      .map(name => name.trim())
      .filter(Boolean)

    if (names.length > 1) {
      return [{
        name: names.join(' + '),
        hex: ''
      }]
    }
  }

  if (entries.length) return entries

  const name = typeof variant?.color === 'string'
    ? variant.color
    : variant?.color?.color_name ||
      variant?.color?.name ||
      colorAttribute?.[1] ||
      ''

  return String(name)
    .split(',')
    .map(value => value.trim())
    .filter(value =>
      value && value.toLowerCase() !== 'default'
    )
    .map(value => ({
      name: value,
      hex: variant?.color?.hex_code || variant?.color?.hex || ''
    }))
}

// Partition actual SKUs. Never synthesize a cartesian product of attribute values.
export function buildVariantChoices(variants, preferredAttributes = []) {
  const labels = new Map()
  const options = variants.filter(v => v.is_active !== false && v.is_active !== 0).map(v => {
    const values = new Map()
    for (const [label, raw] of Object.entries(normalizeAttributes(v.attributes))) {
      const key = normalized(label)
      if (!key || isColorKey(key) || !['string', 'number', 'boolean'].includes(typeof raw)) continue
      const value = String(raw).trim()
      if (!value) continue
      values.set(key, value)
      if (!labels.has(key)) labels.set(key, label.trim())
    }
    const colors = variantColors(v)
    return {
      id: String(v.id), values, name: v.variant_name, sku: v.variant_sku,
      inStock: v.in_stock !== false && Number(v.available_quantity) > 0,
      colors: colors.length ? colors : [{ name: '', hex: '' }]
    }
  })
  let partitions = options.length ? [options] : []
  const dimensions = []
  const preferred = new Set(preferredAttributes.map(normalized))
  for (const key of new Set([...preferred, ...labels.keys()])) {
    const next = []
    for (const group of partitions) {
      const buckets = new Map()
      for (const option of group) {
        const value = normalized(option.values.get(key))
        if (!buckets.has(value)) buckets.set(value, [])
        buckets.get(value).push(option)
      }
      next.push(...buckets.values())
    }
    if (next.length === partitions.length) continue
    // If swatches alone identify every SKU, keep a colour-only picker unless
    // the catalog explicitly provides a configured selection dimension.
    if (!preferred.has(key) && partitions.every(group =>
      group.length === 1 || (group.every(option => option.colors[0].name) && !ambiguousColors(group))
    )) break
    dimensions.push(key)
    partitions = next
  }

  const choices = []
  for (const group of partitions) {
    const base = dimensions.map(key => group[0].values.get(key) || 'Not specified').join(' · ')
    if (ambiguousColors(group)) {
      for (const option of group) {
        const identity = option.name || option.sku || option.id
        choices.push({ key: option.id, name: [base, identity].filter(Boolean).join(' · '), options: [option] })
      }
    } else {
      choices.push({ key: group[0].id, name: base, options: group })
    }
  }
  const names = choices.map(choice => normalized(choice.name))
  for (const choice of choices) {
    const name = normalized(choice.name)
    if (names.indexOf(name) !== names.lastIndexOf(name)) {
      choice.name += ' · ' + (choice.options[0].sku || choice.key)
    }
  }
  choices.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
  return { choices, labels: dimensions.map(key => labels.get(key)) }
}

function ambiguousColors(group) {
  const seen = new Set()
  for (const option of group) {
    const keys = new Set(option.colors.map(color => normalized(color.name)))
    for (const key of keys) {
      if (seen.has(key)) return true
      seen.add(key)
    }
  }
  return false
}

export function choiceColors(choice) {
  const colors = new Map()
  for (const option of choice?.options || []) {
    for (const color of option.colors) {
      colors.set(normalized(color.name), { ...color, id: option.id, available: option.inStock })
    }
  }
  return [...colors.values()]
}

export function chooseOption(choice, colorName) {
  const available = choice?.options.filter(option => option.inStock) || []
  return available.find(option => option.colors.some(color => normalized(color.name) === normalized(colorName))) ||
    available[0] || null
}
