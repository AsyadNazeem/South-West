
import api from './axios'

const isValidId = (value) =>
    (typeof value === 'string' || typeof value === 'number') &&
    /^[1-9]\d*$/.test(String(value)) &&
    Number.isSafeInteger(Number(value))

const requireValidId = (value, fieldName) => {
    if (!isValidId(value)) {
        throw new Error(`Invalid ${fieldName}`)
    }
}

const customerAddressApi = {
    getCustomerAddresses: async (customerId) => {
        requireValidId(customerId, 'customer ID')
        const response = await api.get(
            `/customers/${customerId}/addresses`
        )
        return response.data
    },

    getAddressById: async (addressId) => {
        requireValidId(addressId, 'address ID')
        const response = await api.get(
            `/customers/address/${addressId}`
        )
        return response.data
    },

    createAddress: async (customerId, data) => {
        requireValidId(customerId, 'customer ID')
        const response = await api.post(
            `/customers/${customerId}/addresses`,
            data
        )
        return response.data
    },

    updateAddress: async (customerId, addressId, data) => {
        requireValidId(customerId, 'customer ID')
        requireValidId(addressId, 'address ID')
        const response = await api.put(
            `/customers/${customerId}/addresses/${addressId}`,
            data
        )
        return response.data
    },

    deleteAddress: async (customerId, addressId) => {
        requireValidId(customerId, 'customer ID')
        requireValidId(addressId, 'address ID')
        const response = await api.delete(
            `/customers/${customerId}/addresses/${addressId}`
        )
        return response.data
    }
}

export default customerAddressApi
