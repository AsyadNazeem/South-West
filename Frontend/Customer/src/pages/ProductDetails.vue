<script setup>
import {
  getResponsiveImageSrcSet,
  getResponsiveImageUrl,
} from '@/utils/mediaUrl'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '@/services/api'
import DOMPurify from 'dompurify'
import { formatMeasure, formatAttributeLabel } from '@/utils/measure.js'
import VariantSelector from '@/components/VariantSelector.vue'
import SimilarProducts from '@/components/products/SimilarProducts.vue'

const route = useRoute()
const router = useRouter()

const product = ref(null)
const loading = ref(true)
const error = ref('')
const selectedImage = ref(0)
const selectedVariantId = ref('')
const selectedLength = ref('')
const selectedColor = ref('')
const selectedVariantGroupKey = ref('')
const quantity = ref(1)
const addingToCart = ref(false)
const cartMessage = ref('')
const cartError = ref('')

// Wishlist
const wishlisted = ref(false)
const wishlistBusy = ref(false)
const wishlistMessage = ref('')

const reviews = ref([])
const reviewsLoading = ref(false)
const reviewsError = ref('')
const averageReviewRating = ref(null)
const approvedReviewCount = ref(0)

const reviewRating = ref(5)
const reviewTitle = ref('')
const reviewText = ref('')
const displayReviewName = ref(false)
const submittingReview = ref(false)
const reviewMessage = ref('')
const reviewSubmitError = ref('')
const reviewSubmitted = ref(false)


// ---------- Review UI helpers ----------
const hoverRating = ref(0)
const reviewSort = ref('newest')

const isGuestReviewer = ref(!sessionStorage.getItem('customerToken'))

function refreshReviewAuthState() {
  isGuestReviewer.value = !sessionStorage.getItem('customerToken')
}

onMounted(() => {
  window.addEventListener('customer-auth-changed', refreshReviewAuthState)
})

onUnmounted(() => {
  window.removeEventListener('customer-auth-changed', refreshReviewAuthState)
})

const ratingLabels = {
  1: 'Poor',
  2: 'Fair',
  3: 'Good',
  4: 'Very good',
  5: 'Excellent'
}

// Bars: how many loaded reviews per star
const ratingBreakdown = computed(() => {
  const total = reviews.value.length

  return [5, 4, 3, 2, 1].map(star => {
    const count = reviews.value.filter(
      review => Number(review.rating) === star
    ).length

    return {
      star,
      count,
      percent: total ? Math.round((count / total) * 100) : 0
    }
  })
})

const sortedReviews = computed(() => {
  const list = [...reviews.value]

  if (reviewSort.value === 'highest') {
    return list.sort((a, b) => Number(b.rating) - Number(a.rating))
  }

  if (reviewSort.value === 'lowest') {
    return list.sort((a, b) => Number(a.rating) - Number(b.rating))
  }

  return list.sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  )
})

function reviewerName(review) {
  return review.reviewer_name || 'Customer'
}

function reviewerInitials(review) {
  return reviewerName(review)
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0].toUpperCase())
    .join('')
}

function scrollToReviewForm() {
  document
    .getElementById('write-review')
    ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}



// --------------------------------------------------
// Product and variant data
// --------------------------------------------------

const productName = computed(() =>
  product.value?.item_name ||
  product.value?.name ||
  product.value?.product_name ||
  'Product'
)

const variants = computed(() => {
  const list = product.value?.variants
  if (!Array.isArray(list)) return []

  return list.filter(variant => variant.is_active !== false)
})

const selectedVariant = computed(() =>
  variants.value.find(
    variant => String(variant.id) === String(selectedVariantId.value)
  ) || null
)


async function loadProductReviews() {
  const itemId = product.value?.id

  if (!itemId) return

  reviewsLoading.value = true
  reviewsError.value = ''

  try {
    const response = await api.get(
      `/customer-reviews/products/${itemId}`
    )

    const result = response.data?.data ?? response.data

    reviews.value = Array.isArray(result?.reviews)
      ? result.reviews
      : []

    averageReviewRating.value =
      Number(result?.averageRating) > 0
        ? Number(result.averageRating)
        : null

    approvedReviewCount.value =
      Number(result?.reviewCount) || 0
  } catch (err) {
    console.error('Load product reviews error:', err)
    reviewsError.value =
      err.response?.data?.message || 'Unable to load customer reviews.'
  } finally {
    reviewsLoading.value = false
  }
}

async function loadWishlistStatus() {
  wishlisted.value = false

  // Guests cannot have a customer-specific wishlist.
  if (!sessionStorage.getItem('customerToken') || !product.value?.id) {
    return
  }

  try {
    const response = await api.get('/customer-wishlist')
    const result = response.data?.data ?? response.data
    const wishlist = Array.isArray(result) ? result : []

    wishlisted.value = wishlist.some(entry =>
      String(entry.item_id ?? entry.item?.id) === String(product.value.id)
    )
  } catch (err) {
    console.error('Load wishlist status error:', err)
  }
}

async function toggleWishlist() {
  if (wishlistBusy.value || !product.value?.id) return

  // Use the same customer login flow as Add to Cart.
  if (!sessionStorage.getItem('customerToken')) {
    router.push({
      path: '/login',
      query: { redirect: route.fullPath }
    })
    return
  }

  wishlistBusy.value = true
  wishlistMessage.value = ''

  const wasWishlisted = wishlisted.value

  try {
    if (wasWishlisted) {
      await api.delete(
        `/customer-wishlist/items/${encodeURIComponent(product.value.id)}`
      )

      wishlisted.value = false
      wishlistMessage.value = 'Removed from your wishlist.'
    } else {
      await api.post('/customer-wishlist/items', {
        item_id: product.value.id
      })

      wishlisted.value = true
      wishlistMessage.value = 'Added to your wishlist.'
    }
  } catch (err) {
    // Handle an item that was already saved on the server.
    if (
      !wasWishlisted &&
      err.response?.status === 409
    ) {
      wishlisted.value = true
      wishlistMessage.value = 'This product is already in your wishlist.'
    } else {
      wishlistMessage.value =
        err.response?.data?.message ||
        'Unable to update your wishlist. Please try again.'
    }
  } finally {
    wishlistBusy.value = false
  }
}

async function submitProductReview() {
  reviewMessage.value = ''
  reviewSubmitError.value = ''

  const customerToken = sessionStorage.getItem('customerToken')

  if (!product.value?.id) {
    reviewSubmitError.value = 'Unable to identify this product.'
    return
  }

  if (!Number.isInteger(Number(reviewRating.value)) ||
      Number(reviewRating.value) < 1 ||
      Number(reviewRating.value) > 5) {
    reviewSubmitError.value = 'Please select a rating from 1 to 5.'
    return
  }

  if (!reviewTitle.value.trim() && !reviewText.value.trim()) {
    reviewSubmitError.value = 'Enter a review title or review text.'
    return
  }

  submittingReview.value = true

  try {
    const payload = {
      item_id: product.value.id,
      rating: Number(reviewRating.value),
      review_title: reviewTitle.value.trim(),
      review_text: reviewText.value.trim()
    }

    if (customerToken) {
      payload.display_name = displayReviewName.value
    }

    const response = await api.post('/customer-reviews', payload)

    reviewMessage.value =
      response.data?.message ||
      'Your review was submitted for approval.'

    reviewSubmitted.value = true
    reviewTitle.value = ''
    reviewText.value = ''
    displayReviewName.value = false
  } catch (err) {
    reviewSubmitError.value =
      err.response?.data?.message ||
      'Unable to submit your review. Please try again.'
  } finally {
    submittingReview.value = false
  }
}

function formatReviewDate(value) {
  if (!value) return ''

  const date = new Date(value)

  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString('en-LK', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      })
}



function getVariantLength(variant) {
  const attributes = variant?.attributes || {}

  const key = Object.keys(attributes).find(
    key => /length/i.test(key)
  )

  const value = key ? attributes[key] : null

  if (value == null || String(value).trim() === '') return ''

  const length = String(value).trim()
  return length.toLowerCase() === 'default' ? '' : length
}

function getVariantColour(variant) {
  const value =
    variant?.color?.color_name ||
    variant?.color?.name ||
    variant?.attributes?.color ||
    ''

  const colour = String(value).trim()
  return colour.toLowerCase() === 'default' ? '' : colour
}

function getVariantColourHex(variant) {
  const hex =
    variant?.color?.hex_code ||
    variant?.color?.hex ||
    ''

  if (!hex) return ''

  const normalized = String(hex).startsWith('#')
    ? String(hex)
    : `#${hex}`

  return /^#[0-9a-f]{3,8}$/i.test(normalized) ? normalized : ''
}

function isVariantInStock(variant) {
  return (
    variant.in_stock !== false &&
    Number(variant.available_quantity) > 0
  )
}

// Each active variant is a selectable product option.
// Display the actual name and attributes saved in the database.
function getColorEntries(variant) {
  const rawColors = Array.isArray(variant?.colors)
    ? variant.colors
    : []

  const entries = rawColors
    .map(color => ({
      name: String(
        typeof color === 'string'
          ? color
          : color?.color_name || color?.name || ''
      ).trim(),
      hex: typeof color === 'object'
        ? color.hex_code || color.hex || ''
        : ''
    }))
    .filter(entry =>
      entry.name &&
      entry.name.toLowerCase() !== 'default'
    )

  const colorAttribute = Object.entries(variant?.attributes || {})
    .find(([key]) => /colou?r/i.test(key))

  // A comma-separated Color attribute represents one combined colour.
  if (
    colorAttribute &&
    typeof colorAttribute[1] === 'string' &&
    colorAttribute[1].includes(',')
  ) {
    const names = colorAttribute[1]
      .split(',')
      .map(name => name.trim())
      .filter(Boolean)

    if (names.length > 1) {
      return [{
        name: names.join(' + '),
        hex: ''
      }]
    }
  }

  if (entries.length) return entries

  const name = typeof variant?.color === 'string'
    ? variant.color
    : variant?.color?.color_name ||
      variant?.color?.name ||
      colorAttribute?.[1] ||
      ''

  return String(name)
    .split(',')
    .map(value => value.trim())
    .filter(value =>
      value && value.toLowerCase() !== 'default'
    )
    .map(value => ({
      name: value,
      hex: typeof variant?.color === 'object'
        ? variant.color.hex_code || variant.color.hex || ''
        : ''
    }))
}

