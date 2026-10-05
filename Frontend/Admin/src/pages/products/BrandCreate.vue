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

const brandId = computed(() => route.params.id || null)

/* =========================================================
   STATE
========================================================= */

const loading = ref(false)
const pageLoading = ref(true)
const errorMessage = ref("")

/* =========================================================
   FORM
========================================================= */

const form = ref({
  name: "",
  code: "",
  description: "",
  website: "",
  is_active: true
})

/* =========================================================
   LOAD BRAND
========================================================= */

const loadBrand = async () => {
  if (!brandId.value) {
    return
  }

  try {

    const response = await api.get(
        `/brands/${brandId.value}`
    )

    const brand = response.data.data

    if (!brand) {
      throw new Error("Brand not found.")
    }

    form.value = {
      name: brand.name ?? "",
      code: brand.code ?? "",
      description: brand.description ?? "",
      website: brand.website ?? "",
      is_active: Boolean(brand.is_active)
    }

  } catch (error) {

    console.error(
        "Failed to load brand:",
        error
    )

    errorMessage.value =
        error.response?.data?.message ||
        error.message ||
        "Failed to load brand."
  }
}

/* =========================================================
   SUBMIT
========================================================= */

const submitForm = async () => {

  loading.value = true
  errorMessage.value = ""

  try {

    /* -----------------------------------------
       Validation
    ----------------------------------------- */

    if (!form.value.name.trim()) {

      errorMessage.value =
          "Brand name is required."

      loading.value = false

      return
    }

    if (!form.value.code.trim()) {

      errorMessage.value =
          "Brand code is required."

      loading.value = false

      return
    }

    /* -----------------------------------------
       Payload
    ----------------------------------------- */

    const payload = {

      name:
          form.value.name.trim(),

      code:
          form.value.code
              .trim()
              .toUpperCase(),

      description:
          form.value.description.trim() || null,

      website:
          form.value.website.trim() || null,

      is_active:
      form.value.is_active
    }

    /* =====================================================
       CREATE
    ===================================================== */

    if (!isEditMode.value) {

      await api.post(
          "/brands",
          payload
      )

      alert(
          "Brand created successfully."
      )

    }

    /* =====================================================
       EDIT
    ===================================================== */

    else {

      await api.put(
          `/brands/${brandId.value}`,
          payload
      )

      alert(
          "Brand updated successfully."
      )

    }

    /* -----------------------------------------
       Back to brands
    ----------------------------------------- */

    router.push("/brands")

  } catch (error) {

    console.error(
        isEditMode.value
            ? "Failed to update brand:"
            : "Failed to create brand:",
        error
    )

    errorMessage.value =
        error.response?.data?.message ||
        error.message ||
        (
            isEditMode.value
                ? "Failed to update brand."
                : "Failed to create brand."
        )

  } finally {

    loading.value = false

  }
}

/* =========================================================
   BACK
========================================================= */

const goBack = () => {
  router.push("/admin/products/brands")
}

/* =========================================================
   INITIAL LOAD
========================================================= */

onMounted(async () => {

  try {

    pageLoading.value = true
    errorMessage.value = ""

    /*
      Only load a brand when editing.
    */

    if (isEditMode.value) {
      await loadBrand()
    }

  } catch (error) {

    console.error(
        "Initial brand form loading error:",
        error
    )

    errorMessage.value =
        error.response?.data?.message ||
        error.message ||
        "Failed to load brand."

  } finally {

    pageLoading.value = false

  }

})
</script>

