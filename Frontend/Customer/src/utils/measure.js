// Formats variant attribute values with proper measurement symbols.
//
//   formatMeasure('Wattage', '65')        -> "65 W"
//   formatMeasure('Length', '2')          -> "2 m"
//   formatMeasure('Length', '2 meters')   -> "2 m"
//   formatMeasure('Voltage', '230v')      -> "230 V"
//   formatMeasure('Connector', 'Type-C')  -> "Type-C"   (text is left as-is)
//
// Add or change entries in the two tables below to suit your catalogue.

// Used when the value is a bare number: the attribute NAME decides the unit.
const UNIT_RULES = [
  { test: /length|cable/i, unit: 'm' },
  { test: /watt|power/i, unit: 'W' },
  { test: /volt/i, unit: 'V' },
  { test: /amp|current/i, unit: 'A' },
  { test: /weight/i, unit: 'kg' },
  { test: /frequency/i, unit: 'Hz' },
  { test: /battery/i, unit: 'mAh' },
  { test: /\bram\b|memory|storage|capacity/i, unit: 'GB' }
]

// Used when the value already has a unit: spelled-out words become symbols.
const UNIT_ALIASES = [
  [/^(?:watts?|w)$/i, 'W'],
  [/^(?:kilowatts?|kw)$/i, 'kW'],
  [/^(?:volts?|v)$/i, 'V'],
  [/^(?:amps?|amperes?|a)$/i, 'A'],
  [/^(?:millimet(?:er|re)s?|mm)$/i, 'mm'],
  [/^(?:centimet(?:er|re)s?|cm)$/i, 'cm'],
  [/^(?:met(?:er|re)s?|mtrs?|m)$/i, 'm'],
  [/^(?:kilograms?|kgs?)$/i, 'kg'],
  [/^(?:grams?|g)$/i, 'g'],
  [/^(?:hertz|hz)$/i, 'Hz'],
  [/^(?:kilohertz|khz)$/i, 'kHz'],
  [/^(?:megahertz|mhz)$/i, 'MHz'],
  [/^(?:gigahertz|ghz)$/i, 'GHz'],
  [/^mah$/i, 'mAh'],
  [/^mb$/i, 'MB'],
  [/^gb$/i, 'GB'],
  [/^tb$/i, 'TB']
]

const NBSP = '\u00A0'

export function formatMeasure(attributeName, rawValue) {
  const value = String(rawValue ?? '').trim()

  if (!value) return ''

  // "65", "65W", "2 meters", "1.5m" are measurements; anything else is text.
  const match = value.match(/^(-?\d+(?:[.,]\d+)?)\s*([a-zA-Z]+)?$/)

  if (!match) return value

  const [, number, suffix] = match

  if (suffix) {
    const alias = UNIT_ALIASES.find(([pattern]) => pattern.test(suffix))

    return `${number}${NBSP}${alias ? alias[1] : suffix}`
  }

  const rule = UNIT_RULES.find(entry => entry.test.test(String(attributeName)))

  return rule ? `${number}${NBSP}${rule.unit}` : number
}

export function formatAttributeLabel(attributeName) {
  const text = String(attributeName ?? '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return text ? text.charAt(0).toUpperCase() + text.slice(1) : ''
}