function getColorHex(name, suppliedHex = '') {
  if (suppliedHex) {
    const hex = String(suppliedHex).startsWith('#')
      ? String(suppliedHex)
      : `#${suppliedHex}`

    if (/^#[0-9a-f]{3,8}$/i.test(hex)) return hex
  }

  const colors = {
    black: '#171717',
    white: '#ffffff',
    red: '#e53935',
    blue: '#2563eb',
    green: '#16a34a',
    yellow: '#facc15',
    orange: '#f97316',
    purple: '#9333ea',
    pink: '#ec4899',
    grey: '#9ca3af',
    gray: '#9ca3af',
    silver: '#c0c0c0',
    gold: '#d4af37',
    brown: '#854d0e'
  }

  return colors[String(name || '').trim().toLowerCase()] || '#e5e7eb'
}

const colorOptions = computed(() => {
  const unique = new Map()

  for (const variant of variants.value) {
    for (const color of getColorEntries(variant)) {
      const key = color.name.toLowerCase()
      if (!unique.has(key)) {
        unique.set(key, {
          name: color.name,
          hex: getColorHex(color.name, color.hex)
        })
      }
    }
  }

  return [...unique.values()]
})

const variantOptions = computed(() =>
  variants.value.map(variant => {
    const attributes =
      variant.attributes &&
      typeof variant.attributes === 'object' &&
      !Array.isArray(variant.attributes)
        ? Object.entries(variant.attributes).filter(
            ([key, value]) =>
              String(key).trim() &&
              !/colou?r/i.test(key) &&
              value != null &&
              String(value).trim() &&
              String(value).trim().toLowerCase() !== 'default'
          )
        : []

    const colors = getColorEntries(variant).map(color => color.name)

    return {
      id: String(variant.id),
      name: variant.variant_name || 'Unnamed variant',
      attributes,
      colors,
      sku: variant.variant_sku || '',
      inStock: isVariantInStock(variant)
    }
  })
)

const variantsForSelectedColor = computed(() => {
  if (!colorOptions.value.length) return variantOptions.value

  return variantOptions.value.filter(option =>
    option.colors.some(
      color => color.toLowerCase() === selectedColor.value.toLowerCase()
    )
  )
})

// Group real SKUs by their non-colour attributes so the customer
// chooses the specification/length first and the colour second.

const hasMultipleLengths = computed(() => {
  const lengths = new Set(
    variants.value
      .map(getVariantLength)
      .filter(Boolean)
      .map(length => length.toLowerCase())
  )

  return lengths.size > 1
})

const hasMultipleConfigurations = computed(() => {
  if (hasMultipleLengths.value) return true

  const signatures = new Set(
    variants.value.map(variant => {
      const attributes =
        variant.attributes &&
        typeof variant.attributes === 'object' &&
        !Array.isArray(variant.attributes)
          ? Object.entries(variant.attributes)
              .filter(([key, value]) =>
                String(key).trim() &&
                !/colou?r/i.test(key) &&
                value != null &&
                String(value).trim() &&
                String(value).trim().toLowerCase() !== 'default'
              )
              .sort(([a], [b]) => a.localeCompare(b))
          : []

      return JSON.stringify({
        name: String(variant.variant_name || '').trim().toLowerCase(),
        attributes
      })
    })
  )

  return signatures.size > 1
})

// Group variants by length only. If there is zero or one distinct length,
// all colour variants belong to one group and no length cards are displayed.
const variantChoices = computed(() => {
  const options = variantOptions.value
  if (!options.length) return []

  // Compare attribute values consistently, ignoring colour and descriptive
  // metadata that should not create separate customer selections.
  const ignoredKeys = new Set([
    'color',
    'colors',
    'model',
    'condition',
    'compatibility',
    'sku',
    'variant sku',
    'variant name'
  ])

  const normalise = value =>
    String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase()

  const getAttributes = option => {
    const variant = variants.value.find(
      item => String(item.id) === String(option.id)
    )

    const attributes = variant?.attributes ?? option.attributes ?? {}

    if (Array.isArray(attributes)) {
      return Object.fromEntries(
        attributes
          .filter(entry => entry && entry.name)
          .map(entry => [entry.name, entry.value])
      )
    }

    return attributes && typeof attributes === 'object'
      ? attributes
      : {}
  }

  const attributeEntries = options.map(option => {
    const attributes = getAttributes(option)

    return {
      option,
      attributes: Object.entries(attributes).filter(([key, value]) =>
        !ignoredKeys.has(normalise(key)) &&
        value !== null &&
        value !== undefined &&
        String(value).trim() !== ''
      )
    }
  })

  // Only attributes that genuinely vary between variants become selectors.
  const allKeys = [
    ...new Set(
      attributeEntries.flatMap(entry =>
        entry.attributes.map(([key]) => key)
      )
    )
  ]

  const varyingKeys = allKeys.filter(key => {
    const values = new Set(
      attributeEntries.map(entry => {
        const pair = entry.attributes.find(
          ([attributeName]) => normalise(attributeName) === normalise(key)
        )
        return normalise(pair?.[1])
      })
    )

    return values.size > 1
  })

  // If no meaningful attribute differs, use variant names only when those
  // names actually differ. Otherwise the variants are colour choices only.
  const useVariantName =
    varyingKeys.length === 0 &&
    new Set(options.map(option => normalise(option.name))).size > 1

  const groups = new Map()

  for (const entry of attributeEntries) {
    const { option, attributes } = entry

    const selectedAttributes = varyingKeys.map(key => {
      const pair = attributes.find(
        ([attributeName]) => normalise(attributeName) === normalise(key)
      )

      return [key, pair?.[1] ?? '']
    })

    const key = varyingKeys.length
      ? JSON.stringify(selectedAttributes.map(([name, value]) => [
          normalise(name),
          normalise(value)
        ]))
      : useVariantName
        ? `name:${normalise(option.name)}`
        : 'all-colours'

    if (!groups.has(key)) {
      const specs = selectedAttributes.map(([attributeName, value]) => ({
        label: formatAttributeLabel(attributeName),
        value: formatMeasure(attributeName, value)
      }))

      let name = 'Available colours'

      if (specs.length) {
        name = specs.map(spec => spec.value).filter(Boolean).join(' · ') || option.name
      } else if (useVariantName) {
        name = option.name
      }

      groups.set(key, { key, name, specs, options: [] })
    }

    groups.get(key).options.push(option)
  }

  return [...groups.values()].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true })
  )
})

const variantSelectorLabel = computed(() => {
  const labels = variantChoices.value[0]?.specs.map(spec => spec.label) || []

  if (labels.length === 1) return `Choose ${labels[0].toLowerCase()}`

  return labels.length > 1 ? 'Choose configuration' : 'Choose variant'
})

const selectedVariantSpecs = computed(() => {
  const attributes = selectedVariant.value?.attributes

  if (!attributes || typeof attributes !== 'object' || Array.isArray(attributes)) return []

  return Object.entries(attributes)
    .filter(([key, value]) =>
      String(key).trim() &&
      !/colou?r/i.test(key) &&
      value != null &&
      String(value).trim() &&
      String(value).trim().toLowerCase() !== 'default'
    )
    .map(([key, value]) => ({
      label: formatAttributeLabel(key),
      value: formatMeasure(key, value)
    }))
})


const selectedVariantChoice = computed(() =>
  variantChoices.value.find(
    choice => choice.key === selectedVariantGroupKey.value
  ) ||
  variantChoices.value.find(choice =>
    choice.options.some(option =>
      String(option.id) === String(selectedVariantId.value)
    )
  ) ||
  variantChoices.value[0] ||
  null
)

const colorsForSelectedVariant = computed(() => {
  const choice = selectedVariantChoice.value
  if (!choice) return colorOptions.value.map(color => ({
    ...color,
    available: false
  }))

  return colorOptions.value.map(color => {
    const matching = choice.options.filter(option =>
      option.colors.some(
        name => name.toLowerCase() === color.name.toLowerCase()
      )
    )

    return {
      ...color,
      available: matching.some(option => option.inStock),
      exists: matching.length > 0
    }
  })
})

function selectVariantChoice(key) {
  const choice = variantChoices.value.find(group => group.key === key)
  if (!choice) return

  selectedVariantGroupKey.value = choice.key

  const matchingColor = choice.options.find(option =>
    option.colors.some(
      color => color.toLowerCase() === selectedColor.value.toLowerCase()
    ) && option.inStock
  )

  const chosen =
    matchingColor ||
    choice.options.find(option => option.inStock) ||
    choice.options[0]

  if (chosen) {
    selectedVariantId.value = chosen.id
    const chosenColor = chosen.colors.find(
      color => color.toLowerCase() === selectedColor.value.toLowerCase()
    )
    if (!chosenColor && chosen.colors.length) {
      selectedColor.value = chosen.colors[0]
    }
  }

  quantity.value = 1
  cartMessage.value = ''
  cartError.value = ''
}

function selectAvailableColor(color) {
  const choice = selectedVariantChoice.value
  if (!choice) return

  const matching = choice.options.filter(option =>
    option.colors.some(
      name => name.toLowerCase() === color.name.toLowerCase()
    )
  )

  const chosen = matching.find(option => option.inStock)
  if (!chosen) return

  selectedColor.value = color.name
  selectedVariantId.value = chosen.id
  quantity.value = 1
  cartMessage.value = ''
  cartError.value = ''
}

function getColorSwatchStyle(color) {
  const parts = color.name
    .split(/\s*\+\s*/)
    .map(name => name.trim())
    .filter(Boolean)

  if (parts.length === 2) {
    return {
      background: `linear-gradient(135deg, ${getColorHex(parts[0])} 0%, ${getColorHex(parts[0])} 50%, ${getColorHex(parts[1])} 50%, ${getColorHex(parts[1])} 100%)`
    }
  }

  return {
    backgroundColor: getColorHex(color.name, color.hex)
  }
}

const selectedColour = computed(() => {
  if (selectedVariant.value) {
    const colors = selectedVariant.value.colors

    if (Array.isArray(colors) && colors.length > 0) {
      return colors
        .map(color => color.color_name)
        .filter(Boolean)
        .join(' and ')
    }

    return getVariantColour(selectedVariant.value) || 'Not specified'
  }

  return product.value?.color || 'Not specified'
})


const displayedSku = computed(() =>
  selectedVariant.value?.variant_sku ||
  product.value?.item_code ||
  'Not specified'
)


// --------------------------------------------------
// Payment method prices
// --------------------------------------------------

const paymentPrices = computed(() => {
  const data =
    selectedVariant.value?.payment_prices ||
    selectedVariant.value?.paymentPrices ||
    product.value?.payment_prices ||
    {}

  const getPrice = (...keys) => {
    for (const key of keys) {
      const value = data[key]

      if (value !== null && value !== undefined && value !== '') {
        const parsed = Number(value)
        if (Number.isFinite(parsed) && parsed > 0) return parsed
      }
    }

    return null
  }

  const cash = getPrice('cash', 'cash_price', 'cashPrice')
  const card = getPrice('card', 'card_price', 'cardPrice')
  const koko = getPrice('koko', 'koko_price', 'kokoPrice')
  const mintpay = getPrice('mintpay', 'mintpay_price', 'mintPayPrice')

  return [
    { id: 'cash', label: 'CASH PRICE', price: cash, badge: 'FLAT 10% OFF', type: 'cash' },
    { id: 'card', label: 'CARD PAYMENTS', price: card, badge: 'FLAT 10% OFF', type: 'card' },
    { id: 'koko', label: 'KOKO', price: koko, type: 'koko' },
    { id: 'mintpay', label: 'MINTPAY', price: mintpay, type: 'mintpay' }
  ].filter(option => option.price !== null)
})

// --------------------------------------------------
// Price and stock
// --------------------------------------------------

function numberFrom(object, keys, fallback = 0) {
  for (const key of keys) {
    const value = object?.[key]

    if (value !== null && value !== undefined && value !== '') {
      const parsed = Number(value)

      if (Number.isFinite(parsed)) {
        return parsed
      }
    }
  }

  return fallback
}

const price = computed(() => {
  const variant = selectedVariant.value

  if (variant) {
    return numberFrom(
      variant,
      ['selling_price', 'price', 'unit_price', 'sale_price'],
      0
    )
  }

  return numberFrom(
    product.value,
    ['price', 'selling_price'],
    0
  )
})

const comparePrice = computed(() => {
  const source = selectedVariant.value || product.value

  return numberFrom(
    source,
    ['compare_at_price', 'original_price', 'mrp'],
    0
  )
})

