<template>
  <div class="item-form-page">
    <div class="form-header">
      <div>
        <h1>
          {{ isEditMode ? "Edit Item" : "Add Item" }}
        </h1>

        <p>
          {{
            isEditMode
                ? "Update the item information."
                : "Create a new product/item in the system."
          }}
        </p>
      </div>

      <button type="button" class="btn-secondary" @click="goBack">
        Cancel
      </button>
    </div>

    <form @submit.prevent="submitForm" class="item-form">

      <!-- Basic Information -->
      <section class="form-section">
        <div class="section-header">
          <h2>Basic Information</h2>
          <p>Enter the main information about the item.</p>
        </div>

        <div class="form-grid">

          <div class="form-group">
            <label for="item_code">
              Item Code / SKU <span>*</span>
            </label>

            <input
                id="item_code"
                v-model="form.item_code"
                type="text"
                placeholder="e.g. LAP-DELL-001"
                required
            />
          </div>

          <div class="form-group">
            <label for="item_name">
              Item Name <span>*</span>
            </label>

            <input
                id="item_name"
                v-model="form.item_name"
                type="text"
                placeholder="e.g. Dell Laptop 15.6 inch"
                required
            />
          </div>

          <div class="form-group searchable-select-group">

            <label>
              Category
            </label>

            <div class="searchable-select">

              <input
                  v-model="categorySearch"
                  type="text"
                  placeholder="Search category..."
                  autocomplete="off"
                  @focus="showCategoryDropdown = true"
                  @input="showCategoryDropdown = true"
                  @blur="closeCategoryDropdown"
                  @keydown.esc="closeCategoryDropdown"
              />

              <button
                  v-if="categorySearch"
                  type="button"
                  class="clear-search"
                  @click="clearCategory"
              >
                ×
              </button>

              <div
                  v-if="showCategoryDropdown"
                  class="searchable-dropdown"
                  @mousedown.prevent
              >

                <div
                    v-if="filteredCategories.length === 0"
                    class="dropdown-empty"
                >
                  No categories found.
                </div>

                <div
                    v-for="category in filteredCategories"
                    :key="category.id"
                    class="dropdown-option"
                    @mousedown.prevent="selectCategory(category)"
                >
                  {{ category.name }}
                </div>

              </div>

            </div>

            <!-- Register New Category -->
            <button
                type="button"
                class="quick-create-button"
                @click="openCategoryModal"
            >
              + Register New Category
            </button>

          </div>

          <div class="form-group searchable-select-group">

            <label>
              Brand
            </label>

            <div class="searchable-select">

              <input
                  v-model="brandSearch"
                  type="text"
                  placeholder="Search brand..."
                  autocomplete="off"
                  @focus="showBrandDropdown = true"
                  @input="showBrandDropdown = true"
                  @blur="closeBrandDropdown"
                  @keydown.esc="closeBrandDropdown"
              />

              <button
                  v-if="brandSearch"
                  type="button"
                  class="clear-search"
                  @click="clearBrand"
              >
                ×
              </button>

              <div
                  v-if="showBrandDropdown"
                  class="searchable-dropdown"
                  @mousedown.prevent
              >

                <div
                    v-if="filteredBrands.length === 0"
                    class="dropdown-empty"
                >
                  No brands found.
                </div>

                <div
                    v-for="brand in filteredBrands"
                    :key="brand.id"
                    class="dropdown-option"
                    @mousedown.prevent="selectBrand(brand)"
                >
                  {{ brand.name }}
                </div>

              </div>

            </div>

            <!-- Register New Brand -->
            <button
                type="button"
                class="quick-create-button"
                @click="openBrandModal"
            >
              + Register New Brand
            </button>

          </div>

          <div class="form-group">

            <label for="unit_id">
              Unit of Measure
            </label>

            <select
                id="unit_id"
                v-model="form.unit_id"
            >
              <option value="">
                Select Unit
              </option>

              <option
                  v-for="unit in units"
                  :key="unit.id"
                  :value="unit.id"
              >
                {{ unit.name }}
              </option>
            </select>

            <!-- Register New Unit -->
            <button
                type="button"
                class="quick-create-button"
                @click="openUnitModal"
            >
              + Register New Unit
            </button>

          </div>

          <div class="form-group searchable-select-group">

            <label>
              Item Type
            </label>

            <div class="searchable-select">

              <input
                  v-model="itemTypeSearch"
                  type="text"
                  placeholder="Search item type..."
                  autocomplete="off"
                  @focus="showItemTypeDropdown = true"
                  @input="showItemTypeDropdown = true"
                  @blur="closeItemTypeDropdown"
                  @keydown.esc="closeItemTypeDropdown"
              />

              <button
                  v-if="itemTypeSearch"
                  type="button"
                  class="clear-search"
                  @click="clearItemType"
              >
                ×
              </button>

              <div
                  v-if="showItemTypeDropdown"
                  class="searchable-dropdown"
                  @mousedown.prevent
              >

                <div
                    v-if="filteredItemTypes.length === 0"
                    class="dropdown-empty"
                >
                  No item types found.
                </div>

                <div
                    v-for="itemType in filteredItemTypes"
                    :key="itemType.id"
                    class="dropdown-option"
                    @mousedown.prevent="selectItemType(itemType)"
                >
                  {{ itemType.name }}
                </div>

              </div>

            </div>

          </div>


          <div class="form-group">
            <label for="warranty_id">Warranty</label>

            <select
                id="warranty_id"
                v-model="form.warranty_id"
            >
              <option value="">
                No Warranty
              </option>

              <option
                  v-for="warranty in availableWarranties"
                  :key="warranty.id"
                  :value="warranty.id"
              >
                {{ warranty.name }} ({{ formatWarrantyDuration(warranty) }})
              </option>
            </select>
          </div>

        </div>
      </section>

      <!-- Specifications -->
      <!-- Specifications -->
      <section
          v-if="form.item_type_id && form.specifications.length > 0"
          class="form-section"
      >

        <div class="section-header">

          <h2>Specifications</h2>

          <p>
            Enter the specifications for this item.
          </p>

        </div>


        <div
            v-for="(spec, index) in form.specifications"
            :key="spec.specification_id"
            class="specification-row"
        >

          <!-- Specification Name -->
          <div class="form-group specification-name">

            <label>
              {{ spec.name }}

              <span
                  v-if="spec.is_required"
              >
                    *
                </span>
            </label>

            <small v-if="spec.code">
              {{ spec.code }}
            </small>

          </div>


          <!-- Value -->
          <div class="form-group specification-value">

            <label>
              Value
            </label>

            <div class="value-with-unit">

              <input
                  v-model="spec.value"
                  :type="
                        spec.data_type === 'number'
                            ? 'number'
                            : 'text'
                    "
                  :placeholder="
                        `Enter ${spec.name.toLowerCase()}`
                    "
                  :required="spec.is_required"
              />

              <span
                  v-if="spec.unit"
                  class="specification-unit"
              >
                    {{ spec.unit }}
                </span>

            </div>

          </div>

        </div>

      </section>


      <!-- No specifications -->
      <section
          v-else-if="form.item_type_id"
          class="form-section"
      >

        <div class="section-header">

          <h2>Specifications</h2>

          <p>
            No specifications have been assigned
            to this item type.
          </p>

        </div>

      </section>

      <!-- Description -->
      <section class="form-section">
        <div class="section-header">
          <h2>Description</h2>
          <p>Add additional information about the item.</p>
        </div>

        <div class="form-group">
          <label for="description">Description</label>

          <textarea
              id="description"
              v-model="form.description"
              rows="5"
              placeholder="Enter item description..."
          ></textarea>
        </div>
      </section>


      <!-- Item Condition -->
      <section class="form-section">
        <div class="section-header">
          <h2>Item Condition</h2>
          <p>Specify the condition of the item.</p>
        </div>

        <div class="form-grid">

          <div class="form-group">
            <label for="condition">
              Condition <span>*</span>
            </label>

            <select
                id="condition"
                v-model="form.condition"
                required
            >
              <option value="new">New</option>
              <option value="used">Used</option>
              <option value="refurbished">Refurbished</option>
              <option value="open_box">Open Box</option>
              <option value="damaged">Damaged</option>
            </select>
          </div>

          <div class="form-group checkbox-group">
            <label>
              <input
                  v-model="form.is_serialized"
                  type="checkbox"
              />

              <span>
                Serialized Item
              </span>
            </label>

            <small>
              Enable this when each individual unit has a unique serial number.
            </small>
          </div>

        </div>
      </section>


      <!-- Status -->
      <section class="form-section">
        <div class="section-header">
          <h2>Status</h2>
          <p>Control whether this item is available in the system.</p>
        </div>

        <div class="checkbox-group">
          <label>
            <input
                v-model="form.is_active"
                type="checkbox"
            />

            <span>Active Item</span>
          </label>

          <small>
            Inactive items will not be available for normal selling operations.
          </small>
        </div>
      </section>


      <!-- Actions -->
      <div class="form-actions">
        <button
            type="button"
            class="btn-secondary"
            @click="goBack"
        >
          Cancel
        </button>

        <button
            type="submit"
            class="btn-primary"
            :disabled="loading"
        >
          {{
            loading
                ? (isEditMode ? "Updating..." : "Creating...")
                : (isEditMode ? "Update Item" : "Create Item")
          }}
        </button>
      </div>

    </form>

    <!-- Category Modal -->
    <div
        v-if="showCategoryModal"
        class="modal-overlay"
        @click.self="closeCategoryModal"
    >
      <div class="modal-container">

        <div class="modal-header">
          <div>
            <h2>Register New Category</h2>
            <p>
              Add a new category without leaving the item registration page.
            </p>
          </div>

          <button
              type="button"
              class="modal-close"
              @click="closeCategoryModal"
          >
            ×
          </button>
        </div>

        <div class="modal-body">

          <div class="form-group">
            <label for="new-category-name">
              Category Name
              <span>*</span>
            </label>

            <input
                id="new-category-name"
                v-model="newCategory.name"
                type="text"
                placeholder="e.g. Laptop Accessories"
                maxlength="100"
            />
          </div>

          <div class="form-group">
            <label for="new-category-code">
              Category Code
              <span>*</span>
            </label>

            <input
                id="new-category-code"
                v-model="newCategory.code"
                type="text"
                placeholder="e.g. LAPTOP-ACC"
                maxlength="50"
            />
          </div>

          <div class="form-group">
            <label for="new-category-description">
              Description
            </label>

            <textarea
                id="new-category-description"
                v-model="newCategory.description"
                rows="4"
                maxlength="255"
                placeholder="Describe this category..."
            ></textarea>
          </div>

          <div class="form-group">
            <label for="new-category-parent">
              Parent Category
            </label>

            <select
                id="new-category-parent"
                v-model="newCategory.parent_id"
            >
              <option :value="null">
                None
              </option>

              <option
                  v-for="category in categories"
                  :key="category.id"
                  :value="category.id"
              >
                {{ category.name }}
              </option>
            </select>
          </div>

        </div>

        <div class="modal-footer">
          <button
              type="button"
              class="btn-secondary"
              @click="closeCategoryModal"
          >
            Cancel
          </button>

          <button
              type="button"
              class="btn-primary"
              :disabled="modalSaving"
              @click="submitCategory"
          >
            {{ modalSaving ? 'Saving...' : 'Register Category' }}
          </button>
        </div>

      </div>
    </div>

  </div>

  <!-- Brand Modal -->
  <div
      v-if="showBrandModal"
      class="modal-overlay"
      @click.self="closeBrandModal"
  >
    <div class="modal-container">

      <div class="modal-header">
        <div>
          <h2>Register New Brand</h2>
          <p>
            Add a new brand without leaving the item registration page.
          </p>
        </div>

        <button
            type="button"
            class="modal-close"
            @click="closeBrandModal"
        >
          ×
        </button>
      </div>

      <div class="modal-body">

        <div class="form-group">
          <label for="new-brand-name">
            Brand Name
            <span>*</span>
          </label>

          <input
              id="new-brand-name"
              v-model="newBrand.name"
              type="text"
              placeholder="e.g. Logitech"
              maxlength="100"
          />
        </div>

        <div class="form-group">
          <label for="new-brand-code">
            Brand Code
            <span>*</span>
          </label>

          <input
              id="new-brand-code"
              v-model="newBrand.code"
              type="text"
              placeholder="e.g. LOGI"
              maxlength="50"
          />
        </div>

        <div class="form-group">
          <label for="new-brand-description">
            Description
          </label>

          <textarea
              id="new-brand-description"
              v-model="newBrand.description"
              rows="4"
              maxlength="255"
              placeholder="Describe this brand..."
          ></textarea>
        </div>

      </div>

      <div class="modal-footer">
        <button
            type="button"
            class="btn-secondary"
            @click="closeBrandModal"
        >
          Cancel
        </button>

        <button
            type="button"
            class="btn-primary"
            :disabled="modalSaving"
            @click="submitBrand"
        >
          {{ modalSaving ? 'Saving...' : 'Register Brand' }}
        </button>
      </div>

    </div>
  </div>

  <!-- Unit Modal -->
  <div
      v-if="showUnitModal"
      class="modal-overlay"
      @click.self="closeUnitModal"
  >
    <div class="modal-container">

      <div class="modal-header">
        <div>
          <h2>Register New Unit of Measure</h2>
          <p>
            Add a new unit without leaving the item registration page.
          </p>
        </div>

        <button
            type="button"
            class="modal-close"
            @click="closeUnitModal"
        >
          ×
        </button>
      </div>

      <div class="modal-body">

        <div class="form-group">
          <label for="new-unit-name">
            Unit Name
            <span>*</span>
          </label>

          <input
              id="new-unit-name"
              v-model="newUnit.name"
              type="text"
              placeholder="e.g. Piece"
              maxlength="100"
          />
        </div>

        <div class="form-group">
          <label for="new-unit-code">
            Unit Code
            <span>*</span>
          </label>

          <input
              id="new-unit-code"
              v-model="newUnit.code"
              type="text"
              placeholder="e.g. PCS"
              maxlength="50"
          />
        </div>

        <div class="form-group">
          <label for="new-unit-description">
            Description
          </label>

          <textarea
              id="new-unit-description"
              v-model="newUnit.description"
              rows="4"
              maxlength="255"
              placeholder="Describe this unit..."
          ></textarea>
        </div>

      </div>

      <div class="modal-footer">
        <button
            type="button"
            class="btn-secondary"
            @click="closeUnitModal"
        >
          Cancel
        </button>

        <button
            type="button"
            class="btn-primary"
            :disabled="modalSaving"
            @click="submitUnit"
        >
          {{ modalSaving ? 'Saving...' : 'Register Unit' }}
        </button>
      </div>

    </div>
  </div>
