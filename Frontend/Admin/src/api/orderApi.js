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

    createOrder: async (data) => {
        const response = await api.post('/orders', data)

        return response.data
    },

    updateOrder: async (id, data) => {
        const response = await api.put(`/orders/${id}`, data)

        return response.data
    },

    deleteOrder: async (id) => {
        const response = await api.delete(`/orders/${id}`)

        return response.data
    }
}

export default orderApi
