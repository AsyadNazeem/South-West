<script setup>
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '@/services/api'
import { useWebsiteTheme } from '@/composables/useWebsiteTheme'
import CategoryNav from '@/layouts/CategoryNav.vue'
import HomeCategory from '@/components/home/HomeCategory.vue'
import HomeBrand from '@/components/home/HomeBrand.vue'
import HomePromoBanner from '@/components/home/HomePromoBanner.vue'
import HomeInsertedSection from '@/components/home/HomeInsertedSection.vue'
import { organizationSchema, setStructuredData, websiteSchema } from '@/utils/structuredData'

const ProductGrid = defineAsyncComponent(() => import('@/components/products/ProductGrid.vue'))
const HomeCategoryRails = defineAsyncComponent(() => import('@/components/home/HomeCategoryRails.vue'))
const HomeDiscount = defineAsyncComponent(() => import('@/components/home/HomeDiscount.vue'))
const ProductFilters = defineAsyncComponent(() => import('@/components/products/ProductFilters.vue'))
const ProductSort = defineAsyncComponent(() => import('@/components/products/ProductSort.vue'))

const { floralArtwork, themeSlug } = useWebsiteTheme()
const route = useRoute()
const router = useRouter()

// Default layout if homepage configuration cannot be loaded.
const DEFAULT_HOMEPAGE_SECTIONS = [
  'hero_banner',
  'shopping_benefits',
  'shop_categories',
  'shop_brands',
  'discount_products',
  'top_rated_products',
  'promo_banner_1',
  'category_product_rows',
  'promo_banner_2',
  'just_for_you',
]

const homepageSections = ref(
  DEFAULT_HOMEPAGE_SECTIONS.map((section_key, sort_order) => ({
    section_key,
    is_active: true,
    sort_order,
  }))
)

const homepageSectionKeys = computed(() =>
  homepageSections.value
    .filter(section => section.is_active)
    .map(section => section.section_key)
)

// Sections in the exact display order configured by the Admin Panel.
const orderedHomepageSections = computed(() =>
  [...homepageSections.value]
    .filter(section => section.is_active)
    .sort((a, b) => a.sort_order - b.sort_order)
)

// Return the position configured for a homepage section.
function homepageSectionOrder(sectionKey) {
  const section = orderedHomepageSections.value.find(
    item => item.section_key === sectionKey
  )

  return section?.sort_order ?? 999
}

// Only the sections immediately surrounding Category Product Rows
// can be inserted between its individual product rows.
const insertedHomepageSections = computed(() => {
  const ordered = [...homepageSections.value].sort(
    (a, b) => a.sort_order - b.sort_order
  )

  const categoryIndex = ordered.findIndex(
    section => section.section_key === 'category_product_rows'
  )

  if (categoryIndex === -1) return []
  if (!ordered[categoryIndex].is_active) return []

  // Keep sections in their normal positions until category rows
  // are available to receive them.
  if (!catalogReady.value || !homepageCategories.value.length) {
    return []
  }

  return ordered.filter((section, index) => {
    if (!section.is_active) return false
    if (Math.abs(index - categoryIndex) !== 1) return false

    const row = section.settings?.after_category_row

    return Number.isInteger(row) && row >= 1 && row <= 8
  })
})

// Share an existing section's integer flex order. The greeting follows the category
// block in the DOM, and never moves a section out of its configured rail.
const greetingOrder = computed(() => {
  const sections = orderedHomepageSections.value.filter(s => !isInsertedHomepageSection(s.section_key))
  const anchor = sections.find(s => s.section_key === 'shop_categories') || sections[0]
  return anchor?.sort_order
})

const mountedInsertionTargets = ref({})

function insertionTarget(sectionKey) {
  return mountedInsertionTargets.value[sectionKey] || null
}

async function refreshInsertionTargets() {
  await nextTick()

  const targets = {}

  for (const section of insertedHomepageSections.value) {
    const key = section.section_key

    if (!['hero_banner', 'shopping_benefits', 'just_for_you'].includes(key)) {
      continue
    }

    const element = document.getElementById(`homepage-insert-${key}`)

    if (element) {
      targets[key] = element
    }
  }

  const previous = mountedInsertionTargets.value
  const previousKeys = Object.keys(previous)
  const nextKeys = Object.keys(targets)

  const changed =
    previousKeys.length !== nextKeys.length ||
    nextKeys.some(key => previous[key] !== targets[key])

  if (changed) {
    mountedInsertionTargets.value = targets
  }
}

function isInsertedHomepageSection(sectionKey) {
  return insertedHomepageSections.value.some(
    section => section.section_key === sectionKey
  )
}

async function loadHomepageSections() {
  try {
    const response = await api.get('/store/homepage-sections')
    const sections = response.data?.data

    if (!Array.isArray(sections)) {
      throw new Error('Invalid homepage configuration')
    }

    homepageSections.value = sections
      .sort((a, b) => a.sort_order - b.sort_order)
  } catch (error) {
    console.warn(
      'Unable to load homepage configuration. Using default layout.',
      error
    )
  }
}

const banners = ref([])
const promoBanner1 = ref(null)
const promoBanner2 = ref(null)
const activeBannerIndex = ref(0)
const bannersLoading = ref(true)
const bannerPaused = ref(false)

let bannerTimer = null
let touchStartX = 0

const categoriesLoading = ref(true)
const categoryError = ref('')
const categories = ref([])
const selectedCategoryId = ref(null)
const homepageCategories = computed(() =>
    categories.value.filter(category => category.parent_id == null)
)

import {
    getMediaUrl,
    getResponsiveImageSrcSet,
} from '@/utils/mediaUrl'