</template>


<script setup>
import { ref, computed, onMounted } from "vue"
import { useRouter, useRoute } from "vue-router"
import api from "../../api/axios"

const router = useRouter()
const route = useRoute()

/* =========================================================
   MODE
========================================================= */

const isEditMode = computed(() => !!route.params.id)
const itemId = computed(() => route.params.id || null)

/* =========================================================
   STATE
========================================================= */

const loading = ref(false)
const pageLoading = ref(true)
const errorMessage = ref("")

const categories = ref([])
const brands = ref([])
const units = ref([])
const itemTypes = ref([])
const warranties = ref([])

// Quick Create Modals
const showCategoryModal = ref(false)
const showBrandModal = ref(false)
const showUnitModal = ref(false)
const itemTypeSearch = ref("")
const showItemTypeDropdown = ref(false)

// Quick Create Forms
const newCategory = ref({
  name: '',
  code: '',
  description: '',
  parent_id: null
})

const newBrand = ref({
  name: '',
  code: '',
  description: ''
})

const newUnit = ref({
  name: '',
  code: '',
  description: ''
})

// Open modals
const openCategoryModal = () => {
  showCategoryModal.value = true
}

const openBrandModal = () => {
  showBrandModal.value = true
}

const openUnitModal = () => {
  showUnitModal.value = true
}


