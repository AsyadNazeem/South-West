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
import api from '@/services/api.js'

const router = useRouter()

const categories = ref([])
const loading = ref(true)
const error = ref('')
const hoveredCategoryId = ref(null)
const navRef = ref(null)
const menuRef = ref(null)
const dropdownLeft = ref(0)

// Last input type used on the nav: 'mouse', 'touch', 'pen' or 'keyboard'.
// Hover opens the dropdown for a real mouse only; touch and pen use taps.
const lastPointerType = ref('mouse')

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

// Without a mouse there is no way to click the main category once its
// dropdown is open, so the dropdown gets an "All <category>" entry.
const showViewAll = computed(() => lastPointerType.value !== 'mouse')

function isOpen(category) {
  return (
      String(hoveredCategoryId.value) === String(category.id) &&
      category.children.length > 0
  )
}

// Position the dropdown underneath the open category.
async function positionDropdown(id) {
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
  // Measure the real dropdown; fall back to an estimate before it renders.
  const dropdownWidth =
      menuRef.value?.offsetWidth ?? Math.min(360, window.innerWidth * 0.92)

  const desiredLeft = itemRect.left - navRect.left

  dropdownLeft.value = Math.max(
      0,
      Math.min(
          desiredLeft,
          nav.clientWidth - dropdownWidth
      )
  )
}

watch(hoveredCategoryId, positionDropdown)

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

/* ---------- Pointer handling ---------- */
function trackPointer(event) {
  lastPointerType.value = event.pointerType || 'mouse'
}

function trackKeyboard() {
  lastPointerType.value = 'keyboard'
}

function onCategoryEnter(event, category) {
  if (event.pointerType === 'mouse') hoveredCategoryId.value = category.id
}

function onCategoryClick(category) {
  const usesTap = ['touch', 'pen'].includes(lastPointerType.value)

  // Touch: a tap on a category with subcategories opens or closes its dropdown.
  if (usesTap && category.children.length > 0) {
    hoveredCategoryId.value = isOpen(category) ? null : category.id
    return
  }

  selectMainCategory(category)
}

function onNavLeave(event) {
  if (event.pointerType === 'mouse') closeMenu()
}

function onAllProductsEnter(event) {
  if (event.pointerType === 'mouse') closeMenu()
}

function onMenuEnter(event) {
  if (event.pointerType === 'mouse' && hoveredCategory.value) {
    hoveredCategoryId.value = hoveredCategory.value.id
  }
}

function handleOutsidePointer(event) {
  if (
      hoveredCategoryId.value != null &&
      navRef.value &&
      !navRef.value.contains(event.target)
  ) {
    closeMenu()
  }
}

function handleEscape(event) {
  if (event.key === 'Escape') closeMenu()
}

function handleResize() {
  // Recalculate the position only. Closing and reopening the menu here made it
  // flicker on phones, where scrolling resizes the viewport.
  if (hoveredCategoryId.value != null) {
    positionDropdown(hoveredCategoryId.value)
  }
}

onMounted(() => {
  loadCategories()
  window.addEventListener('keydown', handleEscape)
  window.addEventListener('resize', handleResize)
  document.addEventListener('pointerdown', handleOutsidePointer)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleEscape)
  window.removeEventListener('resize', handleResize)
  document.removeEventListener('pointerdown', handleOutsidePointer)
})
</script>

<template>
  <nav
      ref="navRef"
      class="category-nav"
      aria-label="Product categories"
      @pointerdown="trackPointer"
      @keydown="trackKeyboard"
      @pointerleave="onNavLeave"
  >
    <div class="category-inner" @scroll.passive="closeMenu">
      <button
          type="button"
          class="category-button"
          :class="{ active: activeCategory === 'All Products' }"
          @pointerenter="onAllProductsEnter"
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
            @pointerenter="onCategoryEnter($event, category)"
        >
          <button
              type="button"
              class="category-button"
              :class="{ active: activeCategory === category.name }"
              :aria-haspopup="category.children.length ? 'true' : undefined"
              :aria-expanded="category.children.length ? isOpen(category) : undefined"
              @click="onCategoryClick(category)"
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

    <!-- Dropdown positioned under the open category -->
    <div
        v-if="hoveredCategory && subcategories.length"
        ref="menuRef"
        class="mega-menu"
        :style="{ '--menu-left': `${dropdownLeft}px` }"
        @pointerenter="onMenuEnter"
    >
      <div class="subcategory-grid">
        <button
            v-if="showViewAll"
            type="button"
            class="subcategory-link view-all"
            @click.stop="selectMainCategory(hoveredCategory)"
        >
          All {{ hoveredCategory.name }}
        </button>

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
  overscroll-behavior-x: contain;
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

/* aria-expanded also marks the open category on touch screens */
.category-button.active,
.category-button[aria-expanded='true'] {
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
  left: var(--menu-left, 0px);
  width: 360px;
  max-width: 92vw;
  max-height: 60vh;
  max-height: 60dvh;
  overflow-y: auto;
  overscroll-behavior: contain;
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

/* Shown on touch only: opens the main category itself */
.subcategory-link.view-all {
  grid-column: 1 / -1;
  color: var(--color-primary);
  font-weight: var(--font-weight-semibold);
}

/* Text colour change only, no background */
.subcategory-link:active {
  color: var(--color-primary);
}

/* Hover colours only where hover exists, so taps do not leave a stuck highlight */
@media (hover: hover) {
  .category-button:hover,
  .subcategory-link:hover {
    color: var(--color-primary);
  }
}

.nav-error {
  width: min(var(--container-store), 94%);
  margin: 0 auto;
  padding: 10px 0;
  color: var(--color-danger);
  font-size: var(--font-size-xs);
}

/* ---------- Touch devices: 44px targets, no scrollbar on the category row ---------- */
@media (pointer: coarse) {
  .category-inner {
    scrollbar-width: none;
  }

  .category-inner::-webkit-scrollbar {
    display: none;
  }

  .category-button {
    min-height: 44px;
  }

  .subcategory-link {
    display: flex;
    align-items: center;
    min-height: 44px;
    padding-left: 10px;
    padding-right: 10px;
  }
}

/* ---------- Phones and small tablets: dropdown spans the content width ---------- */
@media (max-width: 650px) {
  .category-inner {
    gap: var(--space-5);
  }

  .mega-menu {
    left: 3%;
    right: 3%;
    width: auto;
    max-width: none;
  }

  .subcategory-grid {
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  }
}
</style>