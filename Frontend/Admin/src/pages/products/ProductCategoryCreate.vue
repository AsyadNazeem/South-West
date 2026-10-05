<script setup>
import { ref, onMounted, computed } from "vue"
import { useRouter, useRoute } from "vue-router"
import api from "../../api/axios"

const router = useRouter()
const route = useRoute()

// --------------------------------------------------
// FORM
// --------------------------------------------------

const form = ref({
  id: null,
  name: "",
  code: "",
  description: "",
  parent_id: "",
  is_active: true
})

// --------------------------------------------------
// MODE
// --------------------------------------------------

const isEditMode = computed(() => !!route.params.id)

// --------------------------------------------------
// STATE
// --------------------------------------------------

const categories = ref([])
const loadingCategories = ref(false)
const loadingCategory = ref(false)
const saving = ref(false)

const errorMessage = ref("")
const successMessage = ref("")

// --------------------------------------------------
// PARENT CATEGORY SEARCH
// --------------------------------------------------

const parentCategorySearch = ref("")
const showParentCategoryDropdown = ref(false)

// --------------------------------------------------
// PARENT CATEGORIES
// --------------------------------------------------

const parentCategories = computed(() => {
  return categories.value.filter(category => {
    return (
        category.is_active &&
        Number(category.id) !== Number(form.value.id)
    )
  })
})

// --------------------------------------------------
// FILTERED PARENT CATEGORIES
// --------------------------------------------------

const filteredParentCategories = computed(() => {
  const term = parentCategorySearch.value
      .toLowerCase()
      .trim()

  if (!term) {
    return parentCategories.value
  }

  return parentCategories.value.filter(category => {
    return (
        category.name?.toLowerCase().includes(term) ||
        category.code?.toLowerCase().includes(term)
    )
  })
})

// --------------------------------------------------
// LOAD ALL CATEGORIES
// --------------------------------------------------

const loadCategories = async () => {
  try {
    loadingCategories.value = true

    const response = await api.get("/categories")

    categories.value = response.data.data || []

  } catch (error) {
    console.error("Load categories error:", error)

    errorMessage.value =
        error.response?.data?.message ||
        "Failed to load categories."

  } finally {
    loadingCategories.value = false
  }
}

// --------------------------------------------------
// LOAD SINGLE CATEGORY FOR EDIT
// --------------------------------------------------

const loadCategory = async () => {
  if (!isEditMode.value) {
    return
  }

  try {
    loadingCategory.value = true
    errorMessage.value = ""

    console.log(
        "Loading category ID:",
        route.params.id
    )

    const response = await api.get(
        `/categories/${route.params.id}`
    )

    console.log(
        "Category API response:",
        response.data
    )

    const category = response.data.data

    if (!category) {
      throw new Error("Category data not found.")
    }

    // Fill the same form
    form.value = {
      id: category.id,
      name: category.name || "",
      code: category.code || "",
      description: category.description || "",
      parent_id: category.parent_id ?? "",
      is_active: category.is_active ?? true
    }

    // Show parent category in search box
    if (category.parent) {
      parentCategorySearch.value =
          `${category.parent.name} (${category.parent.code})`
    } else {
      parentCategorySearch.value = ""
    }

    console.log(
        "Form after loading:",
        form.value
    )

  } catch (error) {
    console.error(
        "Load category error:",
        error
    )

    errorMessage.value =
        error.response?.data?.message ||
        "Failed to load category."

  } finally {
    loadingCategory.value = false
  }
}

// --------------------------------------------------
// SELECT PARENT CATEGORY
// --------------------------------------------------

const selectParentCategory = (category) => {
  form.value.parent_id = category.id

  parentCategorySearch.value =
      `${category.name} (${category.code})`

  showParentCategoryDropdown.value = false
}

// --------------------------------------------------
// CLEAR PARENT CATEGORY
// --------------------------------------------------

