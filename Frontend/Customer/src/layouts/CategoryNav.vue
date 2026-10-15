<script setup>
import {
  computed,
  onMounted,
  onUnmounted,
  ref,
  nextTick,
  watch,
} from 'vue'
import { useRouter } from 'vue-router'
import api from '../services/api.js'

const router = useRouter()

const categories = ref([])
const loading = ref(true)
const error = ref('')
const hoveredCategoryId = ref(null)
const navRef = ref(null)
const dropdownLeft = ref(0)

const activeCategory = defineModel('activeCategory', {
  default: 'All Products',
})

const emit = defineEmits(['category-selected'])

const hoveredCategory = computed(() =>
    categories.value.find(
        category =>
            String(category.id) === String(hoveredCategoryId.value)
    ) || null
)

const subcategories = computed(() =>
    hoveredCategory.value?.children || []
)

// Position the dropdown underneath the hovered category.
watch(hoveredCategoryId, async (id) => {
  if (id == null) return

  await nextTick()

  const nav = navRef.value
  if (!nav) return

  const item = nav.querySelector(
      `[data-category-id="${CSS.escape(String(id))}"]`
  )

  if (!item) return

  const navRect = nav.getBoundingClientRect()
  const itemRect = item.getBoundingClientRect()
  const dropdownWidth = Math.min(360, window.innerWidth * 0.92)

  const desiredLeft = itemRect.left - navRect.left

  dropdownLeft.value = Math.max(
      0,
      Math.min(
          desiredLeft,
          nav.clientWidth - dropdownWidth
      )
  )
})

async function loadCategories() {
  loading.value = true
  error.value = ''

  try {
    const response = await api.get('/store/categories')
    const payload = response.data

    const list = Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.categories)
            ? payload.categories
            : []

    categories.value = list
        .filter(category => category.parent_id == null)
        .map(category => ({
          ...category,
          children: Array.isArray(category.children)
              ? [...category.children].sort((a, b) =>
                  a.name.localeCompare(b.name)
              )
              : [],
        }))
        .sort((a, b) => a.name.localeCompare(b.name))
  } catch (err) {
    error.value =
        err.response?.data?.message ||
        'Unable to load categories.'
  } finally {
    loading.value = false
  }
}

function selectMainCategory(category) {
  activeCategory.value = category.name
  hoveredCategoryId.value = null

  emit('category-selected', category)

  router.push({
    path: '/',
    query: category.id == null
        ? {}
        : { category: String(category.id) },
  })
}

function selectSubcategory(category) {
  activeCategory.value = category.name
  hoveredCategoryId.value = null

  emit('category-selected', category)

  router.push({
    path: '/',
    query: { category: String(category.id) },
  })
}

function closeMenu() {
  hoveredCategoryId.value = null
}

function handleEscape(event) {
  if (event.key === 'Escape') closeMenu()
}

function handleResize() {
  if (hoveredCategoryId.value != null) {
    // Recalculate position after the browser resizes.
    const id = hoveredCategoryId.value
    hoveredCategoryId.value = null

    nextTick(() => {
      hoveredCategoryId.value = id
    })
  }
}

onMounted(() => {
  loadCategories()
  window.addEventListener('keydown', handleEscape)
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleEscape)
  window.removeEventListener('resize', handleResize)
})
</script>

<template>
  <nav
      ref="navRef"
      class="category-nav"
      aria-label="Product categories"
      @mouseleave="closeMenu"
  >
    <div class="category-inner">
      <button
          type="button"
          class="category-button"
          :class="{ active: activeCategory === 'All Products' }"
          @mouseenter="closeMenu"
          @focus="closeMenu"
          @click="selectMainCategory({
          id: null,
          name: 'All Products',
        })"
      >
        All Products
      </button>

      <span v-if="loading" class="nav-status">
        Loading categories…
      </span>

      <template v-else>
        <div
            v-for="category in categories"
            :key="category.id"
            class="category-item"
            :data-category-id="category.id"
            @mouseenter="hoveredCategoryId = category.id"
        >
          <button
              type="button"
              class="category-button"
              :class="{ active: activeCategory === category.name }"
              :aria-expanded="
              String(hoveredCategoryId) === String(category.id) &&
              category.children.length > 0
            "
              @click="selectMainCategory(category)"
          >
            {{ category.name }}

            <span
                v-if="category.children.length"
                class="category-arrow"
                aria-hidden="true"
            >
              <svg viewBox="0 0 24 24" fill="none">
                <path d="m6 9 6 6 6-6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </span>
          </button>
        </div>
      </template>
    </div>

    <!-- Dropdown positioned under the hovered category -->
    <div
        v-if="hoveredCategory && subcategories.length"
        class="mega-menu"
        :style="{ left: `${dropdownLeft}px` }"
        @mouseenter="hoveredCategoryId = hoveredCategory.id"
    >
      <div class="subcategory-grid">
        <button
            v-for="subcategory in subcategories"
            :key="subcategory.id"
            type="button"
            class="subcategory-link"
            @click.stop="selectSubcategory(subcategory)"
        >
          {{ subcategory.name }}
        </button>
      </div>
    </div>

    <p v-if="error" class="nav-error">
      {{ error }}
    </p>
  </nav>
</template>

<style scoped>
.category-nav {
  position: relative;
  z-index: 100;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border-soft);
}

.category-inner {
  width: min(var(--container-store), 94%);
  margin: 0 auto;
  display: flex;
  gap: var(--space-6);
  overflow-x: auto;
  scrollbar-width: thin;
}

.category-item {
  display: flex;
  flex-shrink: 0;
}

/* Simple text-only menu items: the only hover/active change is text colour */
.category-button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  padding: 13px 0;
  border: 0;
  background: transparent;
  color: var(--color-text-muted);
  font: inherit;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  letter-spacing: 0.01em;
  cursor: pointer;
  white-space: nowrap;
  transition: color var(--transition-fast);
}

.category-button:hover,
.category-button.active {
  color: var(--color-primary);
}

.category-button:focus-visible,
.subcategory-link:focus-visible {
  outline: 2px solid var(--color-focus-outline);
  outline-offset: -2px;
}

.category-arrow {
  display: grid;
  width: 12px;
  height: 12px;
}

.nav-status {
  flex-shrink: 0;
  padding: 13px 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
}

/* Compact dropdown */
.mega-menu {
  position: absolute;
  top: 100%;
  width: 360px;
  max-width: 92vw;
  padding: 8px;
  background: var(--color-surface);
  border: 1px solid var(--color-border-soft);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  z-index: 101;
}

.subcategory-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 2px;
}

.subcategory-link {
  display: block;
  width: 100%;
  min-width: 0;
  padding: 8px 8px;
  border: 0;
  background: transparent;
  color: var(--color-text);
  font: inherit;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-regular);
  line-height: 1.4;
  text-align: left;
  overflow-wrap: anywhere;
  cursor: pointer;
  transition: color var(--transition-fast);
}

/* Text colour change only, no background */
.subcategory-link:hover {
  color: var(--color-primary);
}

.nav-error {
  width: min(var(--container-store), 94%);
  margin: 0 auto;
  padding: 10px 0;
  color: var(--color-danger);
  font-size: var(--font-size-xs);
}

@media (max-width: 650px) {
  .category-inner {
    gap: var(--space-5);
  }

  .mega-menu {
    width: 300px;
  }

  .subcategory-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
