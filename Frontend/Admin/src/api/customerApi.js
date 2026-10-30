import api from './axios'

const customerApi = {

    // Get all customers
    getCustomers: async (params = {}) => {
        const response = await api.get('/customers', {
            params
        })

        return response.data
    },

    // Get customer by ID
    getCustomer: async (id) => {
        const response = await api.get(`/customers/${id}`)

        return response.data
    },

    // Create customer
    createCustomer: async (data) => {
        const response = await api.post('/customers', data)

        return response.data
    },

    // Update customer
    updateCustomer: async (id, data) => {
        const response = await api.put(`/customers/${id}`, data)

        return response.data
    },

    // Delete customer
    deleteCustomer: async (id) => {
        const response = await api.delete(`/customers/${id}`)

        return response.data
    }
}

export default customerApi