const modalSaving = ref(false)

const resetCategoryForm = () => {
  newCategory.value = { name: '', code: '', description: '', parent_id: null }
}

const resetBrandForm = () => {
  newBrand.value = { name: '', code: '', description: '' }
}

const resetUnitForm = () => {
  newUnit.value = { name: '', code: '', description: '' }
}

const closeCategoryModal = () => {
  showCategoryModal.value = false
  resetCategoryForm()
}

const closeBrandModal = () => {
  showBrandModal.value = false
  resetBrandForm()
}

const closeUnitModal = () => {
  showUnitModal.value = false
  resetUnitForm()
}

/* =========================================================
   FORM
========================================================= */

const form = ref({
  category_id: "",
  brand_id: "",
  unit_id: "",
  item_type_id: "",
  warranty_id: "",

  item_code: "",
  item_name: "",
  description: "",

  condition: "new",
  is_serialized: false,
  is_active: true,

  specifications: []
})

/* =========================================================
   SEARCHABLE CATEGORY / BRAND
========================================================= */

const categorySearch = ref("")
const brandSearch = ref("")

const showCategoryDropdown = ref(false)
const showBrandDropdown = ref(false)

/* =========================================================
   FILTER CATEGORIES
========================================================= */

const filteredCategories = computed(() => {
  const term = categorySearch.value.toLowerCase().trim()

  if (!term) {
    return categories.value
  }

  return categories.value.filter(category =>
      String(category.name || "")
          .toLowerCase()
          .includes(term)
  )
})

