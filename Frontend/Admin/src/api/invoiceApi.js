import api from './axios'

const invoiceApi = {
    // Get all invoices
    getInvoices: async (params = {}) => {
        const response = await api.get('/invoices', {
            params
        })

        return response.data
    },

    // Get invoice by ID
    getInvoiceById: async (id) => {
        const response = await api.get(`/invoices/${id}`)

        return response.data
    },

    // Create invoice
    createInvoice: async (data) => {
        const response = await api.post('/invoices', data)

        return response.data
    },

    // Update invoice
    updateInvoice: async (id, data) => {
        const response = await api.put(`/invoices/${id}`, data)

        return response.data
    },

    // Delete invoice
    deleteInvoice: async (id) => {
        const response = await api.delete(`/invoices/${id}`)

        return response.data
    }
}

export default invoiceApi
