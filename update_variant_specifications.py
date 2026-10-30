from pathlib import Path
import re, sys
root=Path.cwd()
vue_path=root/'Frontend/Admin/src/pages/products/CreateItemVariants.vue'
backend_path=root/'Backend/src/controllers/itemVariantController.js'
if not vue_path.exists() or not backend_path.exists():
 print('Run from ~/Developer/South-West'); sys.exit(1)
v=vue_path.read_text(); b=backend_path.read_text()
def once(s, old, new, label):
 n=s.count(old)
 if n != 1 and not (label == "styles" and n == 2): raise RuntimeError(f'{label}: expected one match, got {n}; no files written')
 return s.replace(old,new,1)
v=once(v,"const items = ref([])\nconst colors = ref([])\n","const items = ref([])\nconst colors = ref([])\nconst specifications = ref([])\nconst specificationsLoading = ref(false)\n",'spec state')
v=once(v,"    color_ids: [],\n    attributes: [{ key: '', value: '' }],\n    is_default: false,","    color_ids: [],\n    attributes: {},\n    is_default: false,",'blank variant')
pat=re.compile(r"function addAttribute\(index\) \{.*?\n\}\n\nfunction removeAttribute\(index, attributeIndex\) \{.*?\n\}\n\nfunction buildAttributes\(variant\) \{.*?\n\}\n\n(?=async function loadItems\(\))",re.S)
helpers='''function applySpecificationFields(variant, preserveExisting = true) {
  const existing = preserveExisting && variant.attributes &&
    typeof variant.attributes === 'object' && !Array.isArray(variant.attributes)
    ? variant.attributes : {}
  const next = {}
  for (const spec of specifications.value) next[spec.name] = existing[spec.name] ?? ''
  // Preserve legacy keys so editing old variants does not silently discard data.
  for (const [key, value] of Object.entries(existing)) {
    if (!specifications.value.some(spec => spec.name === key)) next[key] = value ?? ''
  }
  variant.attributes = next
}

function buildAttributes(variant) {
  const result = {}
  for (const spec of specifications.value) {
    const raw = variant.attributes?.[spec.name]
    const value = raw === null || raw === undefined ? '' : String(raw).trim()
    if (spec.is_required && !value) throw new Error(`Variant "${variant.variant_name}": ${spec.name} is required.`)
    if (value) result[spec.name] = value
  }
  for (const [key, raw] of Object.entries(variant.attributes || {})) {
    if (!specifications.value.some(spec => spec.name === key)) {
      const value = raw === null || raw === undefined ? '' : String(raw).trim()
      if (value) result[key] = value
    }
  }
  return result
}

async function loadItemSpecifications(id) {
  specifications.value = []
  if (!id) return
  specificationsLoading.value = true
  try {
    const selectedItem = items.value.find(item => String(item.id) === String(id))
    const detailResponse = await api.get(`/items/${id}`)
    const payload = detailResponse?.data
    const item = payload?.data?.item || payload?.data || payload?.item || payload
    const itemTypeId = item?.item_type_id ?? selectedItem?.item_type_id
    if (!itemTypeId) {
      variants.value.forEach(variant => { variant.attributes = {} })
      return
    }
    const response = await api.get(`/item-type-specifications/item-type/${itemTypeId}`)
    specifications.value = getData(response).map(record => {
      const spec = record.specification || {}
      return {
        id: Number(record.specification_id ?? spec.id),
        name: String(spec.name || '').trim(),
        code: spec.code || '',
        data_type: spec.data_type || 'text',
        unit: spec.unit || '',
        is_required: Boolean(record.is_required ?? spec.is_required)
      }
    }).filter(spec => spec.id && spec.name)
      // Colour is handled through the colour picker and variant-colour relation.
      .filter(spec => !['color', 'colour', 'colors', 'colours'].includes(spec.name.toLowerCase()))
    variants.value.forEach(variant => applySpecificationFields(variant))
  } catch (error) {
    specifications.value = []
    formError.value = error.response?.data?.message || 'Failed to load item specifications.'
  } finally {
    specificationsLoading.value = false
  }
}

'''
v,n=pat.subn(helpers,v,count=1)
if n!=1: raise RuntimeError(f'manual attribute helpers: expected one match, got {n}; no files written')
v=once(v,"function addVariant() {\n  variants.value.push(blankVariant())","function addVariant() {\n  const variant = blankVariant()\n  applySpecificationFields(variant, false)\n  variants.value.push(variant)",'add variant')
v=once(v,"  colorError.value = ''\n  colorSuccess.value = ''\n  await loadItemColors(itemId.value)\n}","  colorError.value = ''\n  colorSuccess.value = ''\n  specifications.value = []\n  variants.value = [blankVariant()]\n  activeVariantIndex.value = 0\n  await Promise.all([loadItemSpecifications(itemId.value), loadItemColors(itemId.value)])\n}",'item change')
v=once(v,"      const selectedIds = variant.color_ids.map(String)\n\n      if (\n        new Set(selectedIds).size !== selectedIds.length ||","      const selectedIds = variant.color_ids.map(String)\n\n      if (selectedIds.length > 2) {\n        throw new Error(`Variant \"${name}\" can have a maximum of two colours.`)\n      }\n\n      if (\n        new Set(selectedIds).size !== selectedIds.length ||",'frontend colour validation')
v=once(v,"    itemId.value = foundItemId\n\n    const attrs = Object.entries(foundVariant.attributes || {}).map(\n      ([key, value]) => ({ key, value: String(value ?? '') })\n    )\n\n    variants.value = [{\n      variant_name: foundVariant.variant_name || '',\n      qb_item_code: foundVariant.qb_item_code || '',\n      color_ids: [],\n      attributes: attrs.length ? attrs : [{ key: '', value: '' }],\n      is_default: Boolean(foundVariant.is_default),\n      is_active: Boolean(foundVariant.is_active)\n    }]\n\n    await loadItemColors(foundItemId)","    itemId.value = foundItemId\n    await loadItemSpecifications(foundItemId)\n\n    variants.value = [{\n      variant_name: foundVariant.variant_name || '',\n      qb_item_code: foundVariant.qb_item_code || '',\n      color_ids: [],\n      attributes: foundVariant.attributes && typeof foundVariant.attributes === 'object'\n        ? { ...foundVariant.attributes } : {},\n      is_default: Boolean(foundVariant.is_default),\n      is_active: Boolean(foundVariant.is_active)\n    }]\n    applySpecificationFields(variants.value[0])\n\n    await loadItemColors(foundItemId)",'edit variant')
v=once(v,"  colors.value = []\n  formError.value = ''","  colors.value = []\n  specifications.value = []\n  specificationsLoading.value = false\n  formError.value = ''",'reset')
# Replace attribute editor section only.
tpat=re.compile(r'''          <div class="form-group full-width">\s*<label>Attributes</label>.*?          </div>\s*</div>''',re.S)
tmpl='''          <div class="form-group full-width">
            <label>Specifications</label>
            <p v-if="specificationsLoading" class="helper-note">Loading specifications for this item's type...</p>
            <p v-else-if="!specifications.length" class="helper-note">No active specifications are assigned to this item's type.</p>
            <div v-for="spec in specifications" :key="spec.id" class="form-group specification-field">
              <label :for="`spec_${index}_${spec.id}`">
                {{ spec.name }} <span v-if="spec.unit">({{ spec.unit }})</span>
                <span v-if="spec.is_required" class="required">*</span>
              </label>
              <input v-if="['number', 'decimal'].includes(spec.data_type)"
                :id="`spec_${index}_${spec.id}`" v-model="variant.attributes[spec.name]"
                :type="spec.data_type === 'number' ? 'number' : 'text'" :required="spec.is_required"
                :disabled="saving || specificationsLoading" :placeholder="`Enter ${spec.name.toLowerCase()}`" />
              <select v-else-if="spec.data_type === 'boolean'"
                :id="`spec_${index}_${spec.id}`" v-model="variant.attributes[spec.name]"
                :required="spec.is_required" :disabled="saving || specificationsLoading">
                <option value="">Select...</option><option value="true">Yes</option><option value="false">No</option>
              </select>
              <input v-else :id="`spec_${index}_${spec.id}`" v-model="variant.attributes[spec.name]"
                :type="spec.data_type === 'date' ? 'date' : 'text'" :required="spec.is_required"
                :disabled="saving || specificationsLoading" :placeholder="`Enter ${spec.name.toLowerCase()}`" />
            </div>
          </div>
        </div>'''