// Short promises shown under the banner. Edit the text to match your store.
const BENEFITS = [
  {
    title: 'Cash on Delivery',
    text: 'Pay when your order arrives',
    icon: 'M3 7h18v10H3z M12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z M6.5 10.5h.01 M17.5 13.5h.01',
  },
  {
    title: 'Secure ordering',
    text: 'Stock checked at checkout',
    icon: 'M12 3 5 6v5c0 4.5 3 8.2 7 10 4-1.8 7-5.5 7-10V6z M9 12l2 2 4-4',
  },
  {
    title: 'Order tracking',
    text: 'Follow every order online',
    icon: 'M12 3 4 7v10l8 4 8-4V7z M4 7l8 4 8-4 M12 11v10',
  },
  {
    title: 'Return & Warranty Policy',
    text: 'Details on every product',
    icon: 'M3 8l4-4 M3 8l4 4 M3 8h12a5 5 0 0 1 0 10H9',
  },
]

const selectedBrandId = computed(() => {
  const value = route.query.brand

  if (typeof value !== 'string' || !value.trim()) {
    return null
  }

  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
})

const selectedBrand = computed(() => {
  if (selectedBrandId.value === null) return null

  const brand = availableBrands.value.find(
    item => Number(getFilterId(item)) === selectedBrandId.value
  )

  return brand?.name ?? brand?.brand_name ?? null
})

function selectCategory(category) {
  if (!category?.id) return

  selectedCategoryId.value = Number(category.id)
  activeCategory.value = category.name

  router.push({
    path: '/',
    query: {
      category: String(category.id),
    },
  })

  requestAnimationFrame(() => {
    document.getElementById('products')?.scrollIntoView({
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      block: 'start',
    })
  })
}


async function loadCategories() {
    try {
        const response = await api.get('/store/categories');
        const payload = response.data;

        const roots = Array.isArray(payload)
            ? payload
            : Array.isArray(payload?.data)
                ? payload.data
                : (payload?.categories ?? []);

        const flattened = [];

        function flattenCategories(list) {
            for (const category of list) {
                flattened.push(category);

                if (Array.isArray(category.children)) {
                    flattenCategories(category.children);
                }
            }
        }

        flattenCategories(roots);
        categories.value = flattened;
    } catch (error) {
        console.error('Failed to load categories:', error);
        categoryError.value = error.response?.data?.message || 'Unable to load categories.';
        categories.value = [];
    } finally {
        categoriesLoading.value = false
    }
}


function prefersReducedMotion() {
  return Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
}

function getBannerImageUrl(path) {
    return getMediaUrl(path)
}

function getMobileBannerSrcset(banner) {
    return getResponsiveImageSrcSet(banner.mobile_responsive_images) ||
        getBannerImageUrl(banner.mobile_image_url)
}

function bannerLinkAttrs(banner) {
    if (!banner.link_url) return {}

    const external = /^https?:\/\//i.test(banner.link_url)

    return {
        href: banner.link_url,
        target: external ? '_blank' : undefined,
        rel: external ? 'noopener noreferrer' : undefined,
    }
}

async function loadBanners() {
    bannersLoading.value = true

    try {
        const earlyBanners = window.__homepageBannersPromise
            ? await window.__homepageBannersPromise
            : null

        let allBanners = []

        if (earlyBanners !== null && Array.isArray(earlyBanners)) {
            allBanners = earlyBanners
        } else {
            const response = await api.get('/store/homepage-banners')
            allBanners = Array.isArray(response.data?.data)
                ? response.data.data
                : []
        }

        const validBanners = allBanners.filter(banner => banner?.image_url)

        banners.value = validBanners.filter(
            banner => !banner.placement || banner.placement === 'hero'
        )

        promoBanner1.value = validBanners.find(
            banner => banner.placement === 'promo_1'
        ) || null

        promoBanner2.value = validBanners.find(
            banner => banner.placement === 'promo_2'
        ) || null

        activeBannerIndex.value = 0
        startBannerRotation()
    } catch (err) {
        console.error('Failed to load homepage banners:', err)
        banners.value = []
        promoBanner1.value = null
        promoBanner2.value = null
    } finally {
        bannersLoading.value = false
        if (!banners.value.length) enableCatalog()
    }
}

function startBannerRotation() {
    stopBannerRotation()

    // No auto-rotation when paused or when the visitor prefers reduced motion.
    if (bannerPaused.value || prefersReducedMotion()) return

    if (banners.value.length > 1) {
        bannerTimer = setInterval(() => {
            activeBannerIndex.value =
                (activeBannerIndex.value + 1) % banners.value.length
        }, 5000)
    }
}

function stopBannerRotation() {
    if (bannerTimer) {
        clearInterval(bannerTimer)
        bannerTimer = null
    }
}

function showBanner(index) {
    if (!banners.value.length) return

    activeBannerIndex.value =
        (index + banners.value.length) % banners.value.length

    startBannerRotation()
}

function toggleBannerPause() {
    bannerPaused.value = !bannerPaused.value

    if (bannerPaused.value) {
        stopBannerRotation()
    } else {
        startBannerRotation()
    }
}

function onBannerTouchStart(event) {
    touchStartX = event.changedTouches[0].clientX
}

// Swipe left or right to change banner.
function onBannerTouchEnd(event) {
    const distance = event.changedTouches[0].clientX - touchStartX

    if (Math.abs(distance) > 50) {
        showBanner(activeBannerIndex.value + (distance < 0 ? 1 : -1))
    }
}

const activeBanner = computed(
    () => banners.value[activeBannerIndex.value] || null,
)

function getDescendantCategoryIds(parentCategoryId) {
    const ids = new Set([Number(parentCategoryId)]);
    let changed = true;

    while (changed) {
        changed = false;

        for (const category of categories.value) {
            if (category.parent_id == null) continue;

            const id = Number(category.id);
            const parentId = Number(category.parent_id);

            if (ids.has(parentId) && !ids.has(id)) {
                ids.add(id);
                changed = true;
            }
        }
    }

    return ids;
}


const products = ref([])
const loading = ref(true)
const error = ref('')
const activeCategory = ref('All Products')
const sortBy = ref('relevance')

// 'grid' or 'list'. Remembered in the browser between visits.
const view = ref('grid')
const VIEW_KEY = 'shop-view'

const DEFAULT_FILTERS = {
  minPrice: 0,
  maxPrice: 100000,
  minRating: 0,
  brands: [],
  warranties: [],
  colors: [],
  inStock: false,
}

