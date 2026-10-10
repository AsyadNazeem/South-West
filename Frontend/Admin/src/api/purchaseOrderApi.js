import api from './axios'

// Get all Purchase Orders
export const getPurchaseOrders = (params = {}) => {
    return api.get('/purchase-orders', { params })
}

// Get Purchase Order by ID
export const getPurchaseOrderById = (id) => {
    return api.get(`/purchase-orders/${id}`)
}

// Create Purchase Order
export const createPurchaseOrder = (data) => {
    return api.post('/purchase-orders', data)
}

// Update Purchase Order
export const updatePurchaseOrder = (id, data) => {
    return api.put(`/purchase-orders/${id}`, data)
}

// Submit Purchase Order
export const submitPurchaseOrder = (id) => {
    return api.post(`/purchase-orders/${id}/submit`)
}

// Approve Purchase Order
export const approvePurchaseOrder = (id) => {
    return api.post(`/purchase-orders/${id}/approve`)
}

// Cancel Purchase Order
export const cancelPurchaseOrder = (id) => {
    return api.post(`/purchase-orders/${id}/cancel`)
}

// Delete Purchase Order
export const deletePurchaseOrder = (id) => {
    return api.delete(`/purchase-orders/${id}`)
}

// Object form
const purchaseOrderApi = {
    getAll: getPurchaseOrders,
    getById: getPurchaseOrderById,
    create: createPurchaseOrder,
    update: updatePurchaseOrder,
    submit: submitPurchaseOrder,
    approve: approvePurchaseOrder,
    cancel: cancelPurchaseOrder,
    delete: deletePurchaseOrder
}

export default purchaseOrderApi
