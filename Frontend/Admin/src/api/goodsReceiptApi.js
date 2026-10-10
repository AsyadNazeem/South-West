import api from './axios'

export const getGoodsReceipts = (params = {}) => {
return api.get('/goods-receipts', {
params
})
}

export const getGoodsReceiptById = (id) => {
return api.get(`/goods-receipts/${id}`)
}

export const createGoodsReceipt = (data) => {
return api.post('/goods-receipts', data)
}

export const updateGoodsReceipt = (id, data) => {
return api.put(`/goods-receipts/${id}`, data)
}

export const receiveGoodsReceipt = (id) => {
return api.post(`/goods-receipts/${id}/receive`)
}

export const cancelGoodsReceipt = (id) => {
return api.post(`/goods-receipts/${id}/cancel`)
}

export const deleteGoodsReceipt = (id) => {
return api.delete(`/goods-receipts/${id}`)
}