/* =========================================================
   FILTER BRANDS
========================================================= */

const filteredBrands = computed(() => {
  const term = brandSearch.value.toLowerCase().trim()

  if (!term) {
    return brands.value
  }

  return brands.value.filter(brand =>
      String(brand.name || "")
          .toLowerCase()
          .includes(term)
  )
})

/* =========================================================
   CATEGORY
========================================================= */

const selectCategory = category => {
  form.value.category_id = category.id
  categorySearch.value = category.name
  showCategoryDropdown.value = false
}

const clearCategory = () => {
  form.value.category_id = ""
  categorySearch.value = ""
  showCategoryDropdown.value = false
}

const handleCategoryInput = () => {
  showCategoryDropdown.value = true

  const matchingCategory = categories.value.find(
      category =>
          String(category.name || "").toLowerCase() ===
          categorySearch.value.toLowerCase().trim()
  )

  if (!matchingCategory) {
    form.value.category_id = ""
  }
}

/* =========================================================
   BRAND
========================================================= */

const selectBrand = brand => {
  form.value.brand_id = brand.id
  brandSearch.value = brand.name
  showBrandDropdown.value = false
}

const clearBrand = () => {
  form.value.brand_id = ""
  brandSearch.value = ""
  showBrandDropdown.value = false
}

const handleBrandInput = () => {
  showBrandDropdown.value = true

  const matchingBrand = brands.value.find(
      brand =>
          String(brand.name || "").toLowerCase() ===
          brandSearch.value.toLowerCase().trim()
  )

  if (!matchingBrand) {
    form.value.brand_id = ""
  }
}

// Active warranties only, but keep the item's current one visible when editing
const availableWarranties = computed(() =>
    warranties.value.filter(
        warranty =>
            warranty.is_active ||
            Number(warranty.id) === Number(form.value.warranty_id)
    )
)

const formatWarrantyDuration = (warranty) => {
  const value = Number(warranty.duration_value) || 0

  if (value === 0) return "No warranty"

  const unit = String(warranty.duration_unit || "")

  return `${value} ${value === 1 ? unit.replace(/s$/i, "") : unit}`
}