const discount = computed(() =>
  comparePrice.value > price.value && price.value > 0
    ? Math.round((1 - price.value / comparePrice.value) * 100)
    : 0
)

const availableQuantity = computed(() => {
  const source = selectedVariant.value || product.value

  const stock = numberFrom(
    source,
    [
      'available_quantity',
      'stock_quantity',
      'available_stock',
      'quantity_in_stock'
    ],
    NaN
  )

  return Number.isFinite(stock) ? Math.max(0, stock) : 0
})

const inStock = computed(() => {
  const source = selectedVariant.value || product.value

  if (!source) return false

  const stockKnown = [
    'available_quantity',
    'stock_quantity',
    'available_stock',
    'quantity_in_stock'
  ].some(key => source[key] !== null && source[key] !== undefined)

  if (!stockKnown) return false

  return (
    source.is_active !== false &&
    source.in_stock !== false &&
    availableQuantity.value > 0
  )
})

// --------------------------------------------------
// Product details and images
// --------------------------------------------------


const rating = computed(() => averageReviewRating.value)

const reviewCount = computed(() => approvedReviewCount.value)


const safeDescription = computed(() =>
  DOMPurify.sanitize(product.value?.description || '', {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's',
      'h1', 'h2', 'h3', 'h4',
      'ul', 'ol', 'li', 'blockquote', 'a', 'span'
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'style'],
    ALLOW_DATA_ATTR: false
  })
)

const specifications = computed(() =>
  Array.isArray(product.value?.specifications)
    ? product.value.specifications
    : []
)

const images = computed(() => {
  if (!product.value) return []

  const gallery = Array.isArray(product.value.images)
    ? product.value.images
    : []

  const normalizeImage = value => {
    const responsiveImages = Array.isArray(value?.responsive_images)
      ? value.responsive_images
      : []

    return {
      ...(value && typeof value === 'object' ? value : {}),
      originalUrl: typeof value === 'string'
        ? value
        : value?.url || value?.image_url || value?.file_path || '',
      resolvedUrl: getResponsiveImageUrl(value),
      responsiveImages,
      srcset: getResponsiveImageSrcSet(responsiveImages),
    }
  }

  const seenUrls = new Set()
  const galleryImages = gallery
    .map(normalizeImage)
    .filter(image => {
      if (!image.resolvedUrl || seenUrls.has(image.resolvedUrl)) return false
      seenUrls.add(image.resolvedUrl)
      return true
    })

  const mainImage = product.value.image || product.value.image_url
  const mainRecord = mainImage ? normalizeImage(mainImage) : null

  if (mainRecord?.resolvedUrl) {
    const matchingIndex = galleryImages.findIndex(
      image => image.resolvedUrl === mainRecord.resolvedUrl
    )
    const matchingImage = matchingIndex >= 0
      ? galleryImages[matchingIndex]
      : null

    const preferredImage = matchingImage
      ? {
          ...matchingImage,
          originalUrl: mainRecord.originalUrl || matchingImage.originalUrl,
          responsiveImages: mainRecord.responsiveImages.length
            ? mainRecord.responsiveImages
            : matchingImage.responsiveImages,
          srcset: mainRecord.srcset || matchingImage.srcset,
        }
      : mainRecord

    return [
      preferredImage,
      ...galleryImages.filter(image => image.resolvedUrl !== preferredImage.resolvedUrl),
    ]
  }

  return galleryImages
})

const currentImage = computed(() =>
  images.value[selectedImage.value] || images.value[0] || null
)

function formatPrice(value) {
  return `Rs. ${Number(value).toLocaleString('en-LK', {
    maximumFractionDigits: 2
  })}`
}

function selectImage(index) {
  selectedImage.value = index
}

// --------------------------------------------------
// Response helpers
// --------------------------------------------------

function getProductList(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.products)) return payload.products
  if (Array.isArray(payload?.data?.products)) return payload.data.products
  if (Array.isArray(payload?.data)) return payload.data

  return null
}

function getVariantsFromProduct(item) {
  return Array.isArray(item?.variants)
    ? item.variants.filter(variant => variant.is_active !== false)
    : []
}

// --------------------------------------------------
// Variant selection
// --------------------------------------------------


function chooseDefaultVariant(item) {
  const list = Array.isArray(item?.variants)
    ? item.variants.filter(variant => variant.is_active !== false)
    : []

  const chosenVariant =
    list.find(
      variant =>
        variant.is_default === true ||
        variant.is_default === 1
    ) ||
    list.find(isVariantInStock) ||
    list[0]

  selectedVariantId.value = chosenVariant
    ? String(chosenVariant.id)
    : ''

  const chosenOption = chosenVariant
    ? variantOptions.value.find(option => option.id === String(chosenVariant.id))
    : null

  if (chosenOption) {
    const choice = variantChoices.value.find(group =>
      group.options.some(option => option.id === chosenOption.id)
    )
    selectedVariantGroupKey.value = choice?.key || ''
  } else {
    selectedVariantGroupKey.value = ''
  }

  const firstColor = chosenVariant
    ? getColorEntries(chosenVariant)[0]?.name || ''
    : ''

  selectedColor.value = firstColor
}

function selectColor(colorName) {
  selectedColor.value = colorName

  const matchingVariants = variants.value.filter(variant =>
    getColorEntries(variant).some(
      color => color.name.toLowerCase() === colorName.toLowerCase()
    )
  )

  const chosen =
    matchingVariants.find(isVariantInStock) ||
    matchingVariants[0]

  selectedVariantId.value = chosen ? String(chosen.id) : ''
  quantity.value = 1
  cartMessage.value = ''
  cartError.value = ''
}

function selectVariant(variantId) {
  const chosenVariant = variants.value.find(
    variant => String(variant.id) === String(variantId)
  )

  if (chosenVariant) {
    selectedVariantId.value = String(chosenVariant.id)
  }
}


function onVariantChange() {
  quantity.value = 1
  cartMessage.value = ''
  cartError.value = ''
}

// --------------------------------------------------
// Load product and variants
// --------------------------------------------------

async function loadProduct() {
  loading.value = true
  error.value = ''
  cartMessage.value = ''
  cartError.value = ''
  product.value = null
  selectedImage.value = 0
  selectedVariantId.value = ''
  selectedColor.value = ''
  selectedVariantGroupKey.value = ''
  selectedLength.value = ''
  quantity.value = 1

  try {
const productSlug = String(route.params.productSlug || '')
const publicIdMatch = productSlug.match(
  /-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i
)

const publicId = publicIdMatch?.[1]

    if (!publicId) {
      error.value = 'This product could not be found or is no longer available.'
      return
    }

    const response = await api.get('/store/products', {
      params: { publicId },
    })
    const list = getProductList(response.data)

    if (!list) {
      throw new Error('Unexpected product response from the server.')
    }

const found = publicId
  ? list.find(
      item => String(item.public_id).toLowerCase() === publicId.toLowerCase()
    )
  : null

    if (!found) {
      error.value =
        'This product could not be found or is no longer available.'
      return
    }
    

    // Load variants. Their colour is already included in this response.
    const variantsResponse = await api.get(
      `/store/products/${found.id}/variants`
    )

    const variantsPayload =
      variantsResponse.data?.data ?? variantsResponse.data

    if (!Array.isArray(variantsPayload)) {
      throw new Error('Unexpected response when loading product variants.')
    }

    // IMPORTANT:
    // Do not request the colour endpoint again here.
    // Doing so can overwrite a valid colour with null.
    const variantsWithColors = variantsPayload.map(variant => ({
      ...variant,
      color: variant.color || null
    }))

    

product.value = {
  ...found,
  variants: variantsWithColors
}

chooseDefaultVariant(product.value)

reviews.value = []
averageReviewRating.value = null
approvedReviewCount.value = 0
reviewSubmitted.value = false
reviewMessage.value = ''
reviewSubmitError.value = ''

await Promise.all([
  loadWishlistStatus(),
  loadProductReviews(),
])
  } catch (err) {
    console.error('Load product error:', err)

    error.value =
      err.response?.data?.message ||
      err.message ||
      'Unable to load this product. Please try again.'
  } finally {
    loading.value = false
  }
}

// --------------------------------------------------
// Quantity and cart
// --------------------------------------------------

function decreaseQuantity() {
  quantity.value = Math.max(1, quantity.value - 1)
}

function increaseQuantity() {
  if (inStock.value && quantity.value < availableQuantity.value) {
    quantity.value++
  }
}

async function addToCart() {
  cartMessage.value = ''
  cartError.value = ''

  if (variants.value.length && !selectedVariant.value) {
    cartError.value = 'Please select a variant first.'
    return
  }

  if (selectedVariant.value && !(price.value > 0)) {
    cartError.value = 'This variant does not have a valid price yet.'
    return
  }

  if (!inStock.value) {
    cartError.value = 'This selected option is currently out of stock.'
    return
  }

  if (quantity.value > availableQuantity.value) {
    cartError.value = 'The requested quantity exceeds available stock.'
    return
  }

  addingToCart.value = true

  try {
    const payload = {
      item_id: product.value.id,
      quantity: Number(quantity.value)
    }

    if (selectedVariant.value) {
      payload.variant_id = selectedVariant.value.id
    }

    const customerToken = sessionStorage.getItem('customerToken')

    if (customerToken) {
      await api.post('/customer-cart/items', payload)
    } else {
      let guestToken = sessionStorage.getItem('guestCheckoutToken')

      const headers = guestToken
        ? { 'x-guest-checkout-token': guestToken }
        : {}

      if (guestToken) {
        await api.post('/guest-checkout/session/items', payload, {
          headers
        })
      } else {
        const response = await api.post('/guest-checkout/session', payload)

        guestToken = response?.data?.token

        if (!/^[a-f0-9]{64}$/i.test(guestToken || '')) {
          throw new Error('Unable to start your guest cart. Please try again.')
        }

        sessionStorage.setItem('guestCheckoutToken', guestToken)
      }
    }

    const variantDescription = selectedVariant.value
      ? ` (${getVariantLength(selectedVariant.value)}${
          getVariantColour(selectedVariant.value)
            ? `, ${getVariantColour(selectedVariant.value)}`
            : ''
        })`
      : ''

    cartMessage.value =
      `${productName.value}${variantDescription} added to your cart.`
  } catch (err) {
    cartError.value =
      err.response?.data?.message ||
      err.message ||
      'Unable to add this product to your cart. Please try again.'
  } finally {
    addingToCart.value = false
  }
}




