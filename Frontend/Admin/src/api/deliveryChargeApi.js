import api from './axios'

const deliveryChargeApi = {

    getDeliveryCharges: async (params = {}) => {
        const response = await api.get('/delivery-charges', { params })
        return response.data
    },

    getDeliveryCharge: async (id) => {
        const response = await api.get(`/delivery-charges/${id}`)
        return response.data
    },

    createDeliveryCharge: async (data) => {
        const response = await api.post('/delivery-charges', data)
        return response.data
    },

    updateDeliveryCharge: async (id, data) => {
        const response = await api.put(`/delivery-charges/${id}`, data)
        return response.data
    },

    deleteDeliveryCharge: async (id) => {
        const response = await api.delete(`/delivery-charges/${id}`)
        return response.data
    }

}

export default deliveryChargeApi