/* =========================================================
   LOAD DROPDOWN OPTIONS
========================================================= */

const loadOptions = async () => {
  const [
    categoriesResponse,
    brandsResponse,
    unitsResponse,
    itemTypesResponse,
    warrantiesResponse
  ] = await Promise.all([
    api.get("/categories"),
    api.get("/brands"),
    api.get("/units"),
    api.get("/item-types"),
    api.get("/warranties")
  ])

  categories.value = categoriesResponse.data.data || []
  brands.value = brandsResponse.data.data || []
  units.value = unitsResponse.data.data || []
  itemTypes.value = itemTypesResponse.data.data || []
  warranties.value = warrantiesResponse.data.data || []
}


const submitCategory = async () => {
  const name = newCategory.value.name.trim()
  const code = newCategory.value.code.trim().toUpperCase()

  if (!name || !code) {
    alert('Category name and code are required.')
    return
  }

  try {
    modalSaving.value = true

    const response = await api.post('/categories', {
      name,
      code,
      description: newCategory.value.description.trim() || null,
      parent_id: newCategory.value.parent_id || null
    })

    const created = response.data.data

    categories.value.push(created)
    form.value.category_id = created.id
    categorySearch.value = created.name
    showCategoryDropdown.value = false

    closeCategoryModal()
  } catch (error) {
    console.error('Create category error:', error)
    alert(error.response?.data?.message || 'Failed to create category.')
  } finally {
    modalSaving.value = false
  }
}

const submitBrand = async () => {
  const name = newBrand.value.name.trim()
  const code = newBrand.value.code.trim().toUpperCase()

  if (!name || !code) {
    alert('Brand name and code are required.')
    return
  }

  try {
    modalSaving.value = true

    const response = await api.post('/brands', {
      name,
      code,
      description: newBrand.value.description.trim() || null
    })

    const created = response.data.data

    brands.value.push(created)
    form.value.brand_id = created.id
    brandSearch.value = created.name
    showBrandDropdown.value = false

    closeBrandModal()
  } catch (error) {
    console.error('Create brand error:', error)
    alert(error.response?.data?.message || 'Failed to create brand.')
  } finally {
    modalSaving.value = false
  }
}

/* =========================================================
   ITEM TYPE
========================================================= */

const filteredItemTypes = computed(() => {
  const term = itemTypeSearch.value.toLowerCase().trim()

  if (!term) {
    return itemTypes.value
  }

  return itemTypes.value.filter(itemType =>
      String(itemType.name || "")
          .toLowerCase()
          .includes(term)
  )
})

const selectItemType = async (itemType) => {
  form.value.item_type_id = itemType.id
  itemTypeSearch.value = itemType.name
  showItemTypeDropdown.value = false

  await loadSpecificationsForItemType(itemType.id, [])
}

const clearItemType = () => {
  form.value.item_type_id = ""
  itemTypeSearch.value = ""
  showItemTypeDropdown.value = false
  form.value.specifications = []
}

/* =========================================================
   CLOSE DROPDOWNS (outside click / Esc / Tab)
   Closes the list and resets the text to the selected value,
   so typed text that was never selected doesn't linger.
========================================================= */

const closeCategoryDropdown = () => {
  showCategoryDropdown.value = false

  categorySearch.value =
      categories.value.find(
          category =>
              Number(category.id) === Number(form.value.category_id)
      )?.name || ""
}

const closeBrandDropdown = () => {
  showBrandDropdown.value = false

  brandSearch.value =
      brands.value.find(
          brand =>
              Number(brand.id) === Number(form.value.brand_id)
      )?.name || ""
}

const closeItemTypeDropdown = () => {
  showItemTypeDropdown.value = false

  itemTypeSearch.value =
      itemTypes.value.find(
          itemType =>
              Number(itemType.id) === Number(form.value.item_type_id)
      )?.name || ""
}

const submitUnit = async () => {
  const name = newUnit.value.name.trim()
  const code = newUnit.value.code.trim().toUpperCase()

  if (!name || !code) {
    alert('Unit name and code are required.')
    return
  }

  try {
    modalSaving.value = true

    const response = await api.post('/units', {
      name,
      code,
      description: newUnit.value.description.trim() || null
    })

    const created = response.data.data

    units.value.push(created)
    form.value.unit_id = created.id

    closeUnitModal()
  } catch (error) {
    console.error('Create unit error:', error)
    alert(error.response?.data?.message || 'Failed to create unit.')
  } finally {
    modalSaving.value = false
  }
}


/* =========================================================
   PARSE SPECIFICATION OPTIONS
========================================================= */

const parseOptions = raw => {
  if (Array.isArray(raw)) {
    return raw
  }

  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw)

      if (Array.isArray(parsed)) {
        return parsed
      }
    } catch (error) {
      return raw
          .split(",")
          .map(option => option.trim())
          .filter(Boolean)
    }
  }

  return []
}

/* =========================================================
   LOAD SPECIFICATIONS
========================================================= */

