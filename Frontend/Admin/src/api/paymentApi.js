import api from './axios'

const paymentApi = {
    getPayments: async (params = {}) => {
        const response = await api.get('/payments', {
            params
        })

        return response.data
    },

    getPaymentById: async (id) => {
        const response = await api.get(`/payments/${id}`)

        return response.data
    },

    createPayment: async (data) => {
        const response = await api.post('/payments', data)

        return response.data
    },

    updatePayment: async (id, data) => {
        const response = await api.put(`/payments/${id}`, data)

        return response.data
    },

    deletePayment: async (id) => {
        const response = await api.delete(`/payments/${id}`)

        return response.data
    },

    updatePaymentStatus: async (id, payment_status) => {
        const response = await api.patch(
            `/payments/${id}/status`,
            { payment_status }
        )

        return response.data
    }
}

export default paymentApi