// `filters` is what the sidebar edits. `appliedFilters` is what the grid uses.
const filters = ref({ ...DEFAULT_FILTERS })
const appliedFilters = ref({ ...DEFAULT_FILTERS })

const searchQuery = computed(() =>
    typeof route.query.search === 'string' ? route.query.search.trim() : '',
)

// Filter options are loaded independently of paginated products.
const availableBrands = ref([])
const availableWarranties = ref([])
const availableColors = ref([])

async function loadFilterOptions() {
  try {
    const response = await api.get('/store/products/filters')
    const data = response.data?.data ?? {}

    availableBrands.value = data.brands ?? []
    availableWarranties.value = data.warranties ?? []
    availableColors.value = data.colors ?? []
    return true
  } catch (err) {
    console.error('Unable to load product filter options:', err)
    return false
  }
}

const minAvailablePrice = computed(() => {
  const prices = products.value.map(p => Number(p.price ?? p.selling_price)).filter(Number.isFinite)
  return prices.length ? Math.floor(Math.min(...prices)) : 0
})

const maxAvailablePrice = computed(() => {
  const prices = products.value.map(p => Number(p.price ?? p.selling_price)).filter(Number.isFinite)
  return prices.length ? Math.ceil(Math.max(...prices)) : 100000
})

// Product filtering and sorting are handled by the backend.
const visibleProducts = computed(() => products.value)

const hasMore = ref(false)
const nextCursor = ref(null)
const shuffleSeed = ref(null)
const loadingMore = ref(false)

// The product rails are rendered by HomeDiscount.vue.
const isProductListing = computed(() =>
  Boolean(
    String(route.query.search || '').trim() ||
    String(route.query.category || '').trim() ||
    String(route.query.brand || '').trim() ||
    selectedCategoryId.value !== null
  )
)

// On a direct mobile landing, let the hero use the connection before starting
// the offscreen product requests. Scrolling or filtering takes precedence.
const featuredSlot = ref(null)
const catalogReady = ref(false)
const showProducts = computed(() => catalogReady.value || isProductListing.value)
let featuredObserver
let catalogTimer

function enableCatalog() {
  catalogReady.value = true
  featuredObserver?.disconnect()
  clearTimeout(catalogTimer)
}

function scrollToProducts() {
  document.getElementById('products')?.scrollIntoView({
    behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    block: 'start',
  })
}

// Copies the sidebar selections into the filters the grid uses.
function applyFilters() {
  appliedFilters.value = { ...filters.value }
}

function restoreView() {
  try {
    const saved = localStorage.getItem(VIEW_KEY)
    if (saved === 'grid' || saved === 'list') view.value = saved
  } catch {
    // Storage can be blocked. The default grid view still works.
  }
}

watch(view, (value) => {
  try {
    localStorage.setItem(VIEW_KEY, value)
  } catch {
    // Ignore storage errors.
  }
})

function getFilterId(value) {
  return value && typeof value === 'object' ? value.id : value
}

async function loadProducts(reset = true) {
  if (reset) {
    products.value = []
    nextCursor.value = null
    shuffleSeed.value = null
    hasMore.value = false
    loading.value = true
    error.value = ''
  } else {
    if (loading.value || loadingMore.value || !hasMore.value) return
    loadingMore.value = true
  }

  try {
    const applied = appliedFilters.value

    const params = {
      paginate: 1,
      limit: 20,
      sort: sortBy.value,
    }

    if (shuffleSeed.value) params.seed = shuffleSeed.value
    if (!reset && nextCursor.value) params.cursor = nextCursor.value

    if (searchQuery.value) params.search = searchQuery.value

    if (selectedCategoryId.value !== null) {
      params.categoryIds = Array.from(
        getDescendantCategoryIds(selectedCategoryId.value)
      ).join(',')
    }

    const brandIds = [
      ...(selectedBrandId.value !== null ? [selectedBrandId.value] : []),
      ...applied.brands.map(getFilterId),
    ].filter(id => id !== null && id !== undefined)

    if (brandIds.length) params.brandIds = [...new Set(brandIds)].join(',')

    const warrantyIds = applied.warranties
      .map(getFilterId)
      .filter(id => id !== null && id !== undefined)

    if (warrantyIds.length) params.warrantyIds = warrantyIds.join(',')

    const colors = applied.colors
      .map(color => typeof color === 'object' ? color.name : color)
      .filter(Boolean)

    if (colors.length) params.colors = colors.join(',')

    if (Number(applied.minPrice) > 0) {
      params.minPrice = Number(applied.minPrice)
    }

    if (Number(applied.maxPrice) < 100000) {
      params.maxPrice = Number(applied.maxPrice)
    }

    if (Number(applied.minRating) > 0) {
      params.minRating = Number(applied.minRating)
    }

    if (applied.inStock) params.inStock = 1

    const response = await api.get('/store/products', { params })
    const payload = response.data
    const list = Array.isArray(payload?.data) ? payload.data : null

    if (!list || !payload?.pagination) {
      throw new Error('Unexpected paginated product API response.')
    }

    if (reset) {
      products.value = list
    } else {
      const existingIds = new Set(
        products.value.map(product => String(product.id))
      )

      products.value.push(
        ...list.filter(product => !existingIds.has(String(product.id)))
      )
    }

    shuffleSeed.value = payload.pagination.seed
    nextCursor.value = payload.pagination.nextCursor
    hasMore.value = Boolean(payload.pagination.hasMore)
  } catch (err) {
    error.value = err.response?.data?.message ||
      err.message ||
      'Please try again later.'
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

watch(
  [showProducts, searchQuery, selectedCategoryId, selectedBrandId, sortBy, appliedFilters],
  () => {
    if (showProducts.value) loadProducts(true)
  },
  { immediate: true, deep: true }
)

let filterOptionsLoaded = false
watch(isProductListing, async listing => {
  if (listing && !filterOptionsLoaded) {
    filterOptionsLoaded = true
    filterOptionsLoaded = await loadFilterOptions()
  }
}, { immediate: true })

watch(activeCategory, value => {
  if (value === 'All Products') {
    selectedCategoryId.value = null
  }
})

watch(
  [() => route.query.category, categories],
  ([categoryId]) => {
    if (!categoryId) {
      selectedCategoryId.value = null
      activeCategory.value = 'All Products'
      return
    }

    const category = categories.value.find(
      item => String(item.id) === String(categoryId)
    )

    if (category) {
      selectedCategoryId.value = Number(category.id)
      activeCategory.value = category.name
    } else {
      selectedCategoryId.value = null
      activeCategory.value = 'All Products'
    }
  },
  { immediate: true }
)
onMounted(() => {
  setStructuredData('organization', organizationSchema())
  setStructuredData('website', websiteSchema())
  restoreView()
  loadHomepageSections()
  loadBanners()
  loadCategories()
  const mobileLanding = !isProductListing.value && window.matchMedia('(max-width: 650px)').matches
  if (mobileLanding && featuredSlot.value && 'IntersectionObserver' in window) {
    featuredObserver = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) enableCatalog()
    }, { rootMargin: '240px' })
    featuredObserver.observe(featuredSlot.value)
    // A stalled promotion must not hold up the catalog.
    catalogTimer = setTimeout(enableCatalog, 2000)
  } else {
    enableCatalog()
  }
})

