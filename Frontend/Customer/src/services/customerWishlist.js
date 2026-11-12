import { ref } from 'vue'

// Shared by every ProductCard instance in this browser tab.
let cachedToken = null
let cacheLoaded = false
let pendingRequest = null
const cachedItemIds = ref(new Set())

export async function getCustomerWishlistItemIds(api) {
  const token = sessionStorage.getItem('customerToken')

  if (!token) {
    cachedToken = null
    cacheLoaded = false
    pendingRequest = null
    cachedItemIds.value = new Set()
    return cachedItemIds.value
  }

  if (cachedToken !== token) {
    cachedToken = token
    cacheLoaded = false
    pendingRequest = null
    cachedItemIds.value = new Set()
  }

  if (cacheLoaded) return cachedItemIds.value
  if (pendingRequest) return pendingRequest

  pendingRequest = api.get('/customer-wishlist')
    .then(response => {
      const entries = Array.isArray(response.data?.data)
        ? response.data.data
        : []

      cachedItemIds.value = new Set(
        entries
          .map(entry =>
            entry?.item?.id ??
            entry?.Item?.id ??
            entry?.item_id ??
            null
          )
          .filter(id => id !== null && id !== undefined)
          .map(String)
      )

      cacheLoaded = true
      return cachedItemIds.value
    })
    .catch(error => {
      cacheLoaded = false
      throw error
    })
    .finally(() => {
      pendingRequest = null
    })

  return pendingRequest
}

export function updateCustomerWishlistItem(itemId, wishlisted) {
  if (itemId === null || itemId === undefined) return

  const nextIds = new Set(cachedItemIds.value)
  const id = String(itemId)

  if (wishlisted) {
    nextIds.add(id)
  } else {
    nextIds.delete(id)
  }

  cachedItemIds.value = nextIds
  cacheLoaded = true
  cachedToken = sessionStorage.getItem('customerToken')
}