async function buyNow() {
  cartMessage.value = ''
  cartError.value = ''

  if (!product.value?.id) {
    cartError.value = 'Unable to identify this product. Please try again.'
    return
  }

  if (variants.value.length > 0 && !selectedVariant.value) {
    cartError.value = 'Please select a product variant first.'
    return
  }

  if (!(price.value > 0)) {
    cartError.value = 'This product does not have a valid price yet.'
    return
  }

  if (!inStock.value) {
    cartError.value = 'This product is currently out of stock.'
    return
  }

  if (
    !Number.isSafeInteger(Number(quantity.value)) ||
    Number(quantity.value) < 1 ||
    Number(quantity.value) > availableQuantity.value
  ) {
    cartError.value = 'Please select a valid quantity within available stock.'
    return
  }

  try {
    const payload = {
      item_id: product.value.id,
      quantity: Number(quantity.value)
    }

    if (selectedVariant.value) {
      payload.variant_id = selectedVariant.value.id
    }

    const customerToken = sessionStorage.getItem('customerToken')

    if (customerToken) {
      const response = await api.post(
        '/customer-checkout/session',
        payload
      )

      const checkoutUrl = response?.data?.checkout_url

      if (
        typeof checkoutUrl !== 'string' ||
        !/^\/checkout\/[a-f0-9]{64}$/i.test(checkoutUrl)
      ) {
        cartError.value = 'Unable to start checkout. Please try again.'
        return
      }

      const checkoutToken = checkoutUrl.split('/').pop()

      sessionStorage.setItem(
        `southWestCheckoutReturn:${checkoutToken}`,
        route.fullPath
      )

      await router.push(checkoutUrl)
    } else {
      const response = await api.post(
        '/guest-checkout/session',
        payload
      )

      const guestToken = response?.data?.token

      if (!/^[a-f0-9]{64}$/i.test(guestToken || '')) {
        cartError.value = 'Unable to start checkout. Please try again.'
        return
      }

      // Keep this Buy Now session separate from the normal guest cart.
      sessionStorage.setItem(
        `southWestCheckoutReturn:${guestToken}`,
        route.fullPath
      )

      await router.push(`/checkout/address/${guestToken}`)
    }
  } catch (error) {
    cartError.value =
      error.response?.data?.message ||
      'Unable to start checkout. Please try again.'
  }
}


// --------------------------------------------------
// Lifecycle
// --------------------------------------------------

watch(selectedVariantId, onVariantChange)

watch(
  productName,
  (name) => {
    document.title = `${name} | South West`
  },
  { immediate: true }
)

watch(() => route.params.productSlug, loadProduct)

onMounted(loadProduct)
</script>


<template>
  <main class="product-page">
    <div class="breadcrumbs">
      <RouterLink to="/">Home</RouterLink>
      <span>/</span>
      <span>Shop</span>
      <span>/</span>
      <span>{{ productName }}</span>
    </div>

    <div v-if="loading" class="state-message">
      Loading product details...
    </div>

    <div v-else-if="error" class="state-message error">
      <p>{{ error }}</p>
      <button type="button" @click="loadProduct">Try again</button>
      <RouterLink to="/">Back to shop</RouterLink>
    </div>

    <template v-else-if="product">
      <section class="product-layout">
        <div class="gallery">
          <div class="main-image">
            <img
              v-if="currentImage?.resolvedUrl"
              :src="currentImage.resolvedUrl"
              :srcset="currentImage.srcset || undefined"
              sizes="(max-width: 650px) 100vw, (max-width: 1050px) 40vw, 30vw"
              :alt="productName"
              loading="eager"
              decoding="async"
            />
            <div v-else class="image-placeholder">
              <span>SW</span>
              <p>Product image unavailable</p>
            </div>

            <span v-if="discount" class="discount-badge">
              -{{ discount }}%
            </span>
          </div>

          <div v-if="images.length > 1" class="thumbnails">
            <button
              v-for="(image, index) in images"
              :key="image.resolvedUrl || `${image.originalUrl}-${index}`"
              type="button"
              class="thumbnail"
              :class="{ selected: selectedImage === index }"
              :aria-label="`View image ${index + 1}`"
              @click="selectImage(index)"
            >
              <img
                :src="image.resolvedUrl"
                :srcset="image.srcset || undefined"
                sizes="64px"
                :alt="`${productName} ${index + 1}`"
                loading="lazy"
                decoding="async"
              />
            </button>
          </div>
        </div>

        <div class="product-info">

<p class="eyebrow">{{ product.brand || 'South West' }}</p>

<div class="product-title-row">
  <h1>{{ productName }}</h1>

  <button
    type="button"
    class="wishlist-heart"
    :class="{ 'is-wishlisted': wishlisted }"
    :disabled="wishlistBusy"
    :aria-pressed="wishlisted"
    :aria-label="
      wishlisted
        ? 'Remove from wishlist'
        : 'Add to wishlist'
    "
    :title="
      wishlisted
        ? 'Remove from wishlist'
        : 'Add to wishlist'
    "
    @click="toggleWishlist"
  >
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      class="heart-icon"
    >
      <path
        d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"
      />
    </svg>
  </button>
</div>

<p
  v-if="wishlistMessage"
  class="wishlist-feedback"
  role="status"
>
  {{ wishlistMessage }}
</p>


         <div class="rating-row">
  <span
    class="star-rating"
    :style="{ '--rating': rating || 0 }"
    role="img"
    :aria-label="rating == null ? 'No ratings yet' : `Rated ${rating.toFixed(1)} out of 5`"
  ></span>

  <strong v-if="rating != null">{{ rating.toFixed(1) }}</strong>
  <span v-else>No ratings yet</span>

  <a href="#reviews" class="rating-link">
    {{ reviewCount }} review{{ reviewCount === 1 ? '' : 's' }}
  </a>
</div>

          <p v-if="product.item_code" class="item-code">
            Product code: {{ product.item_code }}
          </p>


<VariantSelector
  v-if="variantChoices.length"
  :label="variantSelectorLabel"
  :choices="variantChoices"
  :show-choices="hasMultipleConfigurations && variantChoices.some(choice => choice.specs.length > 0)"
  :selected-key="selectedVariantChoice?.key || ''"
  :selected-name="selectedVariantChoice?.name || ''"
  :colors="colorOptions.length > 1 ? colorsForSelectedVariant : []"
  :selected-color="selectedColor"
  :swatch-style="getColorSwatchStyle"
  @select-choice="selectVariantChoice"
  @select-color="selectAvailableColor"
/>

<div class="payment-prices">
  <div class="payment-grid">
    <div
      v-for="option in paymentPrices"
      :key="option.id"
      class="payment-card"
    >
      <div class="payment-heading">
        <svg v-if="option.type === 'cash'" viewBox="0 0 24 24">
          <rect x="3" y="6" width="18" height="13" rx="2"
            fill="none" stroke="currentColor" stroke-width="1.7"/>
          <circle cx="12" cy="12.5" r="3"
            fill="none" stroke="currentColor" stroke-width="1.7"/>
        </svg>

        <svg v-else-if="option.type === 'bank'" viewBox="0 0 24 24">
          <path d="M3 9h18L12 3 3 9Zm2 2v7m5-7v7m4-7v7m5-7v7M3 21h18"
            fill="none" stroke="currentColor" stroke-width="1.7"/>
        </svg>

        <span v-else-if="option.type === 'card'" class="card-logo">
          VISA <span class="mastercard-dot"></span>
        </span>

        <img
          v-else-if="option.type === 'koko'"
          src="/koko-logo.png"
          alt="KOKO"
        />

        <img
          v-else-if="option.type === 'mintpay'"
          src="/mintpay-logo.png"
          alt="Mintpay"
        />
      </div>

      <span class="payment-label">{{ option.label }}</span>

      <span v-if="option.badge" class="payment-discount">
        {{ option.badge }}
      </span>

      <strong class="payment-amount">
        {{ formatPrice(option.price) }}
      </strong>

      <span v-if="option.id === 'card'" class="payment-subtitle">
        Card payments
      </span>

      <span v-if="option.type === 'koko' || option.type === 'mintpay'"
        class="payment-installment">
        3 monthly instalments
      </span>
    </div>
  </div>
</div>

          <p class="tax-note">
            Price shown in Sri Lankan Rupees (LKR).
          </p>

          <div class="feature-list">
            <div>
              <span>Brand</span>
              <strong>{{ product.brand || 'Not specified' }}</strong>
            </div>
            <div>
              <span>Warranty</span>
              <strong>{{ product.warranty || 'Check with seller' }}</strong>
            </div>
<div>
  <span>Colour</span>
  <strong>{{ selectedColour }}</strong>
</div>
            <div v-if="selectedVariant">
              <span>Variant</span>
              <strong>{{ selectedVariant.variant_name || 'Not specified' }}</strong>
            </div>
            <div v-for="spec in selectedVariantSpecs" :key="spec.label">
  <span>{{ spec.label }}</span>
  <strong>{{ spec.value }}</strong>
</div>
            <div>
              <span>SKU</span>
              <strong>{{ displayedSku }}</strong>
            </div>
            <div>
              <span>Condition</span>
              <strong>{{ product.condition || 'Not specified' }}</strong>
            </div>
          </div>

          <div class="stock-line" :class="{ unavailable: !inStock }">
            <span class="stock-dot"></span>
            {{
              inStock
                ? `${availableQuantity} available online`
                : 'Currently unavailable'
            }}
          </div>

          <div class="purchase-row">
            <span class="quantity-label">Quantity</span>

            <div class="quantity-control">
              <button
                type="button"
                aria-label="Decrease quantity"
                :disabled="quantity <= 1"
                @click="decreaseQuantity"
              >−</button>

              <span>{{ quantity }}</span>

              <button
                type="button"
                aria-label="Increase quantity"
                :disabled="!inStock || quantity >= availableQuantity"
                @click="increaseQuantity"
              >+</button>
            </div>
          </div>

          <p v-if="cartMessage" class="feedback success">
            {{ cartMessage }}
          </p>
          <p v-if="cartError" class="feedback error">
            {{ cartError }}
          </p>

          <div class="action-buttons">
            <button
              type="button"
              class="buy-button"
              :disabled="!inStock"
              @click="buyNow"
            >
              Buy Now
            </button>

            <button
              type="button"
              class="cart-button"
              :disabled="!inStock || addingToCart"
              @click="addToCart"
            >
              {{ addingToCart ? 'Adding...' : 'Add to Cart' }}
            </button>
          </div>

          <div class="trust-note">
            <span>Secure ordering</span>
            <span>Stock checked at checkout</span>
          </div>
        </div>

        <aside class="delivery-panel">
          <section>
            <h2>Delivery options</h2>
            <p>Delivery availability and charges are confirmed during checkout.</p>

            <div class="pickup-option">
              <div class="pickup-icon">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M3 10h18M5 10V6l1-3h12l1 3v4M5 10v11h14V10M9 21v-7h6v7"
                    stroke="currentColor"
                    stroke-width="1.7"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </div>

              <div>
                <strong>Store Pickup</strong>
                <p>4th Floor, Unity Plaza, Colombo 04</p>
              </div>
            </div>
          </section>

          <section>
            <h2>Returns &amp; warranty</h2>
            <p>{{ product.warranty || 'Warranty details available from the seller.' }}</p>
            <p>Please review the applicable return policy before ordering.</p>
          </section>

          <section>
            <h2>Availability</h2>
            <p>
              {{ inStock ? 'Available from online inventory.' : 'Currently out of stock.' }}
            </p>
          </section>
        </aside>
      </section>

      <section class="details-section">
        <h2>Product details</h2>

        <div
          v-if="product.description"
          class="product-description"
          v-html="safeDescription"
        ></div>
        <p v-else class="muted">No product description is available yet.</p>

        <h3>Specifications</h3>

        <div v-if="specifications.length" class="spec-table">
          <div
            v-for="(spec, index) in specifications"
            :key="spec.id ?? index"
            class="spec-row"
          >
            <span>{{ spec.name || spec.specification?.name || 'Specification' }}</span>
            <strong>{{ spec.value }}</strong>
          </div>
        </div>

        <div v-else class="spec-table">
          <div class="spec-row">
            <span>Brand</span>
            <strong>{{ product.brand || 'Not specified' }}</strong>
          </div>
          <div class="spec-row">
            <span>Category</span>
            <strong>{{ product.category || 'Not specified' }}</strong>
          </div>
          <div class="spec-row">
            <span>Warranty</span>
            <strong>{{ product.warranty || 'Not specified' }}</strong>
          </div>
          <div class="spec-row">
            <span>Condition</span>
            <strong>{{ product.condition || 'Not specified' }}</strong>
          </div>
        </div>

       