onBeforeUnmount(() => {
    featuredObserver?.disconnect()
    clearTimeout(catalogTimer)
    stopBannerRotation()
    setStructuredData('organization', null)
    setStructuredData('website', null)
})
</script>

<template>
  <div class="storefront">
    <CategoryNav
      v-model:active-category="activeCategory"
      :roots="homepageCategories"
      :loading="categoriesLoading"
      :error="categoryError"
    />

    <main
      class="store-container"
      :class="{ 'landing-container': !isProductListing }"
    >
      <!-- Homepage: banner, benefits and featured product rails -->
      <template v-if="!isProductListing">
        <h1 class="sr-only">South West online store</h1>

        <Teleport
          :to="insertionTarget('hero_banner') || 'body'"
          :disabled="!isInsertedHomepageSection('hero_banner') || !insertionTarget('hero_banner')"
        >
          <section
            v-if="homepageSectionKeys.includes('hero_banner')"
            class="homepage-section"
            :style="{ order: homepageSectionOrder('hero_banner') }"
            aria-label="Promotions"
          >
          <div
            v-if="homepageSectionKeys.includes('hero_banner') && activeBanner"
            class="homepage-banner"
            role="region"
            aria-roledescription="carousel"
            aria-label="Promotions"
            @mouseenter="stopBannerRotation"
            @mouseleave="startBannerRotation"
            @focusin="stopBannerRotation"
            @focusout="startBannerRotation"
            @touchstart.passive="onBannerTouchStart"
            @touchend.passive="onBannerTouchEnd"
          >
            <Transition name="banner-fade">
              <component
                :is="activeBanner.link_url ? 'a' : 'div'"
                :key="activeBanner.id ?? activeBannerIndex"
                class="banner-link"
                v-bind="bannerLinkAttrs(activeBanner)"
              >
                <picture>
                  <source
                    v-if="activeBanner.mobile_image_url"
                    :srcset="getMobileBannerSrcset(activeBanner)"
                    sizes="(min-width: 1532px) 1440px, 94vw"
                    media="(max-width: 650px)"
                  />

                  <img
                    :src="getBannerImageUrl(activeBanner.image_url)"
                    :srcset="getResponsiveImageSrcSet(activeBanner.responsive_images) || undefined"
                    sizes="(min-width: 1532px) 1440px, 94vw"
                    :alt="activeBanner.title || 'Homepage promotion'"
                    class="banner-image"
                    fetchpriority="high"
                    @load="enableCatalog"
                    @error="enableCatalog"
                  />
                </picture>

                <div
                  v-if="
                    activeBanner.title ||
                    activeBanner.subtitle ||
                    (activeBanner.link_url && activeBanner.button_text)
                  "
                  class="banner-content"
                >
                  <h2 v-if="activeBanner.title">
                    {{ activeBanner.title }}
                  </h2>

                  <p v-if="activeBanner.subtitle">
                    {{ activeBanner.subtitle }}
                  </p>

                  <span
                    v-if="activeBanner.link_url && activeBanner.button_text"
                    class="banner-button"
                  >
                    {{ activeBanner.button_text }}

                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path
                        d="M5 12h14m-6-6 6 6-6 6"
                        stroke="currentColor"
                        stroke-width="2.2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      />
                    </svg>
                  </span>
                </div>
              </component>
            </Transition>

            <template v-if="banners.length > 1">
              <button
                class="banner-arrow banner-prev"
                type="button"
                aria-label="Previous banner"
                @click="showBanner(activeBannerIndex - 1)"
              >
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="m15 6-6 6 6 6"
                    stroke="currentColor"
                    stroke-width="2.2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </button>

              <button
                class="banner-arrow banner-next"
                type="button"
                aria-label="Next banner"
                @click="showBanner(activeBannerIndex + 1)"
              >
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="m9 6 6 6-6 6"
                    stroke="currentColor"
                    stroke-width="2.2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </button>

              <div class="banner-dots">
                <button
                  v-for="(banner, index) in banners"
                  :key="banner.id ?? index"
                  type="button"
                  class="banner-dot"
                  :class="{ active: index === activeBannerIndex }"
                  :aria-label="`Show banner ${index + 1}`"
                  :aria-current="
                    index === activeBannerIndex ? 'true' : undefined
                  "
                  @click="showBanner(index)"
                />
              </div>

              <button
                class="banner-pause"
                type="button"
                :aria-label="
                  bannerPaused ? 'Play promotions' : 'Pause promotions'
                "
                @click="toggleBannerPause"
              >
                <svg
                  v-if="!bannerPaused"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <rect x="6" y="5" width="4" height="14" rx="1" />
                  <rect x="14" y="5" width="4" height="14" rx="1" />
                </svg>

                <svg
                  v-else
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    d="M7 5.5v13a1 1 0 0 0 1.5.86l11-6.5a1 1 0 0 0 0-1.72l-11-6.5A1 1 0 0 0 7 5.5Z"
                  />
                </svg>
              </button>
            </template>
          </div>

          <div
            v-else-if="homepageSectionKeys.includes('hero_banner') && bannersLoading"
            class="banner-placeholder"
            aria-busy="true"
            aria-label="Loading promotions"
          />

          <div
            v-else-if="homepageSectionKeys.includes('hero_banner')"
            class="hero-fallback"
          >
            <p class="hero-eyebrow">SOUTH WEST</p>
            <h2>Discover our latest products</h2>
            <p>
              Browse the full range and order online with cash on delivery.
            </p>

            <button
              type="button"
              class="banner-button"
              @click="scrollToProducts"
            >
              Shop now

              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M5 12h14m-6-6 6 6-6 6"
                  stroke="currentColor"
                  stroke-width="2.2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </button>
          </div>

          </section>
        </Teleport>

        <Teleport
          :to="insertionTarget('shopping_benefits') || 'body'"
          :disabled="!isInsertedHomepageSection('shopping_benefits') || !insertionTarget('shopping_benefits')"
        >
          <section
            v-if="homepageSectionKeys.includes('shopping_benefits')"
            class="homepage-section"
            :style="{ order: homepageSectionOrder('shopping_benefits') }"
            aria-label="Shopping benefits"
          >
          <ul
            class="benefits"
            aria-label="Why shop with us"
          >
            <li
              v-for="benefit in BENEFITS"
              :key="benefit.title"
              class="benefit"
            >
              <span class="benefit-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path
                    :d="benefit.icon"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </span>

              <span class="benefit-text">
                <strong>{{ benefit.title }}</strong>
                <span>{{ benefit.text }}</span>
              </span>
            </li>
          </ul>
          </section>
        </Teleport>

        <template
          v-for="section in orderedHomepageSections.filter(item =>
            ['shop_categories', 'shop_brands'].includes(item.section_key)
          )"
          :key="section.section_key"
        >
          <div
            v-if="section.section_key === 'shop_categories' && !isInsertedHomepageSection('shop_categories')"
            :style="{ order: homepageSectionOrder('shop_categories') }"
          >
            <HomeCategory
              :categories="homepageCategories"
              :loading="categoriesLoading"
              @select-category="selectCategory"
            />
          </div>

          <div
            v-else-if="section.section_key === 'shop_brands' && !isInsertedHomepageSection('shop_brands')"
            :style="{ order: homepageSectionOrder('shop_brands') }"
          >
            <HomeBrand />
          </div>
        </template>
        <!-- Mobile catalog lazy-loading observation point. -->
        <div
          ref="featuredSlot"
          class="featured-observer-slot"
          :style="{
            order: Math.min(
              homepageSectionOrder('discount_products'),
              homepageSectionOrder('top_rated_products'),
              homepageSectionOrder('promo_banner_1'),
              homepageSectionOrder('category_product_rows'),
              homepageSectionOrder('promo_banner_2'),
              homepageSectionOrder('just_for_you')
            ) - 0.5
          }"
          aria-hidden="true"
        ></div>

        <div
          v-if="catalogReady && homepageSectionKeys.includes('discount_products') && !isInsertedHomepageSection('discount_products') && activeCategory === 'All Products'"
          :style="{ order: homepageSectionOrder('discount_products') }"
        >
          <HomeDiscount :products="products" mode="discount" />
        </div>

        <div
          v-if="catalogReady && homepageSectionKeys.includes('top_rated_products') && !isInsertedHomepageSection('top_rated_products') && activeCategory === 'All Products'"
          :style="{ order: homepageSectionOrder('top_rated_products') }"
        >
          <HomeDiscount mode="top-rated" />
        </div>

        <div
          v-if="catalogReady && homepageSectionKeys.includes('promo_banner_1') && !isInsertedHomepageSection('promo_banner_1') && promoBanner1"
          :style="{ order: homepageSectionOrder('promo_banner_1') }"
        >
          <HomePromoBanner :banner="promoBanner1" />
        </div>

        <div
          v-if="catalogReady && homepageSectionKeys.includes('promo_banner_2') && !isInsertedHomepageSection('promo_banner_2') && promoBanner2"
          :style="{ order: homepageSectionOrder('promo_banner_2') }"
        >
          <HomePromoBanner :banner="promoBanner2" />
        </div>

        <div
          v-if="catalogReady && homepageSectionKeys.includes('category_product_rows') && categories.length"
          :style="{ order: homepageSectionOrder('category_product_rows') }"
        >
          <HomeCategoryRails
            :categories="homepageCategories"
            :all-categories="categories"
            :inserted-sections="insertedHomepageSections"
            @select-category="selectCategory"
            @vue:mounted="refreshInsertionTargets"
            @vue:updated="refreshInsertionTargets"
            @vue:beforeUnmount="mountedInsertionTargets = {}"
          >
            <template #inserted-section="{ section }">
              <HomeInsertedSection
                v-if="
                  ['shop_categories', 'shop_brands'].includes(section.section_key) ||
                  (
                    catalogReady &&
                    activeCategory === 'All Products' &&
                    ['discount_products', 'top_rated_products'].includes(section.section_key)
                  ) ||
                  (
                    catalogReady &&
                    section.section_key === 'promo_banner_1' &&
                    promoBanner1
                  ) ||
                  (
                    catalogReady &&
                    section.section_key === 'promo_banner_2' &&
                    promoBanner2
                  )
                "
                :section-key="section.section_key"
                :categories="homepageCategories"
                :categories-loading="categoriesLoading"
                :products="products"
                :promo-banner1="promoBanner1"
                :promo-banner2="promoBanner2"
                @select-category="selectCategory"
              />
            </template>
          </HomeCategoryRails>
        </div>



      </template>

      <!-- Breadcrumb for search and category/product listing -->
      <nav
        v-else
        class="breadcrumb"
        aria-label="Breadcrumb"
      >
        <RouterLink to="/">Home</RouterLink>
        <span>/</span>
        <span>
          {{
            searchQuery
              ? 'Search results'
              : activeCategory === 'All Products'
                ? 'All Products'
                : activeCategory
          }}
        </span>
      </nav>

      <!-- Product listing -->
      <Teleport
        :to="insertionTarget('just_for_you') || 'body'"
        :disabled="isProductListing || !isInsertedHomepageSection('just_for_you') || !insertionTarget('just_for_you')"
      >
      <div
        v-if="isProductListing || homepageSectionKeys.includes('just_for_you')"
        id="products"
        :class="
          isProductListing ? 'shop-layout' : 'landing-products'
        "
        :style="!isProductListing
          ? { order: homepageSectionOrder('just_for_you') }
          : undefined"
      >
        <!-- Sidebar filters -->
        <aside v-if="isProductListing" class="sidebar">
          <ProductFilters
            v-model:filters="filters"
            :min-available-price="minAvailablePrice"
            :max-available-price="maxAvailablePrice"
            :brands="availableBrands"
            :warranty-options="availableWarranties"
            :colors="availableColors"
            @apply="applyFilters"
            @reset="applyFilters"
          />
        </aside>

        <section class="shop-main">
          <div class="shop-heading">
            <div>
            <h1 v-if="searchQuery">
  Results for "{{ searchQuery }}"
