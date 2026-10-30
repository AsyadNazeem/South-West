
import api from './axios'

const invoiceApi = {
    getInvoices: async (params = {}) => {
        const response = await api.get('/invoices', {
            params
        })

        return response.data
    },

    getInvoiceById: async (id) => {
        const response = await api.get(`/invoices/${id}`)
        return response.data
    }
}

export default invoiceApi