<div id="reviews" class="customer-reviews">
  <div class="reviews-header">
    <h3>Customer reviews</h3>
    <button type="button" class="btn-outline" @click="scrollToReviewForm">
      Write a review
    </button>
  </div>

  <!-- Summary -->
  <div class="review-summary">
    <div class="summary-score">
      <span class="review-average">
        {{ rating == null ? '—' : rating.toFixed(1) }}
      </span>

      <span
        class="star-rating large"
        :style="{ '--rating': rating || 0 }"
        aria-hidden="true"
      ></span>

      <p class="muted">
        Based on {{ reviewCount }} review{{ reviewCount === 1 ? '' : 's' }}
      </p>
    </div>

    <ul class="rating-bars">
      <li v-for="row in ratingBreakdown" :key="row.star">
        <span class="bar-label">{{ row.star }} ★</span>
        <span class="bar-track">
          <span class="bar-fill" :style="{ width: row.percent + '%' }"></span>
        </span>
        <span class="bar-count">{{ row.count }}</span>
      </li>
    </ul>
  </div>

  <div class="reviews-layout">
    <div class="reviews-list">
  <!-- List states -->
  <p v-if="reviewsLoading" class="muted review-state">Loading reviews...</p>

  <div v-else-if="reviewsError" class="review-alert error">
    {{ reviewsError }}
    <button type="button" class="link-button" @click="loadProductReviews">
      Try again
    </button>
  </div>

  <div v-else-if="!reviews.length" class="empty-reviews">
    <strong>No reviews yet</strong>
    <p>Be the first to share your experience with this product.</p>
  </div>

  <template v-else>
    <div class="review-toolbar">
      <span class="muted">
        Showing {{ reviews.length }} review{{ reviews.length === 1 ? '' : 's' }}
      </span>

      <label class="sort-control">
        <span class="sr-only">Sort reviews</span>
        <select v-model="reviewSort">
          <option value="newest">Newest first</option>
          <option value="highest">Highest rated</option>
          <option value="lowest">Lowest rated</option>
        </select>
      </label>
    </div>

    <article
      v-for="review in sortedReviews"
      :key="review.id"
      class="review-card"
    >
      <div class="review-avatar" aria-hidden="true">
        {{ reviewerInitials(review) }}
      </div>

      <div class="review-content">
        <div class="review-card-heading">
          <strong>{{ reviewerName(review) }}</strong>

          <span v-if="review.is_verified_purchase" class="verified-purchase">
            ✓ Verified purchase
          </span>

          <span class="review-date">
            {{ formatReviewDate(review.created_at) }}
          </span>
        </div>

        <span
          class="star-rating"
          :style="{ '--rating': Number(review.rating) }"
          role="img"
          :aria-label="`Rated ${review.rating} out of 5`"
        ></span>

        <h4 v-if="review.review_title">{{ review.review_title }}</h4>

        <p v-if="review.review_text" class="review-body">
          {{ review.review_text }}
        </p>
      </div>
    </article>
  </template>

    </div>

  <!-- Write a review -->
  <div id="write-review" class="review-form">
    <h4>Write a review</h4>
    <p class="muted">Share your experience to help other customers.</p>

    <p v-if="reviewMessage" class="review-alert success">{{ reviewMessage }}</p>
    <p v-if="reviewSubmitError" class="review-alert error">{{ reviewSubmitError }}</p>

    <form v-if="!reviewSubmitted" @submit.prevent="submitProductReview">
      <p v-if="isGuestReviewer" class="muted guest-review-notice">
        Your review will be displayed using an automatically generated guest number.
      </p>

      <div v-else class="form-field review-name-preference">
        <label class="checkbox-label">
          <input
            v-model="displayReviewName"
            type="checkbox"
          />
          Display my full name with this review
        </label>
        <small class="muted">
          If unchecked, your first and last name will be partially hidden.
        </small>
      </div>

      <div class="form-field">
        <span class="field-label">Your rating</span>

        <div
          class="star-picker"
          role="radiogroup"
          aria-label="Your rating"
          @mouseleave="hoverRating = 0"
        >
          <button
            v-for="n in 5"
            :key="n"
            type="button"
            class="star-btn"
            :class="{ active: n <= (hoverRating || reviewRating) }"
            role="radio"
            :aria-checked="reviewRating === n"
            :aria-label="`${n} star${n > 1 ? 's' : ''}`"
            @mouseenter="hoverRating = n"
            @click="reviewRating = n"
          >
            ★
          </button>

          <span class="star-label">
            {{ ratingLabels[hoverRating || reviewRating] }}
          </span>
        </div>
      </div>

      <div class="form-field">
        <label for="review-title">Title <span class="optional">(optional)</span></label>
        <input
          id="review-title"
          v-model="reviewTitle"
          maxlength="200"
          placeholder="Summarise your experience"
        />
      </div>

      <div class="form-field">
        <label for="review-text">Your review</label>
        <textarea
          id="review-text"
          v-model="reviewText"
          rows="4"
          maxlength="5000"
          placeholder="What did you like or dislike? How did you use it?"
        ></textarea>
        <small class="char-count">{{ reviewText.length }} / 5000</small>
      </div>

      <button type="submit" class="btn-submit" :disabled="submittingReview">
        {{ submittingReview ? 'Submitting...' : 'Submit review' }}
      </button>
    </form>

    <p v-else class="muted">Thank you. Your review is awaiting approval.</p>
  </div>
    </div>
</div>

      </section>

      <SimilarProducts
        v-if="product"
        :product-id="product.id"
      />
    </template>
  </main>
</template>