</h1>

<h2 v-else>
  {{
    selectedBrand
      ? `${selectedBrand} Products`
      : activeCategory === 'All Products'
        ? 'Just For You'
        : activeCategory
  }}
</h2>
            </div>

<div v-if="isProductListing" class="heading-tools">
  <div
    class="view-toggle"
    role="group"
    aria-label="Product view"
  >
    <button
      type="button"
      class="view-button"
      :class="{ active: view === 'grid' }"
      :aria-pressed="view === 'grid'"
      aria-label="Grid view"
      @click="view = 'grid'"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="3" width="8" height="8" rx="1" fill="currentColor" />
        <rect x="13" y="3" width="8" height="8" rx="1" fill="currentColor" />
        <rect x="3" y="13" width="8" height="8" rx="1" fill="currentColor" />
        <rect x="13" y="13" width="8" height="8" rx="1" fill="currentColor" />
      </svg>
    </button>

    <button
      type="button"
      class="view-button"
      :class="{ active: view === 'list' }"
      :aria-pressed="view === 'list'"
      aria-label="List view"
      @click="view = 'list'"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="4" width="18" height="3" rx="1" fill="currentColor" />
        <rect x="3" y="10.5" width="18" height="3" rx="1" fill="currentColor" />
        <rect x="3" y="17" width="18" height="3" rx="1" fill="currentColor" />
      </svg>
    </button>
  </div>

  <ProductSort v-model:sort-by="sortBy" />
