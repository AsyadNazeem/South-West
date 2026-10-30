import api from './axios'

const orderApi = {
    getOrders: async (params = {}) => {
        const response = await api.get('/orders', {
            params
        })

        return response.data
    },

    getOrderById: async (id) => {
        const response = await api.get(`/orders/${id}`)

        return response.data
    },

    updateOrderStatus: async (id, payload) => {
        const response = await api.patch(`/orders/${id}/status`, payload)
        return response.data
    },

    deleteOrder: async (id) => {
        const response = await api.delete(`/orders/${id}`)

        return response.data
    }
}

export default orderApi