v,n=tpat.subn(tmpl,v,count=1)
if n!=1: raise RuntimeError(f'attribute template: expected one match, got {n}; no files written')
# Replace multiple select with visual colour buttons.
old='''            <select
              :id="`colors_${index}`"
              v-model="variant.color_ids"
              multiple
              class="multi-colour-select"
              :disabled="!itemId || loadingColors || saving"
            >
              <option
                v-for="color in colors"
                :key="color.id"
                :value="String(color.id)"
              >
                {{ color.color_name }} ({{ color.hex_code }})
              </option>
            </select>
            <small>Use Command-click on Mac to select multiple colours.</small>

            <div v-if="variant.color_ids.length" class="selected-color-list">
              <span
                v-for="colorId in variant.color_ids"
                :key="colorId"
                class="selected-color-item"
              >
                <span
                  class="color-swatch"
                  :style="{
                    backgroundColor:
                      colors.find(c => String(c.id) === String(colorId))?.hex_code || '#ccc'
                  }"
                />
                {{
                  colors.find(c => String(c.id) === String(colorId))?.color_name
                    || 'Unknown colour'
                }}
              </span>
            </div>'''
new='''            <div class="colour-picker-list">
              <button v-for="color in colors" :key="color.id" type="button"
                class="colour-choice" :class="{ selected: variant.color_ids.includes(String(color.id)) }"
                :disabled="!itemId || loadingColors || saving || (!variant.color_ids.includes(String(color.id)) && variant.color_ids.length >= 2)"
                @click="toggleVariantColor(variant, color.id)">
                <span class="color-swatch" :style="{ backgroundColor: color.hex_code || '#ccc' }" />
                <span>{{ color.color_name }}</span>
                <span v-if="variant.color_ids.includes(String(color.id))" aria-hidden="true">✓</span>
              </button>
            </div>
            <small>Select one or two colours for this variant.</small>'''
