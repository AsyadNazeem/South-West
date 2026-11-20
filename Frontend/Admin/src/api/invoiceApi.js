
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
    },

    getInvoicePdf: async (id, download = false) => {
        const response = await api.get(`/invoices/${id}/pdf`, {
            params: download ? { download: 1 } : undefined,
            responseType: 'blob'
        })
        return response
    }
}

export default invoiceApi
