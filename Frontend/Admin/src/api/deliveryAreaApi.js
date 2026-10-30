import api from './axios'

const deliveryAreaApi = {

    // Get all delivery areas
    getDeliveryAreas: async (params = {}) => {
        const response = await api.get(
            '/delivery-areas',
            { params }
        )

        return response.data
    },

    // Get one delivery area
    getDeliveryAreaById: async (id) => {
        const response = await api.get(
            `/delivery-areas/${id}`
        )

        return response.data
    },

    // Get areas belonging to a district
    getAreasByDistrict: async (districtId) => {
        const response = await api.get(
            '/delivery-areas',
            {
                params: {
                    district_id: districtId
                }
            }
        )

        return response.data
    },

    // Create delivery area
    createDeliveryArea: async (data) => {
        const response = await api.post(
            '/delivery-areas',
            data
        )

        return response.data
    },

    // Update delivery area
    updateDeliveryArea: async (id, data) => {
        const response = await api.put(
            `/delivery-areas/${id}`,
            data
        )

        return response.data
    },

    // Delete delivery area
    deleteDeliveryArea: async (id) => {
        const response = await api.delete(
            `/delivery-areas/${id}`
        )

        return response.data
    },

    // Calculate delivery charge
    calculateCharge: async (data) => {
        const response = await api.post(
            '/delivery-areas/calculate',
            data
        )

        return response.data
    }
}

export default deliveryAreaApi
