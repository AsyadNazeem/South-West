import api from './axios'

const deliveryApi = {
    getDeliveries: async (params = {}) => {
        const response = await api.get('/deliveries', {
            params
        })

        return response.data
    },

    getDeliveryById: async (id) => {
        const response = await api.get(`/deliveries/${id}`)

        return response.data
    },

    updateDelivery: async (id, data) => {
        const response = await api.put(
            `/deliveries/${id}`,
            data
        )

        return response.data
    },

    deleteDelivery: async (id) => {
        const response = await api.delete(
            `/deliveries/${id}`
        )

        return response.data
    }
}

export default deliveryApi
