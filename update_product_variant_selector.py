from pathlib import Path
import shutil
from datetime import datetime

target = Path("Frontend/Customer/src/pages/ProductDetails.vue")
if not target.is_file():
    raise SystemExit(f"Cannot find {target}. Run this from ~/Developer/South-West.")

source = target.read_text()
start = "const variantChoices = computed(() => {"
end = "\n\n\nconst selectedVariantChoice = computed(() =>"
if source.count(start) != 1 or source.count(end) != 1:
    raise SystemExit("Could not identify the variant grouping block exactly once. No application files changed.")

old_selector = '<div v-if="variantChoices.length" class="variant-selector">'
old_legend = '      Choose variant\n'
if source.count(old_selector) != 1 or source.count(old_legend) != 1:
    raise SystemExit("Could not identify the selector template exactly once. No application files changed.")

backup = target.with_name(
    target.name + ".before-length-colour-ui-" + datetime.now().strftime("%Y%m%d%H%M%S")
)
shutil.copy2(target, backup)

new_block = """const hasMultipleLengths = computed(() => {
  const lengths = new Set(
    variants.value
      .map(getVariantLength)
      .filter(Boolean)
      .map(length => length.toLowerCase())
  )

  return lengths.size > 1
})

// Group variants by length only. If there is zero or one distinct length,
// all colour variants belong to one group and no length cards are displayed.
const variantChoices = computed(() => {
  const groups = new Map()

  for (const option of variantOptions.value) {
    const variant = variants.value.find(
      item => String(item.id) === String(option.id)
    )
    const length = getVariantLength(variant)
    const key = hasMultipleLengths.value
      ? `length:${length.toLowerCase()}`
      : 'all-colours'

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        name: hasMultipleLengths.value ? length : 'Available colours',
        attributes: [],
        options: []
      })
    }

    groups.get(key).options.push(option)
  }

  return [...groups.values()]
})"""

a = source.index(start)
b = source.index(end, a)
source = source[:a] + new_block + source[b:]
source = source.replace(old_selector, '<div v-if="hasMultipleLengths && variantChoices.length" class="variant-selector">', 1)
source = source.replace(old_legend, '      Choose length\n', 1)

target.write_text(source)
print(f"Updated {target}")
print(f"Backup created: {backup}")
print("Length cards display only when multiple distinct lengths exist.")
print("Other specifications are removed from the cards; colour selection maps to the matching SKU.")
