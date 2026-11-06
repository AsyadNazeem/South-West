import { ref } from 'vue'

const DEFAULT_PAGE_SIZES = [10, 25, 50, 100]

function normalizePositiveInteger(value, fallback) {
  const number = Number(value)
  return Number.isSafeInteger(number) && number > 0 ? number : fallback
}

export function createRequestSequence() {
  let latestRequestId = 0
  return {
    begin: () => ++latestRequestId,
    isCurrent: requestId => requestId === latestRequestId,
    invalidate: () => { latestRequestId += 1 }
  }
}

export function useServerPagination(initialPageSize = 25, onChange = () => {}, options = {}) {
  const pageSizeOptions = [...new Set((options.pageSizeOptions || DEFAULT_PAGE_SIZES)
    .map(Number)
    .filter(value => Number.isSafeInteger(value) && value > 0))]
  const validPageSizes = pageSizeOptions.length ? pageSizeOptions : DEFAULT_PAGE_SIZES
  const startingPageSize = validPageSizes.includes(Number(initialPageSize))
    ? Number(initialPageSize)
    : validPageSizes[0]

  const page = ref(1)
  const pageSize = ref(startingPageSize)
  const total = ref(0)
  const totalPages = ref(1)
  let requestSequence = 0

  const params = () => ({ page: page.value, pageSize: pageSize.value })

  const receive = (value = {}) => {
    const receivedTotal = Number(value.total)
    total.value = Number.isSafeInteger(receivedTotal) && receivedTotal >= 0 ? receivedTotal : 0

    const receivedSize = Number(value.pageSize)
    if (Number.isSafeInteger(receivedSize) && validPageSizes.includes(receivedSize)) {
      pageSize.value = receivedSize
    }

    const derivedPages = Math.ceil(total.value / pageSize.value)
    const receivedPages = Number(value.totalPages)
    totalPages.value = value.totalPages !== null && value.totalPages !== undefined && Number.isSafeInteger(receivedPages) && receivedPages >= 0
      ? Math.max(1, receivedPages)
      : Math.max(1, derivedPages)

    const receivedPage = normalizePositiveInteger(value.page, page.value)
    page.value = Math.min(receivedPage, totalPages.value)

    return { page: page.value, pageSize: pageSize.value, total: total.value, totalPages: totalPages.value }
  }

  const beginRequest = () => ++requestSequence
  const isCurrentRequest = requestId => requestId === requestSequence
  const invalidateRequests = () => { requestSequence += 1 }

  const goToPage = async value => {
    const next = Number(value)
    if (!Number.isSafeInteger(next) || next < 1 || next > totalPages.value || next === page.value) return false
    page.value = next
    await onChange()
    return true
  }

  const changePageSize = async value => {
    const nextSize = Number(value)
    if (!Number.isSafeInteger(nextSize) || !validPageSizes.includes(nextSize) || nextSize === pageSize.value) return false
    pageSize.value = nextSize
    page.value = 1
    await onChange()
    return true
  }

  return {
    page, pageSize, total, totalPages, pageSizeOptions: validPageSizes,
    params, receive, goToPage, changePageSize,
    beginRequest, isCurrentRequest, invalidateRequests
  }
}