<template>
  <div class="brand-form-page">

    <!-- Header -->
    <div class="form-header">
      <div>
        <h1>
          {{ isEditMode ? "Edit Brand" : "Create Brand" }}
        </h1>

        <p>
          {{
            isEditMode
                ? "Update the brand information."
                : "Add a new brand that can be assigned to products."
          }}
        </p>
      </div>

      <button
          type="button"
          class="btn-secondary"
          @click="goBack"
      >
        Cancel
      </button>
    </div>

    <!-- Error -->
    <div
        v-if="errorMessage"
        class="error-message"
    >
      {{ errorMessage }}
    </div>

    <!-- Form -->
    <form
        class="brand-form"
        @submit.prevent="submitForm"
    >

      <!-- Brand Information -->
      <section class="form-section">

        <div class="section-header">
          <h2>Brand Information</h2>
          <p>Define the name, code and details of the brand.</p>
        </div>

        <div class="form-grid">

          <!-- Name -->
          <div class="form-group">
            <label for="name">
              Brand Name
              <span>*</span>
            </label>

            <input
                id="name"
                v-model="form.name"
                type="text"
                placeholder="e.g. Hewlett-Packard"
                maxlength="100"
                required
            />
          </div>

          <!-- Code -->
          <div class="form-group">
            <label for="code">
              Brand Code
              <span>*</span>
            </label>

            <input
                id="code"
                v-model="form.code"
                type="text"
                placeholder="e.g. HP"
                maxlength="50"
                required
            />

            <small>
              A unique code used to identify this brand.
            </small>
          </div>

          <!-- Website -->
          <div class="form-group">
            <label for="website">
              Website
            </label>

            <input
                id="website"
                v-model="form.website"
                type="url"
                placeholder="https://example.com"
            />
          </div>

        </div>

        <!-- Description -->
        <div class="form-group full-width">
          <label for="description">
            Description
          </label>

          <textarea
              id="description"
              v-model="form.description"
              rows="5"
              placeholder="Describe this brand..."
          ></textarea>
        </div>

      </section>

      <!-- Settings -->
      <section class="form-section">

        <div class="section-header">
          <h2>Settings</h2>
          <p>Configure whether this brand can be used in the system.</p>
        </div>

        <div class="checkbox-group">
          <label>
            <input
                v-model="form.is_active"
                type="checkbox"
            />

            <span>Active</span>
          </label>

          <small>
            Inactive brands will not be available when registering
            new items.
          </small>
        </div>

      </section>

      <!-- Actions -->
      <div class="form-actions">

        <button
            type="button"
            class="btn-secondary"
            @click="goBack"
            :disabled="loading"
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
                ? (isEditMode ? "Updating..." : "Saving...")
                : (isEditMode ? "Update Brand" : "Create Brand")
          }}
        </button>

      </div>

    </form>

  </div>
</template>

<style scoped>
.brand-form-page {
  width: 100%;
  max-width: 1100px;
  margin: 0 auto;
  font-family: var(--font-family);
}

/* =========================
   Header
   ========================= */

.form-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
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

/* =========================
   Form / Sections
   ========================= */

.brand-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xl);
}

.form-section {
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
  gap: var(--spacing-sm);
}

.full-width {
  margin-top: var(--spacing-xl);
}

/* =========================
   Labels / Inputs
   ========================= */

.form-group label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.form-group label span {
  color: var(--color-danger);
}

.form-group input,
.form-group textarea {
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

.form-group input {
  height: 40px;
  padding: 0 var(--spacing-lg);
}

.form-group textarea {
  min-height: 120px;
  padding: 10px var(--spacing-lg);
  resize: vertical;
}

.form-group input::placeholder,
.form-group textarea::placeholder {
  color: var(--color-text-muted);
}

.form-group input:focus,
.form-group textarea:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-light);
}

.form-group small,
.checkbox-group small {
  font-size: var(--font-size-xs);
  line-height: 1.5;
  color: var(--color-text-muted);
}

/* =========================
   Checkbox
   ========================= */

.checkbox-group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.checkbox-group label {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  cursor: pointer;
}

.checkbox-group input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
  accent-color: var(--color-primary);
}

/* =========================
   Error
   ========================= */

.error-message {
  margin-bottom: var(--spacing-lg);
  padding: var(--spacing-md) var(--spacing-lg);
  border: 1px solid var(--color-danger-light);
  border-radius: var(--radius-lg);
  background: var(--color-danger-bg);
  color: var(--color-danger);
  font-size: var(--font-size-sm);
}

/* =========================
   Actions / Buttons
   ========================= */

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-md);
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

.btn-secondary {
  border: 1px solid var(--color-border-light);
  background: var(--color-surface);
  color: var(--color-text-secondary);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--color-hover-bg);
  color: var(--color-text-primary);
}

.btn-primary:disabled,
.btn-secondary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* =========================
   Responsive
   ========================= */

@media (max-width: 768px) {
  .form-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }

  .form-section {
    padding: var(--spacing-xl);
  }

  .form-actions {
    flex-direction: column-reverse;
  }

  .btn-primary,
  .btn-secondary {
    width: 100%;
  }
}
</style>
