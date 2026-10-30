import api from './axios'

const BASE = '/reports'

export const reportDefinitions = {
  sales: [
    { id: 'summary', label: 'Sales Summary', endpoint: 'sales/summary', dated: true },
    { id: 'daily', label: 'Daily Sales', endpoint: 'sales/daily', dated: true },
    { id: 'monthly', label: 'Monthly Sales', endpoint: 'sales/monthly', dated: true }
  ],
  payments: [
    { id: 'collection', label: 'Payment Collection', endpoint: 'payments/collection', dated: true },
    { id: 'methods', label: 'Payment Methods', endpoint: 'payments/methods', dated: true },
    { id: 'transactions', label: 'Transactions', endpoint: 'payments/transactions', dated: true },
    { id: 'refunds', label: 'Refund Status', endpoint: 'payments/refunds', dated: true }
  ],
  products: [
    { id: 'summary', label: 'Product Sales Summary', endpoint: 'products/summary', dated: true },
    { id: 'best-sellers', label: 'Best Sellers', endpoint: 'products/best-sellers', dated: true },
    { id: 'least-sellers', label: 'Least Sellers', endpoint: 'products/least-sellers', dated: true },
    { id: 'categories', label: 'Category Sales', endpoint: 'products/categories', dated: true },
    { id: 'brands', label: 'Brand Sales', endpoint: 'products/brands', dated: true },
    { id: 'variants', label: 'Variant Sales', endpoint: 'products/variants', dated: true }
  ],
  inventory: [
    { id: 'summary', label: 'Stock Summary', endpoint: 'inventory/summary', dated: false },
    { id: 'low-stock', label: 'Low Stock', endpoint: 'inventory/low-stock', dated: false },
    { id: 'out-of-stock', label: 'Out of Stock', endpoint: 'inventory/out-of-stock', dated: false },
    { id: 'by-location', label: 'Stock by Location', endpoint: 'inventory/by-location', dated: false },
    { id: 'movements', label: 'Stock Movements', endpoint: 'inventory/movements', dated: true },
    { id: 'adjustments', label: 'Stock Adjustments', endpoint: 'inventory/adjustments', dated: true }
  ]
}

export async function fetchReport(endpoint, params = {}) {
  const response = await api.get(`${BASE}/${endpoint}`, { params })
  return response.data?.data ?? {}
}

export async function exportReport(endpoint, params = {}) {
  const response = await api.get(`${BASE}/${endpoint}/export`, {
    params,
    responseType: 'blob'
  })

  const disposition = response.headers?.['content-disposition'] || ''
  const match = disposition.match(/filename="?([^"]+)"?/i)
  const filename = match?.[1] || `${endpoint.replaceAll('/', '-')}.xlsx`

  const blob = new Blob(
    [response.data],
    {
      type: response.headers?.['content-type'] ||
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    }
  )

  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()

  window.URL.revokeObjectURL(url)
}