const loadSpecificationsForItemType = async (
    itemTypeId,
    existingValues = []
) => {
  if (!itemTypeId) {
    form.value.specifications = []
    return
  }

  try {
    const response = await api.get(
        `/item-type-specifications/item-type/${itemTypeId}`
    )

    const records = response.data.data || []

    /*
      Convert saved specification values into a map.

      Example:

      {
        1: "16GB",
        2: "512GB",
        3: "Dell"
      }
    */

    const existingValueMap = {}

    existingValues.forEach(record => {
      existingValueMap[Number(record.specification_id)] =
          record.value ?? ""
    })

    form.value.specifications = records.map(record => {
      const specificationId = Number(record.specification_id)

      const spec = record.specification || {}

      return {
        specification_id: specificationId,

        name: spec.name || "",

        code: spec.code || "",

        description: spec.description || "",

        data_type: spec.data_type || "text",

        unit: spec.unit || "",

        options: parseOptions(spec.options),

        is_required: Boolean(record.is_required),

        /*
          IMPORTANT:

          If editing, use existing saved value.
          If creating, this becomes empty.
        */
        value: existingValueMap[specificationId] ?? ""
      }
    })

  } catch (error) {
    console.error(
        "Failed to load item type specifications:",
        error
    )

    form.value.specifications = []

    errorMessage.value =
        error.response?.data?.message ||
        "Failed to load specifications."
  }
}

/* =========================================================
   ITEM TYPE CHANGE
========================================================= */

const handleItemTypeChange = async () => {
  /*
    User manually changed the item type.

    Therefore we load a fresh specification list
    without existing saved values.
  */

  await loadSpecificationsForItemType(
      form.value.item_type_id,
      []
  )
}

/* =========================================================
   LOAD ITEM FOR EDIT
========================================================= */

const loadItem = async () => {
  if (!itemId.value) {
    return
  }

  const response = await api.get(
      `/items/${itemId.value}`
  )

  const item = response.data.data

  if (!item) {
    throw new Error("Item not found.")
  }

  /* -----------------------------------------
     Basic fields
  ----------------------------------------- */

  form.value.category_id =
      item.category_id ?? ""

  form.value.brand_id =
      item.brand_id ?? ""

  form.value.unit_id =
      item.unit_id ?? ""

  form.value.item_type_id =
      item.item_type_id ?? ""

  form.value.warranty_id =
      item.warranty_id ?? ""

  form.value.item_code =
      item.item_code ?? ""

  form.value.item_name =
      item.item_name ?? ""

  form.value.description =
      item.description ?? ""

  form.value.condition =
      item.condition ?? "new"

  form.value.is_serialized =
      Boolean(item.is_serialized)

  form.value.is_active =
      Boolean(item.is_active)

  /* -----------------------------------------
     Category display value
  ----------------------------------------- */

  categorySearch.value =
      item.category?.name ||
      categories.value.find(
          category =>
              Number(category.id) ===
              Number(item.category_id)
      )?.name ||
      ""

  /* -----------------------------------------
     Brand display value
  ----------------------------------------- */

  brandSearch.value =
      item.brand?.name ||
      brands.value.find(
          brand =>
              Number(brand.id) ===
              Number(item.brand_id)
      )?.name ||
      ""


  itemTypeSearch.value =
      item.itemType?.name ||
      itemTypes.value.find(
          itemType =>
              Number(itemType.id) === Number(item.item_type_id)
      )?.name ||
      ""


  /* -----------------------------------------
     Specifications
  ----------------------------------------- */

  if (item.item_type_id) {

    await loadSpecificationsForItemType(
        item.item_type_id,
        item.specificationValues || []
    )

  } else {

    form.value.specifications = []

  }
}

/* =========================================================
   SUBMIT FORM
========================================================= */