const clearParentCategory = () => {
  form.value.parent_id = ""
  parentCategorySearch.value = ""
  showParentCategoryDropdown.value = false
}

// --------------------------------------------------
// SAVE CATEGORY
// --------------------------------------------------

const saveCategory = async () => {
  errorMessage.value = ""
  successMessage.value = ""

  // Validation
  if (!form.value.name.trim()) {
    errorMessage.value =
        "Category name is required."
    return
  }

  if (!form.value.code.trim()) {
    errorMessage.value =
        "Category code is required."
    return
  }

  try {
    saving.value = true

    const payload = {
      name: form.value.name.trim(),

      code: form.value.code.trim(),

      description:
          form.value.description.trim() || null,

      parent_id:
          form.value.parent_id !== "" &&
          form.value.parent_id !== null
              ? Number(form.value.parent_id)
              : null,

      is_active: form.value.is_active
    }

    console.log(
        "Saving category:",
        payload
    )

    // --------------------------------------------------
    // UPDATE
    // --------------------------------------------------

    if (isEditMode.value) {

      await api.put(
          `/categories/${route.params.id}`,
          payload
      )

      successMessage.value =
          "Category updated successfully."

    }

        // --------------------------------------------------
        // CREATE
    // --------------------------------------------------

    else {

      await api.post(
          "/categories",
          payload
      )

      successMessage.value =
          "Category created successfully."
    }

    // Go back after save
    setTimeout(() => {
      router.push("/categories")
    }, 800)

  } catch (error) {

    console.error(
        "Save category error:",
        error
    )

    errorMessage.value =
        error.response?.data?.message ||
        "Failed to save category."

  } finally {
    saving.value = false
  }
}

// --------------------------------------------------
// CANCEL
// --------------------------------------------------

const cancel = () => {
  router.push("/admin/products/categories")
}

// --------------------------------------------------
// ON MOUNT
// --------------------------------------------------

onMounted(async () => {

  // First load categories
  await loadCategories()

  // Then load selected category if editing
  if (isEditMode.value) {
    await loadCategory()
  }

})
</script>