</div>

          </div>

          <ProductGrid
            :products="visibleProducts"
            :loading="loading"
            :error="error"
            :view="view"
          />

          <div v-if="hasMore && !loading" class="load-more-container">
            <button
              class="load-more-button"
              type="button"
              :disabled="loadingMore"
              @click="loadProducts(false)"
            >
              {{ loadingMore ? 'Loading...' : 'Load More' }}
            </button>
          </div>

          <button
            v-if="error"
            class="retry-button"
            type="button"
            @click="loadProducts(products.length === 0)"
          >
            Try again
          </button>
        </section>
      </div>
      </Teleport>
      <aside v-if="!isProductListing && themeSlug === 'christmas' && greetingOrder != null"
        class="floral-greeting christmas-greeting" :style="{ order: greetingOrder }" aria-labelledby="christmas-greeting-title">
        <img src="/themes/christmas/decorations/christmas-greeting.webp" alt="" loading="lazy" decoding="async" />
        <div>
          <h2 id="christmas-greeting-title">Merry Christmas</h2>
          <p>Wishing you and your loved ones a joyful and wonderful Christmas.</p>
        </div>
      </aside>

      <aside v-if="!isProductListing && themeSlug === 'ramadan' && greetingOrder != null"
        class="ramadan-greeting" :style="{ order: greetingOrder }" aria-labelledby="ramadan-greeting-title">
        <img src="/themes/ramadan/decorations/ramadan-greeting.webp" alt="" loading="lazy"
          decoding="async" width="1200" height="400" />
        <div>
          <h2 id="ramadan-greeting-title">Ramadan Kareem</h2>
          <p>Wishing you a peaceful and blessed Ramadan.</p>
        </div>
      </aside>
      <div v-if="!isProductListing && themeSlug === 'sinhala-tamil-new-year' && greetingOrder != null"
        class="avurudu-divider" :style="{ order: greetingOrder }" aria-hidden="true">
        <img src="/themes/sinhala-tamil-new-year/avurudu-rabana.webp" alt="" loading="lazy" />
        <img src="/themes/sinhala-tamil-new-year/avurudu-kolam.webp" alt="" loading="lazy" />
        <img src="/themes/sinhala-tamil-new-year/avurudu-sweets.webp" alt="" loading="lazy" />
      </div>
      <aside v-if="!isProductListing && floralArtwork && greetingOrder != null" class="floral-greeting"
        :style="{ order: greetingOrder }" aria-labelledby="floral-greeting-title">
        <img :src="floralArtwork + 'greeting.webp'" alt="" loading="lazy" />
        <div v-if="themeSlug === 'sinhala-tamil-new-year'" lang="si">
          <h2 id="floral-greeting-title">සුබ සිංහල හා දෙමළ අලුත් අවුරුද්දක් වේවා!</h2>
          <p>ඔබ සැමට සාමය, සතුට හා සෞභාග්‍යය පිරි සුබ අලුත් අවුරුද්දක් වේවා!</p>
        </div>
        <h2 v-else id="floral-greeting-title">Happy Valentine’s Day</h2>
      </aside>
      <aside v-if="!isProductListing && themeSlug === 'eid' && greetingOrder != null"
        class="eid-greeting" :style="{ order: greetingOrder }" aria-labelledby="eid-greeting-title">
        <img src="/themes/eid/decorations/eid-greeting.webp" alt="" loading="lazy" decoding="async" />
        <div>
          <h2 id="eid-greeting-title">Eid Mubarak</h2>
          <p>Wishing you and your loved ones a joyful and blessed Eid.</p>
        </div>
      </aside>
    </main>
  </div>