const submitForm = async () => {
  errorMessage.value = ""

  try {

    loading.value = true

    /* -----------------------------------------
       Validate required specifications
    ----------------------------------------- */

    const invalidSpecifications =
        form.value.specifications.filter(spec =>
            spec.is_required &&
            (
                spec.value === null ||
                String(spec.value).trim() === ""
            )
        )

    if (invalidSpecifications.length > 0) {

      alert(
          `Please enter: ${invalidSpecifications
              .map(spec => spec.name)
              .join(", ")}`
      )

      loading.value = false

      return
    }

    /* -----------------------------------------
       Item payload
    ----------------------------------------- */

    const payload = {

      category_id:
          form.value.category_id || null,

      brand_id:
          form.value.brand_id || null,

      unit_id:
          form.value.unit_id || null,

      item_type_id:
          form.value.item_type_id || null,

      warranty_id:
          form.value.warranty_id || null,

      item_code:
          form.value.item_code.trim(),

      item_name:
          form.value.item_name.trim(),

      description:
          (form.value.description || "").trim() || null,

      condition:
      form.value.condition,

      is_serialized:
      form.value.is_serialized,

      is_active:
      form.value.is_active
    }

    let savedItemId

    /* =====================================================
       CREATE
    ===================================================== */

    if (!isEditMode.value) {

      const response = await api.post(
          "/items",
          payload
      )

      const createdItem =
          response.data.data

      savedItemId =
          createdItem.id

    }

    /* =====================================================
       EDIT
    ===================================================== */

    else {

      savedItemId = itemId.value

      await api.put(
          `/items/${savedItemId}`,
          payload
      )

    }

    /* =====================================================
       SPECIFICATION VALUES
    ===================================================== */

    const specificationValues =
        form.value.specifications
            .filter(spec =>
                spec.value !== null &&
                String(spec.value).trim() !== ""
            )
            .map(spec => ({
              item_id: Number(savedItemId),

              specification_id:
                  Number(spec.specification_id),

              value:
                  String(spec.value).trim()
            }))

    /* =====================================================
       SAVE SPECIFICATION VALUES
    ===================================================== */

    if (specificationValues.length > 0) {

      await Promise.all(
          specificationValues.map(spec =>
              api.post(
                  "/item-specification-values",
                  spec
              )
          )
      )

    }

    /* =====================================================
       SUCCESS
    ===================================================== */

    alert(
        isEditMode.value
            ? "Item updated successfully."
            : "Item created successfully."
    )

    router.push("/admin/products/items")

  } catch (error) {

    console.error(
        isEditMode.value
            ? "Failed to update item:"
            : "Failed to create item:",
        error
    )

    errorMessage.value =
        error.response?.data?.message ||
        (
            isEditMode.value
                ? "Failed to update item."
                : "Failed to create item."
        )

    alert(errorMessage.value)

  } finally {

    loading.value = false

  }
}

/* =========================================================
   BACK
========================================================= */

const goBack = () => {
  router.push("/admin/products/items")
}

/* =========================================================
   INITIAL LOAD
========================================================= */

onMounted(async () => {

  try {

    pageLoading.value = true

    errorMessage.value = ""

    /*
      1. Load dropdown options first
      2. If edit mode, load existing item
      3. Existing category/brand names can then be resolved
    */

    await loadOptions()

    if (isEditMode.value) {

      await loadItem()

    }

  } catch (error) {

    console.error(
        "Initial item form loading error:",
        error
    )

    errorMessage.value =
        error.response?.data?.message ||
        error.message ||
        "Failed to load item."

  } finally {

    pageLoading.value = false

  }

})
</script>


<style scoped>
.item-form-page {
  width: 100%;
  max-width: 1100px;
  margin: 0 auto;
  font-family: var(--font-family);
}

.form-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--spacing-lg);
  margin-bottom: var(--spacing-2xl);
}

.form-header h1 {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
}

.form-header p {
  margin-top: 5px;
  font-size: var(--font-size-md);
  color: var(--color-text-secondary);
}

.form-section {
  margin-bottom: var(--spacing-xl);
  padding: var(--spacing-2xl);
  background: var(--color-surface);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.section-header {
  margin-bottom: var(--spacing-xl);
}

.section-header h2 {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
}

.section-header p {
  margin-top: 5px;
  font-size: var(--font-size-md);
  color: var(--color-text-secondary);
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--spacing-xl);
}

.form-group {
  display: flex;
  flex-direction: column;
}

.form-group label {
  margin-bottom: var(--spacing-sm);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.form-group label span {
  color: var(--color-danger);
}

input,
select,
textarea {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  color: var(--color-text-primary);
  font-family: inherit;
  font-size: var(--font-size-md);
  outline: none;
  transition: border-color var(--transition-fast),
  box-shadow var(--transition-fast);
}

input,
select {
  height: 40px;
  padding: 0 var(--spacing-lg);
}

textarea {
  padding: 10px var(--spacing-lg);
  resize: vertical;
}

input::placeholder,
textarea::placeholder {
  color: var(--color-text-muted);
}

input:focus,
select:focus,
textarea:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-light);
}

.searchable-select-group {
  position: relative;
}

.searchable-select {
  position: relative;
  width: 100%;
}

.searchable-select input {
  width: 100%;
  padding: 10px 40px 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  font-size: 14px;
  outline: none;
  box-sizing: border-box;
}

.searchable-select input:focus {
  border-color: #2563eb;
}

.searchable-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  max-height: 220px;
  overflow-y: auto;
  background: #fff;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  z-index: 1000;
}

.dropdown-option {
  padding: 10px 12px;
  cursor: pointer;
  font-size: 14px;
}

.dropdown-option:hover {
  background: #f3f4f6;
}

.dropdown-empty {
  padding: 12px;
  color: #6b7280;
  font-size: 14px;
}

.clear-search {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  border: none;
  background: transparent;
  font-size: 20px;
  color: #6b7280;
  cursor: pointer;
  padding: 0;
}

.clear-search:hover {
  color: #111827;
}

.checkbox-group {
  justify-content: center;
}

.checkbox-group label {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-xs);
  font-size: var(--font-size-md);
  cursor: pointer;
}

.checkbox-group input {
  width: 16px;
  height: 16px;
  padding: 0;
  accent-color: var(--color-primary);
}