<template>
  <div class="page-container">

    <!-- Header -->
    <div class="page-header">
      <div>
        <h1>
          {{ isEditMode ? "Edit Category" : "Add Category" }}
        </h1>

        <p>
          {{
            isEditMode
                ? "Update the category information."
                : "Create a new product category or subcategory."
          }}
        </p>
      </div>

      <button
          type="button"
          class="secondary-button"
          @click="cancel"
      >
        Back
      </button>
    </div>


    <!-- Error -->
    <div
        v-if="errorMessage"
        class="error-state"
    >
      {{ errorMessage }}
    </div>


    <!-- Success -->
    <div
        v-if="successMessage"
        class="success-state"
    >
      {{ successMessage }}
    </div>


    <!-- Form -->
    <div class="form-card">

      <form @submit.prevent="saveCategory">

        <!-- Basic Information -->
        <div class="form-section">

          <div class="section-header">
            <h2>Category Information</h2>

            <p>
              Enter the basic information for this category.
            </p>
          </div>


          <!-- Category Name -->
          <div class="form-group">

            <label for="name">
              Category Name
              <span class="required">*</span>
            </label>

            <input
                id="name"
                v-model="form.name"
                type="text"
                maxlength="100"
                placeholder="e.g. Laptop Accessories"
                required
            />

          </div>


          <!-- Category Code -->
          <div class="form-group">

            <label for="code">
              Category Code
              <span class="required">*</span>
            </label>

            <input
                id="code"
                v-model="form.code"
                type="text"
                maxlength="50"
                placeholder="e.g. LAP-ACC"
                required
            />

            <small>
              Use a unique code for this category.
            </small>

          </div>


          <!-- Parent Category -->
          <div class="form-group searchable-select-group">

            <label>
              Parent Category
            </label>

            <div class="searchable-select">

              <input
                  v-model="parentCategorySearch"
                  type="text"
                  placeholder="Search parent category..."
                  autocomplete="off"
                  :disabled="loadingCategories"
                  @focus="showParentCategoryDropdown = true"
                  @input="showParentCategoryDropdown = true"
              />

              <button
                  v-if="parentCategorySearch"
                  type="button"
                  class="clear-search"
                  @click="clearParentCategory"
              >
                ×
              </button>

              <div
                  v-if="showParentCategoryDropdown"
                  class="searchable-dropdown"
              >

                <!-- None option -->
                <div
                    class="dropdown-option"
                    @mousedown.prevent="clearParentCategory"
                >
                  None - Main Category
                </div>

                <!-- No results -->
                <div
                    v-if="filteredParentCategories.length === 0"
                    class="dropdown-empty"
                >
                  No parent categories found.
                </div>

                <!-- Categories -->
                <div
                    v-for="category in filteredParentCategories"
                    :key="category.id"
                    class="dropdown-option"
                    @mousedown.prevent="selectParentCategory(category)"
                >
                  {{ category.name }}
                  <span class="category-code">
          ({{ category.code }})
        </span>
                </div>

              </div>

            </div>

            <small>
              Leave this as "None" to create a main category.
              Select a parent category to create a subcategory.
            </small>

          </div>


          <!-- Description -->
          <div class="form-group">

            <label for="description">
              Description
            </label>

            <textarea
                id="description"
                v-model="form.description"
                rows="4"
                placeholder="Enter a description for this category..."
            ></textarea>

          </div>


          <!-- Status -->
          <div class="form-group">

            <label>
              Status
            </label>

            <label class="toggle-container">

              <input
                  v-model="form.is_active"
                  type="checkbox"
              />

              <span>
                Active
              </span>

            </label>

            <small>
              Inactive categories will not normally be available
              for new products.
            </small>

          </div>

        </div>


        <!-- Category Type Preview -->
        <div class="category-preview">

          <h3>Category Type</h3>

          <div
              v-if="!form.parent_id"
              class="preview-content"
          >
            <span class="preview-badge main">
              Main Category
            </span>

            <p>
              This will be created as a main product category.
            </p>
          </div>

          <div
              v-else
              class="preview-content"
          >
            <span class="preview-badge sub">
              Subcategory
            </span>

            <p>
              This category will be placed under the selected
              parent category.
            </p>
          </div>

        </div>


        <!-- Actions -->
        <div class="form-actions">

          <button
              type="button"
              class="secondary-button"
              @click="cancel"
              :disabled="saving"
          >
            Cancel
          </button>

          <button
              type="submit"
              class="primary-button"
              :disabled="saving"
          >
            {{
              saving
                  ? (isEditMode ? "Updating..." : "Creating...")
                  : (isEditMode ? "Update Category" : "Create Category")
            }}
          </button>

        </div>

      </form>

    </div>

  </div>
</template>

<style scoped>
.page-container {
  width: 100%;
  max-width: 900px;
  margin: 0 auto;
  font-family: var(--font-family);
}

/* =========================
   Page Header
   ========================= */

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--spacing-lg);
  margin-bottom: var(--spacing-2xl);
}

.page-header h1 {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
}

.page-header p {
  margin-top: 5px;
  font-size: var(--font-size-md);
  color: var(--color-text-secondary);
}

/* =========================
   Form Card
   ========================= */

.form-card {
  max-width: 900px;
  background: var(--color-surface);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  padding: var(--spacing-xl);
  align-content: center;
  justify-content: center;
}

.form-section {
  margin-bottom: var(--spacing-xl);
}

.section-header {
  margin-bottom: var(--spacing-xl);
  padding-bottom: var(--spacing-lg);
  border-bottom: 1px solid var(--color-border-light);
}