v=once(v,old,new,'colour template')
v=once(v,"function setDefaultVariant(index) {","function toggleVariantColor(variant, colorId) {\n  const id = String(colorId)\n  const selected = variant.color_ids.map(String)\n  if (selected.includes(id)) {\n    variant.color_ids = selected.filter(value => value !== id)\n    return\n  }\n  if (selected.length >= 2) return\n  variant.color_ids = [...selected, id]\n}\n\nfunction setDefaultVariant(index) {",'colour toggle')
v=once(v,".attribute-row {",".specification-field {\n  margin: 8px 0 14px;\n}\n\n.colour-picker-list {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 10px;\n}\n\n.colour-choice {\n  display: inline-flex;\n  align-items: center;\n  gap: 8px;\n  padding: 8px 10px;\n  border: 1px solid var(--border-color, #cbd2dc);\n  border-radius: 8px;\n  background: var(--surface, #fff);\n  color: inherit;\n  cursor: pointer;\n}\n\n.colour-choice.selected {\n  border-color: var(--primary-color, #2457d6);\n  box-shadow: 0 0 0 1px var(--primary-color, #2457d6);\n}\n\n.attribute-row {",'styles')
b=once(b,"            const colorIds = row.color_ids || [];\n\n            if (colorIds.some(colorId => !isValidId(colorId))) {","            const colorIds = row.color_ids || [];\n\n            if (colorIds.length > 2) {\n                return res.status(400).json({\n                    message: `Variant ${i + 1} can have a maximum of two colours`\n                });\n            }\n\n            if (colorIds.some(colorId => !isValidId(colorId))) {",'backend colour limit')
# Guard before write.
if 'v-model="attribute.key"' in v or 'function addAttribute(' in v: raise RuntimeError('Manual attribute inputs remain; no files written')
if v.count('<script setup>')!=1 or v.count('</script>')!=1: raise RuntimeError('Vue script structure unexpected; no files written')
vue_path.write_text(v); backend_path.write_text(b)
print('Updated CreateItemVariants.vue and itemVariantController.js')