<style scoped>
.product-page {
  min-height: 100vh;
  padding: 28px 0 64px;
  background: var(--color-store-bg, #f3f5f8);
  color: var(--color-text, #172033);
}

.breadcrumbs,
.product-layout,
.details-section,
.state-message {
  width: min(1280px, 94%);
  margin-inline: auto;
}

.breadcrumbs {
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
  margin-bottom: 20px;
  color: var(--color-text-muted, #697386);
  font-size: 13px;
}

.breadcrumbs a {
  color: inherit;
  text-decoration: none;
}

.breadcrumbs a:hover {
  text-decoration: underline;
}

/* =========================
   Main layout
   ========================= */

.product-layout {
  display: grid;
  grid-template-columns: minmax(250px, .9fr) minmax(320px, 1.2fr) minmax(220px, .7fr);
  align-items: start;
  gap: 28px;
  padding: 28px;
  background: var(--color-surface, #fff);
  border: 1px solid var(--color-border-soft, #e5e9f0);
  border-radius: 14px;
  box-shadow: 0 1px 3px rgb(16 24 40 / 6%);
}

.gallery,
.product-info {
  min-width: 0;
}

/* =========================
   Gallery
   ========================= */

.main-image {
  position: relative;
  display: grid;
  place-items: center;
  aspect-ratio: 1;
  overflow: hidden;
  border: 1px solid var(--color-border-soft, #e5e9f0);
  border-radius: 12px;
  background: #fff;
}

.main-image > img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  padding: 14px;
}

.image-placeholder {
  display: grid;
  place-items: center;
  align-content: center;
  gap: 8px;
  color: #8490a3;
}

.image-placeholder span {
  font-size: 52px;
  font-weight: 800;
}

.image-placeholder p {
  font-size: 12px;
}

.discount-badge {
  position: absolute;
  top: 12px;
  left: 12px;
  padding: 5px 10px;
  border-radius: 999px;
  background: #dc3e36;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
}

.thumbnails {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 14px;
}

.thumbnail {
  width: 64px;
  height: 64px;
  padding: 4px;
  overflow: hidden;
  border: 1px solid var(--color-border-soft, #e0e5ed);
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  transition: border-color .15s ease;
}

.thumbnail:hover {
  border-color: var(--color-text-muted, #8790a0);
}

.thumbnail.selected {
  border: 2px solid var(--color-primary, #1f4a8a);
}

.thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

/* =========================
   Product info
   ========================= */

.eyebrow {
  margin: 0 0 8px;
  color: var(--color-primary, #1f4a8a);
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .08em;
}

.product-info h1 {
  margin: 0 0 12px;
  font-size: clamp(23px, 2.5vw, 30px);
  line-height: 1.3;
  overflow-wrap: anywhere;
}

.rating-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
  color: var(--color-text-muted, #687386);
  font-size: 13px;
}

.rating-row strong {
  color: var(--color-text, #172033);
}

.rating-link {
  color: var(--color-primary, #1f4a8a);
  text-decoration: none;
}

.rating-link:hover {
  text-decoration: underline;
}

.item-code,
.tax-note {
  color: var(--color-text-muted, #687386);
  font-size: 12px;
}

/* =========================
   Star rating (supports decimals)
   ========================= */

.star-rating {
  --rating: 0;
  --star-size: 16px;
  display: inline-block;
  font-size: var(--star-size);
  line-height: 1;
  letter-spacing: 2px;
  white-space: nowrap;
}

.star-rating::before {
  content: '★★★★★';
  background: linear-gradient(
    90deg,
    #f5a623 calc(var(--rating) / 5 * 100%),
    #d5dbe5 calc(var(--rating) / 5 * 100%)
  );
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  color: transparent;
}

.star-rating.large {
  --star-size: 22px;
}

/* =========================
   Variant picker
   ========================= */

.variant-selector {
  display: grid;
  gap: 20px;
  margin: 20px 0;
}

.option-group {
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.option-label {
  padding: 0;
  margin-bottom: 10px;
  font-size: 13px;
  font-weight: 700;
}

.option-value {
  color: var(--color-text-muted, #687386);
  font-weight: 500;
}

.option-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.option {
  position: relative;
  display: inline-flex;
  cursor: pointer;
}

.option-input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}

.option-body {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-width: 52px;
  min-height: 44px;
  padding: 8px 18px;
  border: 1px solid var(--color-border, #cfd6e0);
  border-radius: 8px;
  background: var(--color-surface, #fff);
  color: inherit;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.3;
  text-align: center;
  overflow-wrap: anywhere;
  transition: border-color .15s ease, box-shadow .15s ease, background .15s ease;
}

.option-input:checked + .option-body {
  border-color: var(--color-primary, #1f4a8a);
  background: color-mix(in srgb, var(--color-primary, #1f4a8a) 7%, var(--color-surface, #fff));
  box-shadow: 0 0 0 1px var(--color-primary, #1f4a8a);
  color: var(--color-primary, #1f4a8a);
}

.option-input:focus-visible + .option-body {
  outline: 2px solid var(--color-focus-outline, #1f4a8a);
  outline-offset: 2px;
}

.option.unavailable .option-body {
  border-style: dashed;
  color: var(--color-text-muted, #8790a0);
  text-decoration: line-through;
}

@media (hover: hover) {
  .option:hover .option-body {
    border-color: var(--color-text-muted, #8790a0);
  }

  .option:hover .option-input:checked + .option-body {
    border-color: var(--color-primary, #1f4a8a);
  }
}

/* ---------- Colour swatches ---------- */

.swatch-list {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
}

.swatch {
  position: relative;
  display: inline-flex;
  padding: 3px;
  border-radius: 50%;
  cursor: pointer;
}

.swatch-input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}


.swatch-circle {
  position: relative;
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  overflow: hidden;
  border-radius: 50%;
  background-color: var(--swatch-color, #e5e7eb);
  background-image: none;
  box-shadow: inset 0 0 0 1px rgb(0 0 0 / 18%);
  transition: transform .15s ease;
}

.color-swatch {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  overflow: hidden;
  border: 1px solid #d1d5db;
}

.swatch-initial {
  color: var(--color-text-muted, #687386);
  font-size: 13px;
  font-weight: 700;
}

/* Selected: outer ring */
.swatch.selected {
  box-shadow: 0 0 0 2px var(--color-primary, #1f4a8a);
}

.swatch:focus-within {
  outline: 2px solid var(--color-focus-outline, #1f4a8a);
  outline-offset: 3px;
}

@media (hover: hover) {
  .swatch:hover .swatch-circle {
    transform: scale(1.1);
  }
}

/* Out of stock: faded with a diagonal strike */
.swatch.unavailable .swatch-circle {
  opacity: .5;
}

.swatch.unavailable .swatch-circle::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to top right,
    transparent calc(50% - 1px),
    rgb(0 0 0 / 55%) 50%,
    transparent calc(50% + 1px)
  );
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

.variant-notice {
  margin: 18px 0;
  color: var(--color-text-muted, #687386);
  font-size: 13px;
}

/* =========================
   Price
   ========================= */

.price-block {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 10px;
  padding: 20px 0 8px;
  border-top: 1px solid var(--color-border-soft, #e5e9f0);
}

.price-block > strong {
  color: var(--color-accent-deep, #e96826);
  font-size: clamp(27px, 3vw, 36px);
}

.price-note {
  margin-left: 4px;
  color: #666;
  font-size: .75rem;
  font-weight: 400;
  white-space: nowrap;
}

.price-block s {
  color: var(--color-text-muted, #8790a0);
  font-size: 14px;
}

.discount-text {
  padding: 3px 8px;
  border-radius: 999px;
  background: #e9f8f0;
  color: #16845b;
  font-size: 12px;
  font-weight: 700;
}

.tax-note {
  margin-top: 0;
}

/* =========================
   Feature list
   ========================= */

.feature-list {
  display: grid;
  margin: 20px 0;
  border-top: 1px solid var(--color-border-soft, #e5e9f0);
}

.feature-list > div {
  display: grid;
  grid-template-columns: minmax(85px, .7fr) minmax(0, 1fr);
  gap: 12px;
  padding: 11px 0;
  border-bottom: 1px solid var(--color-border-soft, #e5e9f0);
  font-size: 13px;
}

.feature-list span {
  color: var(--color-text-muted, #687386);
}

.feature-list strong {
  overflow-wrap: anywhere;
}

/* =========================
   Stock + purchase
   ========================= */

.stock-line {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 999px;
  background: #e9f8f0;
  color: #16845b;
  font-size: 13px;
  font-weight: 600;
}

.stock-line.unavailable {
  background: #fdecec;
  color: #c23b3b;
}

.stock-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
}

.purchase-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 18px;
  margin-top: 22px;
}

.quantity-label {
  color: var(--color-text-muted, #687386);
  font-size: 13px;
  font-weight: 600;
}

.quantity-control {
  display: flex;
  align-items: center;
  overflow: hidden;
  border: 1px solid var(--color-border, #d5dbe5);
  border-radius: 8px;
}

.quantity-control button {
  width: 40px;
  height: 40px;
  border: 0;
  background: var(--color-surface-muted, #f4f6f9);
  color: var(--color-text, #172033);
  font-size: 20px;
  cursor: pointer;
  transition: background .15s ease;
}

.quantity-control button:hover:not(:disabled) {
  background: #e8ecf2;
}

.quantity-control button:disabled {
  opacity: .4;
  cursor: not-allowed;
}

.quantity-control span {
  min-width: 46px;
  text-align: center;
  font-size: 14px;
  font-weight: 600;
}

.action-buttons {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 20px;
}

.action-buttons button {
  min-height: 48px;
  padding: 10px;
  border: 0;
  border-radius: 8px;
  font: inherit;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: filter .15s ease, transform .1s ease;
}

.action-buttons button:hover:not(:disabled) {
  filter: brightness(1.08);
}

.action-buttons button:active:not(:disabled) {
  transform: translateY(1px);
}

.action-buttons button:disabled {
  opacity: .5;
  cursor: not-allowed;
}

.buy-button {
  background: var(--color-primary, #1f4a8a);
  color: #fff;
}

.cart-button {
  background: var(--color-accent-deep, #ed6b25);
  color: #fff;
}

.feedback {
  margin: 12px 0 0;
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 13px;
}

.feedback.success {
  background: #e9f8f0;
  color: #176c49;
}

.feedback.error {
  background: #fdecec;
  color: #b42318;
}

.state-message.error {
  color: #b42318;
}

.trust-note {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  margin-top: 18px;
  color: var(--color-text-muted, #687386);
  font-size: 11px;
}

/* =========================
   Delivery panel
   ========================= */

.delivery-panel {
  min-width: 0;
  border: 1px solid var(--color-border-soft, #e5e9f0);
  border-radius: 12px;
  background: var(--color-surface-muted, #f8f9fb);
}

.delivery-panel section {
  padding: 18px;
  border-bottom: 1px solid var(--color-border-soft, #e5e9f0);
}

.delivery-panel section:last-child {
  border-bottom: 0;
}

.delivery-panel h2 {
  margin: 0 0 12px;
  font-size: 14px;
}

.delivery-panel p {
  margin: 8px 0 0;
  color: var(--color-text-muted, #687386);
  font-size: 12px;
  line-height: 1.6;
}

/* =========================
   Details section
   ========================= */

.details-section {
  margin-top: 22px;
  padding: 32px;
  border: 1px solid var(--color-border-soft, #e5e9f0);
  border-radius: 14px;
  background: var(--color-surface, #fff);
  box-shadow: 0 1px 3px rgb(16 24 40 / 6%);
}

.details-section h2 {
  margin: 0 0 18px;
  font-size: 22px;
}

.details-section h3 {
  margin: 32px 0 14px;
  font-size: 17px;
}

.details-section > p {
  line-height: 1.8;
  white-space: pre-line;
}

.muted {
  color: var(--color-text-muted, #687386);
  font-size: 13px;
}

.spec-table {
  overflow: hidden;
  border: 1px solid var(--color-border-soft, #e5e9f0);
  border-radius: 10px;
}

.spec-row {
  display: grid;
  grid-template-columns: minmax(120px, .7fr) minmax(0, 1fr);
  gap: 16px;
  padding: 13px 16px;
  border-bottom: 1px solid var(--color-border-soft, #e5e9f0);
  font-size: 13px;
}

.spec-row:last-child {
  border-bottom: 0;
}

.spec-row:nth-child(odd) {
  background: var(--color-surface-muted, #f8f9fb);
}

.spec-row span {
  color: var(--color-text-muted, #687386);
}

.spec-row strong {
  overflow-wrap: anywhere;
}

.state-message {
  padding: 50px 20px;
  text-align: center;
  background: var(--color-surface, #fff);
  border-radius: 12px;
}

.state-message button,
.state-message a {
  margin: 8px;
}

.product-description {
  line-height: 1.8;
  overflow-wrap: anywhere;
}

.product-description :deep(p) {
  margin: 0 0 14px;
}

.product-description :deep(h1),
.product-description :deep(h2),
.product-description :deep(h3),
.product-description :deep(h4) {
  margin: 20px 0 10px;
  line-height: 1.4;
}

.product-description :deep(ul),
.product-description :deep(ol) {
  margin: 12px 0;
  padding-left: 24px;
}

.product-description :deep(blockquote) {
  margin: 16px 0;
  padding-left: 14px;
  border-left: 3px solid var(--color-primary, #1f4a8a);
}

.product-description :deep(a) {
  color: var(--color-primary, #1f4a8a);
  text-decoration: underline;
}

/* =========================
   Customer reviews
   ========================= */

.customer-reviews {
  margin-top: 40px;
  padding-top: 32px;
  border-top: 1px solid var(--color-border-soft, #e5e9f0);
  scroll-margin-top: 20px;
}

.reviews-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
}

.reviews-header h3 {
  margin: 0;
}

.btn-outline {
  padding: 10px 18px;
  border: 1px solid var(--color-primary, #1f4a8a);
  border-radius: 8px;
  background: transparent;
  color: var(--color-primary, #1f4a8a);
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: background .15s ease, color .15s ease;
}

.btn-outline:hover {
  background: var(--color-primary, #1f4a8a);
  color: #fff;
}

/* Summary */

.review-summary {
  display: grid;
  grid-template-columns: minmax(180px, 240px) minmax(0, 1fr);
  align-items: center;
  gap: 32px;
  margin-bottom: 28px;
  padding: 24px;
  border: 1px solid var(--color-border-soft, #e5e9f0);
  border-radius: 12px;
  background: var(--color-surface-muted, #f8f9fb);
}

.summary-score {
  display: grid;
  justify-items: center;
  gap: 6px;
  text-align: center;
}

.review-average {
  font-size: 3rem;
  font-weight: 800;
  line-height: 1;
}

.summary-score p {
  margin: 4px 0 0;
}

.rating-bars {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.rating-bars li {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) 30px;
  align-items: center;
  gap: 12px;
  font-size: 13px;
}

.bar-label {
  color: var(--color-text-muted, #687386);
  white-space: nowrap;
}

.bar-track {
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: #e1e6ee;
}

.bar-fill {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: #f5a623;
  transition: width .3s ease;
}

.bar-count {
  color: var(--color-text-muted, #687386);
  text-align: right;
}

/* List */

.review-state {
  padding: 20px 0;
}

.empty-reviews {
  padding: 36px 20px;
  border: 2px dashed var(--color-border-soft, #d5dbe5);
  border-radius: 12px;
  text-align: center;
}

.empty-reviews p {
  margin: 6px 0 0;
  color: var(--color-text-muted, #687386);
  font-size: 13px;
}

.review-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 4px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--color-border-soft, #e5e9f0);
}

.sort-control select {
  padding: 8px 12px;
  border: 1px solid var(--color-border-soft, #d5dbe5);
  border-radius: 8px;
  background: var(--color-surface, #fff);
  color: inherit;
  font: inherit;
  font-size: 13px;
}

.review-card {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr);
  gap: 16px;
  padding: 22px 0;
  border-bottom: 1px solid var(--color-border-soft, #e5e9f0);
}

.review-avatar {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--color-primary, #1f4a8a) 12%, #fff);
  color: var(--color-primary, #1f4a8a);
  font-size: 14px;
  font-weight: 700;
}

.review-content {
  min-width: 0;
}

.review-card-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 12px;
  margin-bottom: 6px;
}

.verified-purchase {
  padding: 2px 8px;
  border-radius: 999px;
  background: #e9f8f0;
  color: #167447;
  font-size: 11px;
  font-weight: 700;
}

.review-date {
  margin-left: auto;
  color: var(--color-text-muted, #687386);
  font-size: 12px;
}

.review-content h4 {
  margin: 10px 0 6px;
  font-size: 15px;
}

.review-body {
  margin: 6px 0 0;
  font-size: 14px;
  line-height: 1.7;
  overflow-wrap: anywhere;
  white-space: pre-line;
}

/* Alerts */

.review-alert {
  margin: 0 0 14px;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 13px;
}

.review-alert.success {
  background: #e9f8f0;
  color: #167447;
}

.review-alert.error {
  background: #fdecec;
  color: #b42318;
}

.link-button {
  margin-left: 8px;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  font-weight: 700;
  text-decoration: underline;
  cursor: pointer;
}

/* Write a review */

.reviews-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  grid-template-areas: "form reviews";
  align-items: start;
  gap: 28px;
}

.reviews-list {
  grid-area: reviews;
  min-width: 0;
  max-height: 680px;
  overflow-y: auto;
  padding-right: 10px;
  scrollbar-width: thin;
}

.review-form {
  grid-area: form;
  min-width: 0;
  max-width: none;
  margin-top: 0;
  padding: 24px;
  border: 1px solid var(--color-border-soft, #e5e9f0);
  border-radius: 12px;
  background: var(--color-surface-muted, #f8f9fb);
  scroll-margin-top: 20px;
}

.review-form h4 {
  margin: 0 0 4px;
  font-size: 18px;
}

.review-form .muted {
  margin: 0 0 16px;
}

.review-form form {
  display: grid;
  gap: 16px;
}

.form-field {
  display: grid;
  gap: 6px;
}

.form-field label,
.field-label {
  font-size: 13px;
  font-weight: 700;
}

.optional {
  color: var(--color-text-muted, #687386);
  font-weight: 400;
}

.review-form input,
.review-form textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 11px 12px;
  border: 1px solid var(--color-border-soft, #d5dbe5);
  border-radius: 8px;
  background: var(--color-surface, #fff);
  color: inherit;
  font: inherit;
  font-size: 14px;
  transition: border-color .15s ease, box-shadow .15s ease;
}

.review-form textarea {
  resize: vertical;
}

.review-form input:focus,
.review-form textarea:focus {
  outline: none;
  border-color: var(--color-primary, #1f4a8a);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary, #1f4a8a) 18%, transparent);
}

.char-count {
  justify-self: end;
  color: var(--color-text-muted, #687386);
  font-size: 11px;
}

/* Star picker */

.star-picker {
  display: flex;
  align-items: center;
  gap: 2px;
}

.star-btn {
  padding: 2px 3px;
  border: 0;
  background: none;
  color: #d5dbe5;
  font-size: 30px;
  line-height: 1;
  cursor: pointer;
  transition: color .1s ease, transform .1s ease;
}

.star-btn.active {
  color: #f5a623;
}

.star-btn:hover {
  transform: scale(1.12);
}

.star-btn:focus-visible {
  outline: 2px solid var(--color-focus-outline, #1f4a8a);
  outline-offset: 2px;
  border-radius: 4px;
}

.star-label {
  margin-left: 10px;
  color: var(--color-text-muted, #687386);
  font-size: 13px;
  font-weight: 600;
}

.btn-submit {
  justify-self: start;
  padding: 12px 24px;
  border: 0;
  border-radius: 8px;
  background: var(--color-primary, #1f4a8a);
  color: #fff;
  font: inherit;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: filter .15s ease;
}

.btn-submit:hover:not(:disabled) {
  filter: brightness(1.1);
}

.btn-submit:disabled {
  opacity: .6;
  cursor: wait;
}


.product-title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.product-title-row h1 {
  flex: 1;
  min-width: 0;
  margin: 0 0 12px;
  overflow-wrap: anywhere;
}

.wishlist-heart {
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  padding: 10px;
  border: 1px solid var(--color-border-soft, #e5e9f0);
  border-radius: 50%;
  background: var(--color-surface, #fff);
  color: #697386;
  cursor: pointer;
  transition:
    color 0.2s ease,
    background 0.2s ease,
    border-color 0.2s ease,
    transform 0.2s ease;
}

.heart-icon {
  width: 24px;
  height: 24px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition: fill 0.2s ease;
}

.wishlist-heart:hover:not(:disabled) {
  color: #e53950;
  border-color: #e53950;
  transform: scale(1.05);
}

.wishlist-heart.is-wishlisted {
  color: #e53950;
  border-color: #e53950;
  background: #fff1f2;
}

.wishlist-heart.is-wishlisted .heart-icon {
  fill: #e53950;
}

.wishlist-heart:disabled {
  opacity: 0.6;
  cursor: wait;
}

.wishlist-heart:focus-visible {
  outline: 2px solid var(--color-primary, #1f4a8a);
  outline-offset: 3px;
}

.wishlist-feedback {
  margin: 8px 0 12px;
  color: var(--color-text-muted, #697386);
  font-size: 13px;
}



.variant-swatch-list {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 12px;
  margin-top: 12px;
}

.variant-swatch-option {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  min-width: 52px;
  padding: 4px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
}

.variant-swatch-circle {
  display: block;
  width: 34px;
  height: 34px;
  border: 1px solid rgb(0 0 0 / 20%);
  border-radius: 50%;
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 18%);
}

.variant-swatch-option.selected {
  border-color: var(--color-primary, #1f4a8a);
  background: color-mix(in srgb, var(--color-primary, #1f4a8a) 7%, white);
}

.variant-swatch-name {
  max-width: 90px;
  color: var(--color-text-muted, #687386);
  font-size: 11px;
  text-align: center;
  overflow-wrap: anywhere;
}

.variant-swatch-option:focus-visible {
  outline: 2px solid var(--color-primary, #1f4a8a);
  outline-offset: 2px;
}

.variant-option.unavailable {
  opacity: .38;
  cursor: not-allowed;
}

.variant-option:has(.option-input:disabled) {
  cursor: not-allowed;
}

.variant-choice-button:disabled {
  opacity: .38;
  cursor: not-allowed;
}

.variant-swatch-option:disabled {
  opacity: .32;
  cursor: not-allowed;
  filter: grayscale(1);
}

.variant-options-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 12px;
  margin-top: 14px;
}

.variant-option {
  position: relative;
  display: flex;
  padding: 14px;
  border: 1px solid #d8dee8;
  border-radius: 10px;
  background: #fff;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.variant-option.selected {
  border: 2px solid #508ce8;
  background: #f0f6ff;
  padding: 13px;
}

.variant-option.unavailable {
  opacity: 0.65;
}

.variant-option-content {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.variant-attribute,
.variant-colors {
  font-size: 12px;
  color: #687386;
  overflow-wrap: anywhere;
}

.variant-stock-warning {
  color: #b42318;
  font-size: 12px;
  font-weight: 600;
}

/* ==========================================================================
   REVIEWS + REVIEW FORM  (paste at the very END of your <style scoped>)
   Same markup and same layout (form left, reviews right). Only the look changes.
   These rules override the older review rules above them, so nothing else needs
   to be edited. You can delete the old review rules later to keep the file tidy.
   ========================================================================== */

.customer-reviews {
  --rv-primary: var(--color-primary, #1f4a8a);
  --rv-surface: var(--color-surface, #fff);
  --rv-soft: var(--color-surface-muted, #f6f8fb);
  --rv-border: var(--color-border-soft, #e5e9f0);
  --rv-muted: var(--color-text-muted, #687386);
  --rv-star: #f5a623;
  --rv-success: #167447;
  --rv-success-bg: #e8f7f0;
  --rv-danger: #b42318;
  --rv-danger-bg: #fdecec;

  margin-top: 44px;
  padding-top: 34px;
  border-top: 1px solid var(--rv-border);
  scroll-margin-top: 20px;
}

/* ---------- Header ---------- */
.reviews-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
}

.reviews-header h3 {
  margin: 0;
  font-size: 20px;
}

.btn-outline {
  padding: 10px 20px;
  border: 1px solid var(--rv-primary);
  border-radius: 999px;
  background: transparent;
  color: var(--rv-primary);
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.btn-outline:hover {
  background: var(--rv-primary);
  color: #fff;
}

.btn-outline:focus-visible {
  outline: 2px solid var(--rv-primary);
  outline-offset: 3px;
}

/* ---------- Summary ---------- */
.review-summary {
  display: grid;
  grid-template-columns: minmax(180px, 240px) minmax(0, 1fr);
  align-items: center;
  gap: 32px;
  margin-bottom: 28px;
  padding: 24px 28px;
  border: 1px solid var(--rv-border);
  border-radius: 16px;
  background: var(--rv-soft);
}

.summary-score {
  display: grid;
  justify-items: center;
  gap: 8px;
  padding-right: 32px;
  border-right: 1px solid var(--rv-border);
  text-align: center;
}

.review-average {
  font-family: var(--font-family-display, inherit);
  font-size: 3.2rem;
  font-weight: 800;
  line-height: 1;
}

.summary-score p {
  margin: 2px 0 0;
}

.rating-bars {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.rating-bars li {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) 30px;
  align-items: center;
  gap: 12px;
  font-size: 13px;
}

.bar-label {
  color: var(--rv-muted);
  font-weight: 600;
  white-space: nowrap;
}

.bar-track {
  height: 10px;
  overflow: hidden;
  border-radius: 999px;
  background: #e1e6ee;
}

.bar-fill {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #f7b73e, var(--rv-star));
  transition: width 0.3s ease;
}

.bar-count {
  color: var(--rv-muted);
  font-variant-numeric: tabular-nums;
  text-align: right;
}

/* ---------- Layout areas stay exactly as before ---------- */
.reviews-layout {
  gap: 28px;
}

/* ---------- Reviews list (scrolls on its own) ---------- */
.reviews-list {
  max-height: 680px;
  padding-right: 10px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: #c9d1de transparent;
}

.reviews-list::-webkit-scrollbar {
  width: 6px;
}

.reviews-list::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: #c9d1de;
}

/* Sort bar stays visible while scrolling the reviews */
.review-toolbar {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  padding: 4px 0 12px;
  border-bottom: 1px solid var(--rv-border);
  background: var(--rv-surface);
}

.sort-control select {
  appearance: none;
  padding: 9px 34px 9px 14px;
  border: 1px solid var(--color-border, #d5dbe5);
  border-radius: 999px;
  background-color: var(--rv-surface);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23687386' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
  background-position: right 12px center;
  background-repeat: no-repeat;
  background-size: 14px;
  color: inherit;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.sort-control select:hover {
  border-color: var(--rv-muted);
}

.sort-control select:focus-visible {
  outline: 2px solid transparent;
  border-color: var(--rv-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--rv-primary) 18%, transparent);
}

/* ---------- Review cards ---------- */
.review-card {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr);
  gap: 14px;
  padding: 18px;
  border: 1px solid var(--rv-border);
  border-radius: 14px;
  background: var(--rv-surface);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.review-card + .review-card {
  margin-top: 12px;
}

@media (hover: hover) {
  .review-card:hover {
    border-color: #d3dae6;
    box-shadow: 0 4px 14px rgb(16 24 40 / 6%);
  }
}

.review-avatar {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--rv-primary) 18%, #fff),
    color-mix(in srgb, var(--rv-primary) 8%, #fff)
  );
  color: var(--rv-primary);
  font-size: 14px;
  font-weight: 700;
}

.review-card-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 10px;
  margin-bottom: 6px;
}

.review-card-heading strong {
  font-size: 14px;
}

.verified-purchase {
  padding: 2px 9px;
  border-radius: 999px;
  background: var(--rv-success-bg);
  color: var(--rv-success);
  font-size: 11px;
  font-weight: 700;
}

.review-date {
  margin-left: auto;
  color: var(--rv-muted);
  font-size: 12px;
}

.review-content h4 {
  margin: 10px 0 4px;
  font-size: 15px;
  line-height: 1.4;
}

.review-body {
  margin: 6px 0 0;
  color: #2b3447;
  font-size: 14px;
  line-height: 1.7;
  overflow-wrap: anywhere;
  white-space: pre-line;
}

/* ---------- Empty / loading / error ---------- */
.review-state {
  padding: 24px 0;
  text-align: center;
}

.empty-reviews {
  padding: 40px 20px;
  border: 2px dashed #d5dbe5;
  border-radius: 16px;
  background: var(--rv-soft);
  text-align: center;
}

.empty-reviews::before {
  content: '★';
  display: grid;
  place-items: center;
  width: 52px;
  height: 52px;
  margin: 0 auto 12px;
  border-radius: 50%;
  background: #fff4dc;
  color: var(--rv-star);
  font-size: 26px;
}

.empty-reviews strong {
  font-size: 15px;
}

.empty-reviews p {
  margin: 6px 0 0;
  color: var(--rv-muted);
  font-size: 13px;
}

.review-alert {
  margin: 0 0 14px;
  padding: 11px 14px;
  border-left: 3px solid transparent;
  border-radius: 10px;
  font-size: 13px;
  line-height: 1.5;
}

.review-alert.success {
  border-left-color: var(--rv-success);
  background: var(--rv-success-bg);
  color: var(--rv-success);
}

.review-alert.error {
  border-left-color: var(--rv-danger);
  background: var(--rv-danger-bg);
  color: var(--rv-danger);
}

.link-button {
  margin-left: 8px;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  font-weight: 700;
  text-decoration: underline;
  cursor: pointer;
}

/* ==========================================================================
   Write a review (form)
   ========================================================================== */
.review-form {
  padding: 26px;
  border: 1px solid var(--rv-border);
  border-radius: 16px;
  background: var(--rv-surface);
  box-shadow: 0 1px 2px rgb(16 24 40 / 5%), 0 8px 22px rgb(16 24 40 / 5%);
}

.review-form h4 {
  margin: 0 0 4px;
  font-family: var(--font-family-display, inherit);
  font-size: 19px;
}

.review-form > .muted {
  margin: 0 0 20px;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--rv-border);
}

.review-form form {
  display: grid;
  gap: 20px;
}

.form-field {
  display: grid;
  gap: 8px;
}

.form-field label,
.field-label {
  font-size: 13px;
  font-weight: 700;
}

.optional {
  color: var(--rv-muted);
  font-weight: 400;
}

/* Guest notice: friendly info box */
.guest-review-notice {
  margin: 0;
  padding: 12px 14px;
  border-left: 3px solid var(--rv-primary);
  border-radius: 10px;
  background: color-mix(in srgb, var(--rv-primary) 7%, var(--rv-surface));
  color: #34425a;
  font-size: 13px;
  line-height: 1.55;
}

/* "Display my full name" checkbox as one easy tap target */
.review-name-preference {
  padding: 12px 14px;
  border: 1px solid var(--rv-border);
  border-radius: 12px;
  background: var(--rv-soft);
  gap: 4px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
}

.review-form .checkbox-label input[type='checkbox'] {
  flex: 0 0 auto;
  width: 18px;
  height: 18px;
  margin: 0;
  padding: 0;
  accent-color: var(--rv-primary);
  cursor: pointer;
}

.review-name-preference small {
  margin-left: 28px;
  color: var(--rv-muted);
  font-size: 12px;
  line-height: 1.5;
}

/* Inputs */
.review-form input:not([type='checkbox']),
.review-form textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 12px 14px;
  border: 1px solid var(--color-border, #d5dbe5);
  border-radius: 10px;
  background: var(--rv-surface);
  color: inherit;
  font: inherit;
  font-size: 14px;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.review-form input:not([type='checkbox']) {
  min-height: 46px;
}

.review-form textarea {
  min-height: 130px;
  line-height: 1.6;
  resize: vertical;
}

.review-form input::placeholder,
.review-form textarea::placeholder {
  color: #9aa4b5;
}

@media (hover: hover) {
  .review-form input:not([type='checkbox']):hover:not(:focus),
  .review-form textarea:hover:not(:focus) {
    border-color: var(--rv-muted);
  }
}

.review-form input:not([type='checkbox']):focus,
.review-form textarea:focus {
  outline: 2px solid transparent;
  border-color: var(--rv-primary);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--rv-primary) 16%, transparent);
}

.char-count {
  justify-self: end;
  color: var(--rv-muted);
  font-size: 11.5px;
  font-variant-numeric: tabular-nums;
}

/* Star picker */
.star-picker {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px 0;
}

.star-btn {
  padding: 2px 3px;
  border: 0;
  border-radius: 6px;
  background: none;
  color: #d5dbe5;
  font-size: 34px;
  line-height: 1;
  cursor: pointer;
  transition: color 0.1s ease, transform 0.12s ease;
}

.star-btn.active {
  color: var(--rv-star);
}

.star-btn:hover {
  transform: scale(1.15);
}

.star-btn:focus-visible {
  outline: 2px solid var(--rv-primary);
  outline-offset: 2px;
}

.star-label {
  margin-left: 10px;
  padding: 3px 11px;
  border-radius: 999px;
  background: #fff4dc;
  color: #8a5a06;
  font-size: 12px;
  font-weight: 700;
}

/* Submit */
.btn-submit {
  justify-self: stretch;
  min-height: 50px;
  padding: 12px 24px;
  border: 0;
  border-radius: 12px;
  background: var(--rv-primary);
  color: #fff;
  font: inherit;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: filter 0.15s ease, box-shadow 0.15s ease, transform 0.1s ease;
}

.btn-submit:hover:not(:disabled) {
  filter: brightness(1.08);
  box-shadow: 0 6px 16px rgb(16 24 40 / 18%);
}

.btn-submit:active:not(:disabled) {
  transform: translateY(1px);
}

.btn-submit:focus-visible {
  outline: 2px solid var(--rv-primary);
  outline-offset: 3px;
}

.btn-submit:disabled {
  opacity: 0.6;
  cursor: wait;
}

/* ---------- Responsive (same breakpoints as before) ---------- */
@media (max-width: 900px) {
  .reviews-list {
    max-height: 520px;
  }
}

@media (max-width: 650px) {
  .review-summary {
    grid-template-columns: minmax(0, 1fr);
    gap: 20px;
    padding: 18px;
  }

  .summary-score {
    padding-right: 0;
    padding-bottom: 18px;
    border-right: 0;
    border-bottom: 1px solid var(--rv-border);
  }

  .reviews-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .review-card {
    grid-template-columns: 36px minmax(0, 1fr);
    gap: 12px;
    padding: 14px;
  }

  .review-avatar {
    width: 36px;
    height: 36px;
    font-size: 12px;
  }

  .review-date {
    width: 100%;
    margin-left: 0;
  }

  .review-form {
    padding: 18px 16px;
  }

  .star-btn {
    font-size: 38px;
  }

  /* 16px stops iOS zooming into the field on focus */
  .review-form input:not([type='checkbox']),
  .review-form textarea,
  .sort-control select {
    font-size: 16px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .bar-fill,
  .star-btn,
  .review-card,
  .btn-submit,
  .btn-outline,
  .review-form input,
  .review-form textarea {
    transition: none;
  }
}

@media (max-width: 600px) {
  .variant-options-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}


@media (max-width: 650px) {
  .wishlist-heart {
    width: 42px;
    height: 42px;
  }
}


/* =========================
   Responsive
   ========================= */

@media (pointer: coarse) {
  .quantity-control button {
    width: 44px;
    height: 44px;
  }
}

@media (max-width: 1050px) {
  .product-layout {
    grid-template-columns: minmax(220px, .8fr) minmax(280px, 1.2fr);
  }

  .delivery-panel {
    grid-column: 1 / -1;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .delivery-panel section {
    border-right: 1px solid var(--color-border-soft, #e5e9f0);
    border-bottom: 0;
  }

  .delivery-panel section:last-child {
    border-right: 0;
  }
}

@media (max-width: 900px) {
  .reviews-layout {
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas:
      "form"
      "reviews";
  }

  .reviews-list {
    max-height: 520px;
  }
}

@media (max-width: 650px) {
  .product-page {
    padding-top: 18px;
  }

  .product-layout {
    grid-template-columns: minmax(0, 1fr);
    gap: 20px;
    padding: 16px;
  }

  .main-image {
    max-height: 380px;
  }

  .delivery-panel {
    grid-column: auto;
    grid-template-columns: minmax(0, 1fr);
  }

  .delivery-panel section {
    border-right: 0;
    border-bottom: 1px solid var(--color-border-soft, #e5e9f0);
  }

  .details-section {
    padding: 18px;
  }

  .action-buttons {
    grid-template-columns: minmax(0, 1fr);
  }

  .review-summary {
    grid-template-columns: minmax(0, 1fr);
    gap: 20px;
    padding: 18px;
  }

  .reviews-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .review-card {
    grid-template-columns: 36px minmax(0, 1fr);
    gap: 12px;
  }

  .review-avatar {
    width: 36px;
    height: 36px;
    font-size: 12px;
  }

  .review-date {
    margin-left: 0;
    width: 100%;
  }

  .review-form {
    padding: 16px;
  }

  .btn-submit {
    justify-self: stretch;
  }
}

@media (prefers-reduced-motion: reduce) {
  .option-body,
  .swatch-circle,
  .bar-fill,
  .star-btn,
  .action-buttons button {
    transition: none;
  }
}


/* Payment method price grid */

.payment-prices {
  margin: 20px 0 12px;
  padding-top: 14px;
  border-top: 1px solid var(--color-border-soft, #e5e9f0);
}

.payment-notice {
  margin-bottom: 10px;
  padding: 10px;
  border-radius: 8px;
  background: #f0f1f4;
  color: #424b5a;
  font-size: 12px;
  text-align: center;
}

.payment-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.payment-card {
  display: flex;
  min-width: 0;
  min-height: 108px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 9px 5px;
  border: 1px solid #72a9ff;
  border-radius: 10px;
  background: #fff;
  text-align: center;
}

.payment-heading {
  display: flex;
  height: 23px;
  align-items: center;
  justify-content: center;
}

.payment-heading svg {
  width: 23px;
  height: 23px;
}

.payment-card:nth-child(1) .payment-heading {
  color: #25845d;
}

.payment-card:nth-child(2) .payment-heading {
  color: #315a91;
}

.payment-heading img {
  width: 65px;
  height: 25px;
  object-fit: contain;
}

.card-logo {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 800;
  color: #183b76;
}

.mastercard-dot {
  display: inline-block;
  width: 11px;
  height: 11px;
  border-radius: 50%;
  background: #eb302e;
  box-shadow: 5px 0 0 #f5a623;
}

.payment-label {
  font-size: 10px;
  line-height: 1.2;
  color: #303846;
}

.payment-discount {
  padding: 2px 5px;
  border-radius: 2px;
  background: #ef493a;
  color: white;
  font-size: 8px;
  font-weight: 700;
}

.payment-amount {
  color: #273449;
  font-size: 16px;
  font-weight: 800;
  white-space: nowrap;
}

.payment-installment,
.payment-subtitle {
  color: #7d8794;
  font-size: 9px;
}

.pickup-option {
  display: flex;
  align-items: flex-start;
  gap: 11px;
  margin-top: 16px;
  padding: 12px;
  border: 1px solid var(--color-border-soft, #e5e9f0);
  border-radius: 9px;
}

.pickup-icon {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 8px;
  background: #edf3fc;
  color: var(--color-primary, #1f4a8a);
}

.pickup-icon svg {
  width: 19px;
  height: 19px;
}

.pickup-option strong {
  font-size: 12px;
}

.pickup-option p {
  margin-top: 4px;
  font-size: 11px;
}

@media (max-width: 400px) {
  .payment-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}


</style>