.section-header h2 {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.section-header p {
  margin-top: var(--spacing-xs);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

/* =========================
   Form Fields
   ========================= */

.form-group {
  display: flex;
  flex-direction: column;
  margin-bottom: var(--spacing-xl);
}

.form-group > label {
  margin-bottom: var(--spacing-sm);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.required {
  margin-left: 2px;
  color: var(--color-danger);
}

.form-group input:not([type="checkbox"]),
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 0 var(--spacing-lg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  color: var(--color-text-primary);
  font-family: inherit;
  font-size: var(--font-size-md);
  box-sizing: border-box;
  outline: none;
  transition: border-color var(--transition-fast),
  box-shadow var(--transition-fast);
}

.form-group input:not([type="checkbox"]),
.form-group select {
  height: 42px;
}

.form-group select {
  cursor: pointer;
}

.form-group textarea {
  padding: var(--spacing-md) var(--spacing-lg);
  line-height: 1.5;
  resize: vertical;
}

.form-group input::placeholder,
.form-group textarea::placeholder {
  color: var(--color-text-muted);
}

.form-group input:not([type="checkbox"]):focus,
.form-group select:focus,
.form-group textarea:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-light);
}

.form-group select:disabled {
  background: var(--color-hover-bg);
  color: var(--color-text-muted);
  cursor: not-allowed;
}

.form-group small {
  display: block;
  margin-top: 6px;
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
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

.searchable-select input:disabled {
  background: #f3f4f6;
  cursor: not-allowed;
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

.category-code {
  color: #6b7280;
  font-size: 13px;
}

/* =========================
   Status Toggle
   ========================= */

.toggle-container {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-size: var(--font-size-md);
  color: var(--color-text-secondary);
  cursor: pointer;
}

.toggle-container input {
  width: 16px;
  height: 16px;
  accent-color: var(--color-primary);
  cursor: pointer;
}

/* =========================
   Category Type Preview
   ========================= */

.category-preview {
  margin-bottom: var(--spacing-xl);
  padding: var(--spacing-xl);
  background: var(--color-submenu-bg);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
}

.category-preview h3 {
  margin-bottom: var(--spacing-md);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.preview-content {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.preview-content p {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.preview-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  white-space: nowrap;
}

.preview-badge.main {
  background: var(--color-primary-light);
  color: var(--color-primary);
}

.preview-badge.sub {
  background: var(--color-info-bg);
  color: var(--color-info);
}

/* =========================
   Actions
   ========================= */

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-md);
  padding-top: var(--spacing-xl);
  border-top: 1px solid var(--color-border-light);
}

.primary-button,
.secondary-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 10px var(--spacing-lg);
  border-radius: var(--radius-lg);
  font-family: inherit;
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  white-space: nowrap;
  cursor: pointer;
  transition: background var(--transition-fast),
  border-color var(--transition-fast),
  color var(--transition-fast);
}

.primary-button {
  border: 1px solid var(--color-primary);
  background: var(--color-primary);
  color: var(--color-text-light);
}

.primary-button:hover:not(:disabled) {
  border-color: var(--color-primary-hover);
  background: var(--color-primary-hover);
}

.secondary-button {
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text-secondary);
}

.secondary-button:hover:not(:disabled) {
  background: var(--color-hover-bg);
  color: var(--color-text-primary);
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* =========================
   States
   ========================= */

.error-state,
.success-state {
  margin-bottom: var(--spacing-lg);
  padding: var(--spacing-md) var(--spacing-lg);
  border-radius: var(--radius-lg);
  font-size: var(--font-size-sm);
}

.error-state {
  background: var(--color-danger-bg);
  color: var(--color-danger);
}

.success-state {
  background: var(--color-success-bg);
  color: var(--color-success);
}

/* =========================
   Responsive
   ========================= */

@media (max-width: 700px) {
  .page-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .preview-content {
    flex-direction: column;
    align-items: flex-start;
  }

  .form-actions {
    flex-direction: column-reverse;
  }

  .form-actions button {
    width: 100%;
  }
}
</style>
