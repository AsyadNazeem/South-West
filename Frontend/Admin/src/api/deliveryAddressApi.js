// api/deliveryAddressApi.js
import api from './axios'

const customerAddressApi = {
    // All addresses of one customer
    getCustomerAddresses: async (customerId) => {
        const response = await api.get(`/customers/${customerId}/addresses`)
        return response.data
    },

    // Single address -> GET /customers/address/:addressId
    getAddressById: async (addressId) => {
        const response = await api.get(`/customers/address/${addressId}`)
        return response.data
    },

    createAddress: async (customerId, data) => {
        const response = await api.post(`/customers/${customerId}/addresses`, data)
        return response.data
    },

    updateAddress: async (customerId, addressId, data) => {
        const response = await api.put(
            `/customers/${customerId}/addresses/${addressId}`,
            data
        )
        return response.data
    },

    deleteAddress: async (customerId, addressId) => {
        const response = await api.delete(
            `/customers/${customerId}/addresses/${addressId}`
        )
        return response.data
    }
}

export default customerAddressApi
