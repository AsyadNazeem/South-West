import api from './axios'

const deliveryDistrictApi = {
    getDistricts: async (params = {}) => {
        const response = await api.get(
            '/delivery-districts',
            { params }
        )

        return response.data
    },

    getDistrictById: async (id) => {
        const response = await api.get(
            `/delivery-districts/${id}`
        )

        return response.data
    },

    createDistrict: async (data) => {
        const response = await api.post(
            '/delivery-districts',
            data
        )

        return response.data
    },

    updateDistrict: async (id, data) => {
        const response = await api.put(
            `/delivery-districts/${id}`,
            data
        )

        return response.data
    },

    deleteDistrict: async (id) => {
        const response = await api.delete(
            `/delivery-districts/${id}`
        )

        return response.data
    }
}

export default deliveryDistrictApi