.checkbox-group small {
  margin-left: 24px;
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-md);
  margin-top: var(--spacing-2xl);
}

.btn-primary,
.btn-secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 40px;
  padding: 0 var(--spacing-xl);
  border-radius: var(--radius-lg);
  font-family: inherit;
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  white-space: nowrap;
  cursor: pointer;
  transition: background var(--transition-fast),
  color var(--transition-fast),
  border-color var(--transition-fast);
}

.btn-primary {
  border: none;
  background: var(--color-primary);
  color: var(--color-text-light);
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  border: 1px solid var(--color-border-light);
  background: var(--color-surface);
  color: var(--color-text-secondary);
}

.btn-secondary:hover {
  background: var(--color-hover-bg);
  color: var(--color-text-primary);
}

/* =========================
   Specifications
   ========================= */

.specification-row {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: var(--spacing-lg);
  align-items: end;
  margin-bottom: var(--spacing-lg);
  padding: var(--spacing-lg);
  background: var(--color-submenu-bg);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
}

.specification-action {
  display: flex;
  align-items: flex-end;
}

.btn-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 40px;
  padding: 0 var(--spacing-lg);
  border: 1px solid var(--color-danger-light);
  border-radius: var(--radius-lg);
  background: var(--color-danger-bg);
  color: var(--color-danger);
  font-family: inherit;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  white-space: nowrap;
  cursor: pointer;
  transition: background var(--transition-fast),
  color var(--transition-fast),
  border-color var(--transition-fast);
}

.btn-remove:hover {
  background: var(--color-danger);
  border-color: var(--color-danger);
  color: var(--color-text-light);
}

.quick-create-button {
  margin-top: 8px;
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #f8fafc;
  color: #2563eb;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.quick-create-button:hover {
  background: #eff6ff;
}

/* ========================================
   Quick Create
======================================== */

.select-with-action {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.quick-create-button {
  align-self: flex-start;
  border: none;
  background: transparent;
  padding: 0;
  color: #2563eb;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.quick-create-button:hover {
  text-decoration: underline;
}


/* ========================================
   Modal
======================================== */

.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;

  display: flex;
  align-items: center;
  justify-content: center;

  padding: 24px;

  background: rgba(15, 23, 42, 0.55);
}

.modal-container {
  width: 100%;
  max-width: 600px;
  max-height: 90vh;

  display: flex;
  flex-direction: column;

  background: #ffffff;
  border-radius: 12px;

  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.2);

  overflow: hidden;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;

  padding: 24px;

  border-bottom: 1px solid #e5e7eb;
}

.modal-header h2 {
  margin: 0 0 6px;
  font-size: 20px;
  font-weight: 600;
  color: #111827;
}

.modal-header p {
  margin: 0;
  font-size: 14px;
  color: #6b7280;
}

.modal-close {
  width: 32px;
  height: 32px;

  display: flex;
  align-items: center;
  justify-content: center;

  border: none;
  background: transparent;

  font-size: 24px;
  line-height: 1;

  color: #6b7280;

  cursor: pointer;
  border-radius: 6px;
}

.modal-close:hover {
  background: #f3f4f6;
  color: #111827;
}

.modal-body {
  padding: 24px;
  overflow-y: auto;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;

  padding: 16px 24px;

  border-top: 1px solid #e5e7eb;
  background: #f9fafb;
}


/* ========================================
   Modal Form
======================================== */

.modal-body .form-group {
  margin-bottom: 20px;
}

.modal-body .form-group:last-child {
  margin-bottom: 0;
}

.modal-body label {
  display: block;

  margin-bottom: 7px;

  font-size: 14px;
  font-weight: 500;

  color: #374151;
}

.modal-body label span {
  color: #dc2626;
}

.modal-body input,
.modal-body select,
.modal-body textarea {
  width: 100%;

  box-sizing: border-box;

  padding: 10px 12px;

  border: 1px solid #d1d5db;
  border-radius: 7px;

  background: #ffffff;

  font-size: 14px;
  color: #111827;

  outline: none;
}

.modal-body input:focus,
.modal-body select:focus,
.modal-body textarea:focus {
  border-color: #2563eb;

  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.modal-body textarea {
  resize: vertical;
  min-height: 90px;
}


/* ========================================
   Responsive
======================================== */

@media (max-width: 640px) {
  .modal-overlay {
    padding: 12px;
  }

  .modal-container {
    max-height: 95vh;
  }

  .modal-header,
  .modal-body,
  .modal-footer {
    padding: 18px;
  }

  .modal-footer {
    flex-direction: column-reverse;
  }

  .modal-footer button {
    width: 100%;
  }
}

@media (max-width: 768px) {
  .form-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }

  .form-actions {
    flex-direction: column-reverse;
  }

  .specification-row {
    grid-template-columns: 1fr;
    gap: var(--spacing-md);
  }

  .btn-remove {
    width: 100%;
  }

  .btn-primary,
  .btn-secondary {
    width: 100%;
  }
}
</style>
