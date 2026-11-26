import assert from 'node:assert/strict'
import test from 'node:test'
import { buildVariantChoices, choiceColors, chooseOption, normalizeAttributes } from '../src/utils/variantSelection.js'

function sku(id, attributes, extra = {}) {
  return { id, variant_name: 'Variant ' + id, variant_sku: 'SKU-' + id, available_quantity: 2, attributes, ...extra }
}

for (const [key, first, second] of [
  ['Compatibility', 'LAPTOP', 'DESKTOP'], ['Model', 'A', 'B'], ['Capacity', '4GB', '8GB'],
  ['Cable Length', '1m', '2m'], ['Pack Quantity', '1 PSC', '2 PSC'], ['Future field', false, true],
  ['Pitch', 0, 2]
]) {
  test('selects both SKUs by ' + key, () => {
    const { labels, choices } = buildVariantChoices([sku(1, { [key]: first }), sku(2, { [key]: second })])
    assert.deepEqual(labels, [key])
    assert.deepEqual(new Set(choices.map(c => c.name)), new Set([String(first), String(second)]))
    assert.deepEqual(new Set(choices.map(c => chooseOption(c).id)), new Set(['1', '2']))
  })
}

test('configured connector precedes correlated model and interface, and constants are omitted', () => {
  const variants = ['3.5MM', 'USB'].map((value, i) =>
    sku(182 + i, JSON.stringify({ Model: 'H01 ' + value, Condition: 'New', 'Connector Type': value, Interface: value })))
  assert.deepEqual(buildVariantChoices(variants, ['Condition', 'Connector Type']).labels, ['Connector Type'])
  assert.deepEqual(normalizeAttributes('broken'), {})
  assert.equal(buildVariantChoices([variants[0], { ...variants[1], is_active: false }]).choices.length, 1)
})

test('builds only observed multi-attribute configurations and distinguishes missing from literal values', () => {
  const attrs = [{ Type: 'A', Size: 1 }, { Type: 'A', Size: 2 }, { Type: 'B' }, { Type: 'B', Size: 'Not specified' }]
  const { choices, labels } = buildVariantChoices(attrs.map((a, i) => sku(i, a)))
  assert.deepEqual(labels, ['Type', 'Size'])
  assert.equal(new Set(choices.map(c => c.name)).size, 4)
  assert.equal(choices.length, 4)
})

test('duplicate combinations, names and colours remain distinct, unavailable IDs cannot be chosen', () => {
  const { choices } = buildVariantChoices([1, 2, 3].map(i =>
    sku(i, { Model: 'S' }, { variant_name: 'Same', available_quantity: i - 1, colors: ['Black'] })))
  assert.equal(new Set(choices.map(c => c.name)).size, 3)
  assert.equal(chooseOption(choices.find(c => c.key === '1')), null)
  assert.equal(chooseOption(choices.find(c => c.key === '2')).id, '2')
})

test('swatches resolve actual SKUs including combined, absent and unavailable colours', () => {
  const { choices } = buildVariantChoices([
    sku(1, { Color: 'Red, White' }), sku(2, {}), sku(3, {}, { colors: ['Black'], in_stock: false })
  ])
  assert.equal(choices.length, 1)
  assert.deepEqual(choiceColors(choices[0]).map(c => [c.name, c.id, c.available]),
    [['Red + White', '1', true], ['', '2', true], ['Black', '3', false]])
  assert.equal(chooseOption(choices[0], 'Red + White').id, '1')
})

test('keeps colour-only variants as swatches and omits nonexistent colour combinations', () => {
  const variants = [sku(1, { Model: 'A', Size: 'S' }, { colors: ['Red'] }),
    sku(2, { Model: 'B', Size: 'S' }, { colors: ['Blue'] }), sku(3, { Model: 'C', Size: 'L' }, { colors: ['Green'] })]
  assert.equal(buildVariantChoices(variants).choices.length, 1)
  const { choices } = buildVariantChoices(variants, ['Size'])
  assert.deepEqual(choiceColors(choices.find(c => c.name === 'L')).map(c => c.name), ['Green'])
})