</template>

<style scoped>
.storefront {
  min-height: 100vh;
  background: var(--color-store-bg);
}

.store-container {
  width: min(var(--container-store), 94%);
  margin: 0 auto;
  padding: var(--space-6) 0 var(--space-16);
}

/* Small invisible target for mobile catalog lazy loading. */
.featured-observer-slot {
  height: 1px;
  flex: 0 0 1px;
  pointer-events: none;
}

/* Arrange homepage sections using their Admin Panel order. */
.landing-container {
  display: flex;
  flex-direction: column;
  padding-top: var(--space-5);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}

.breadcrumb {
  display: flex;
  gap: var(--space-2);
  margin-bottom: var(--space-6);
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
}

.breadcrumb a {
  color: inherit;
  text-decoration: none;
}

.breadcrumb a:hover {
  color: var(--color-primary);
}

/* ---------- Hero banner ---------- */
.homepage-section {
  width: 100%;
}

.homepage-banner {
  position: relative;
  width: 100%;
  overflow: hidden;
  isolation: isolate;
  border-radius: calc(var(--radius-md) * 1.5);
  background: var(--color-black);
  box-shadow: var(--shadow-md);

}

.homepage-banner,
.banner-placeholder,
.hero-fallback {
  aspect-ratio: 3 / 1;
}

/* Slides sit on top of each other so they cross-fade */
.banner-link {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  color: inherit;
  text-decoration: none;
}

.banner-fade-enter-active,
.banner-fade-leave-active {
  transition: opacity 0.6s ease;
}

.banner-fade-enter-from,
.banner-fade-leave-to {
  opacity: 0;
}

.banner-image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.banner-content {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 14px;
  padding: clamp(24px, 6vw, 80px);
  color: #fff;
  background: linear-gradient(
      90deg,
      rgb(0 0 0 / 60%),
      rgb(0 0 0 / 20%) 65%,
      transparent
  );
  pointer-events: none;
}

.banner-content h2 {
  max-width: 650px;
  margin: 0;
  font-family: var(--font-family-display);
  font-size: clamp(26px, 4vw, 50px);
  font-weight: 800;
  letter-spacing: -0.01em;
  line-height: 1.1;
}

.banner-content p {
  max-width: 540px;
  margin: 0;
  font-size: clamp(14px, 1.6vw, 19px);
  line-height: 1.5;
  opacity: 0.92;
}

.banner-button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 46px;
  margin-top: 6px;
  padding: 0 24px;
  border: 0;
  border-radius: var(--radius-pill);
  background: var(--color-accent);
  color: var(--color-black);
  cursor: pointer;
  font: inherit;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-bold);
  transition: transform var(--transition-fast), box-shadow var(--transition-fast);
}

.banner-button svg {
  width: 18px;
  height: 18px;
  transition: transform var(--transition-fast);
}

.load-more-container {
  display: flex;
  justify-content: center;
  padding: 28px 0 40px;
}

