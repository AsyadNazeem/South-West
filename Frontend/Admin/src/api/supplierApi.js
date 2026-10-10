import api from './axios';

const supplierApi = {
    // Get all suppliers
    getSuppliers: async (params = {}) => {
        const response = await api.get('/suppliers', {
            params
        });

        return response.data;
    },

    // Get supplier by ID
    getSupplierById: async (id) => {
        const response = await api.get(`/suppliers/${id}`);

        return response.data;
    },

    // Create supplier
    createSupplier: async (data) => {
        const response = await api.post('/suppliers', data);

        return response.data;
    },

    // Update supplier
    updateSupplier: async (id, data) => {
        const response = await api.put(`/suppliers/${id}`, data);

        return response.data;
    },

    // Delete supplier
    deleteSupplier: async (id) => {
        const response = await api.delete(`/suppliers/${id}`);

        return response.data;
    }
};

export default supplierApi;