.load-more-button {
  min-width: 160px;
  padding: 12px 28px;
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 8px;
  background: transparent;
  color: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.load-more-button:hover:not(:disabled) {
  background: var(--color-primary, #263b63);
  color: white;
}

.load-more-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
  

@media (hover: hover) {
  .banner-link:hover .banner-button,
  .hero-fallback .banner-button:hover {
    box-shadow: 0 6px 18px rgb(0 0 0 / 30%);
    transform: translateY(-1px);
  }

  .banner-link:hover .banner-button svg,
  .hero-fallback .banner-button:hover svg {
    transform: translateX(3px);
  }
}

.banner-button:focus-visible {
  outline: 2px solid var(--color-focus-outline);
  outline-offset: 3px;
}

/* Glass controls */
.banner-arrow,
.banner-pause {
  position: absolute;
  z-index: 2;
  display: grid;
  place-items: center;
  padding: 0;
  border: 1px solid rgb(255 255 255 / 30%);
  border-radius: 50%;
  background: rgb(255 255 255 / 16%);
  color: #fff;
  cursor: pointer;
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
  transition: background var(--transition-fast), opacity var(--transition-fast);
}

.banner-arrow:hover,
.banner-pause:hover {
  background: rgb(255 255 255 / 30%);
}

.banner-arrow:focus-visible,
.banner-pause:focus-visible,
.banner-dot:focus-visible {
  outline: 2px solid #fff;
  outline-offset: 2px;
}

.banner-arrow {
  top: 50%;
  width: 44px;
  height: 44px;
  transform: translateY(-50%);
}

.banner-arrow svg {
  width: 20px;
  height: 20px;
}

.banner-prev {
  left: 18px;
}

.banner-next {
  right: 18px;
}

/* Arrows appear on hover or keyboard focus where hover exists, and are hidden on touch (swipe instead) */
@media (hover: hover) {
  .banner-arrow {
    opacity: 0;
  }

  .homepage-banner:hover .banner-arrow,
  .homepage-banner:focus-within .banner-arrow {
    opacity: 1;
  }
}

@media (pointer: coarse) {
  .banner-arrow {
    display: none;
  }
}

.banner-pause {
  right: 18px;
  bottom: 14px;
  width: 44px;
  height: 44px;
}

.banner-pause svg {
  width: 14px;
  height: 14px;
}

.banner-dots {
  position: absolute;
  z-index: 2;
  bottom: 10px;
  left: 50%;
  display: flex;
  max-width: calc(100% - 120px);
  overflow-x: auto;
  transform: translateX(-50%);
}

.banner-dot {
  display: grid;
  flex: 0 0 32px;
  place-items: center;
  height: 44px;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}

.banner-dot::after {
  width: 8px;
  height: 8px;
  border-radius: 99px;
  background: rgb(255 255 255 / 75%);
  content: '';
}

.banner-dot.active::after {
  width: 22px;
  background: #fff;
}

.banner-dot:focus-visible {
  outline-offset: -3px;
}

.banner-placeholder {
  width: 100%;

  border-radius: calc(var(--radius-md) * 1.5);
  background: var(--color-surface-muted);
  animation: pulse 1.4s ease-in-out infinite;
}

/* Brand hero used when there are no banners */
.hero-fallback {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 12px;
  box-sizing: border-box;
  padding: clamp(24px, 6vw, 72px);
  border-radius: calc(var(--radius-md) * 1.5);
  background: var(--gradient-metal);
  box-shadow: var(--shadow-md);
  color: var(--color-on-primary);
}

.hero-eyebrow {
  margin: 0;
  color: var(--color-accent);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
  letter-spacing: 0.14em;
}

.hero-fallback h2 {
  max-width: 640px;
  margin: 0;
  font-family: var(--font-family-display);
  font-size: clamp(26px, 4vw, 46px);
  font-weight: 800;
  line-height: 1.1;
}

.hero-fallback p:not(.hero-eyebrow) {
  max-width: 520px;
  margin: 0;
  font-size: clamp(14px, 1.6vw, 18px);
  opacity: 0.85;
}

/* ---------- Benefits strip ---------- */
.benefits {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin: var(--space-5) 0 0;
  padding: 0;
  list-style: none;
  border: 1px solid var(--color-border-soft);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow: var(--shadow-sm);
}

.benefit {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
  padding: var(--space-4) var(--space-5);
}

.benefit + .benefit {
  border-left: 1px solid var(--color-border-soft);
}

.benefit-icon {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  flex-shrink: 0;
  border-radius: 50%;
  background: color-mix(in srgb, var(--color-primary) 10%, var(--color-surface));
  color: var(--color-primary);
}

.benefit-icon svg {
  width: 20px;
  height: 20px;
}

.benefit-text {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.benefit-text strong {
  color: var(--color-text);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
}

.benefit-text span {
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  line-height: 1.4;
}

/* ---------- Product listing ---------- */
.landing-products {
  margin-top: var(--space-10);
}

.shop-layout {
  display: grid;
  grid-template-columns: 225px minmax(0, 1fr);
  gap: var(--space-8);
  align-items: start;
}

/* Plain column: no border, background, or padding box */
.sidebar {
  min-width: 0;
}

.shop-main {
  min-width: 0;
}

.shop-heading {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  margin-bottom: var(--space-6);
  padding-bottom: var(--space-4);
  border-bottom: 1px solid var(--color-border-soft);
}

/* Short accent line on the divider */
.shop-heading::after {
  position: absolute;
  bottom: -1px;
  left: 0;
  width: 56px;
  height: 2px;
  background: var(--color-accent);
  content: '';
}

.shop-heading h1,
.shop-heading h2 {
  margin: 0 0 var(--space-1);
  color: var(--color-text);
  font-family: var(--font-family-display);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  letter-spacing: var(--letter-spacing-heading);
}

.shop-heading p {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
}

/* View buttons sit directly before the sort dropdown */
.heading-tools {
  display: flex;
  align-items: center;
  gap: var(--space-5);
  flex-shrink: 0;
}

.view-toggle {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.view-button {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: var(--border-width-field) solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-border);
  cursor: pointer;
  transition: color var(--transition-fast), border-color var(--transition-fast);
}

.view-button svg {
  width: 18px;
  height: 18px;
}

.view-button.active {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.view-button:not(.active):hover {
  border-color: var(--color-text-muted);
  color: var(--color-text-muted);
}

.view-button:focus-visible {
  outline: 2px solid var(--color-focus-outline);
  outline-offset: 2px;
}

.retry-button {
  display: block;
  margin: var(--space-4) auto;
  height: var(--control-height);
  padding: 0 var(--space-6);
  border: 0;
  border-radius: var(--radius-md);
  background: var(--color-primary);
  color: var(--color-on-primary);
  font: inherit;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
}

.retry-button:hover {
  background: var(--color-primary-hover);
}

.retry-button:focus-visible {
  outline: 2px solid var(--color-focus-outline);
  outline-offset: 2px;
}

@media (max-width: 960px) {
  .benefits {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .benefit:nth-child(odd) {
    border-left: 0;
  }

  .benefit:nth-child(n + 3) {
    border-top: 1px solid var(--color-border-soft);
  }
}

@media (max-width: 900px) {
  .shop-layout {
    grid-template-columns: 190px minmax(0, 1fr);
    gap: var(--space-5);
  }
}

/* ---------- Phones ---------- */
@media (max-width: 650px) {
  .homepage-banner,
  .banner-placeholder,
  .hero-fallback {
    aspect-ratio: 4 / 3;
  }

  .banner-content {
    justify-content: flex-end;
    padding: 24px 20px 52px;
    background: linear-gradient(
        0deg,
        rgb(0 0 0 / 70%),
        transparent 85%
    );
  }

  .banner-dots {
    bottom: 10px;
  }

  .banner-pause {
    right: 12px;
    bottom: 10px;
  }

  .shop-layout {
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-5);
  }

  .shop-heading {
    flex-direction: column;
    align-items: flex-start;
  }

  .heading-tools {
    width: 100%;
    justify-content: space-between;
  }

  .shop-heading h1,
  .shop-heading h2 {
    font-size: var(--font-size-md);
  }
}

@media (max-width: 520px) {
  /* Two compact columns, icon above the text */
  .benefit {
    flex-direction: column;
    align-items: flex-start;
    padding: var(--space-3) var(--space-4);
  }
}

/* ---------- Fold cover screens ---------- */
@media (max-width: 340px) {
  .benefits {
    grid-template-columns: minmax(0, 1fr);
  }

  .benefit {
    flex-direction: row;
    align-items: center;
    border-left: 0;
  }

  .benefit + .benefit {
    border-top: 1px solid var(--color-border-soft);
  }

}

@media (prefers-reduced-motion: reduce) {
  .banner-fade-enter-active,
  .banner-fade-leave-active,
  .banner-dot,
  .banner-button,
  .banner-button svg {
    transition: none;
  }

  .banner-placeholder {
    animation: none;
  }
}
</style>
