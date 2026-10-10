import api from './axios';

const itemApi = {
    // Get all items
    getItems: async (params = {}) => {
        const response = await api.get('/items', {
            params
        });

        return response.data;
    },

    // Get item by ID
    getItemById: async (id) => {
        const response = await api.get(`/items/${id}`);

        return response.data;
    },

    // Create item
    createItem: async (data) => {
        const response = await api.post('/items', data);

        return response.data;
    },

    // Update item
    updateItem: async (id, data) => {
        const response = await api.put(`/items/${id}`, data);

        return response.data;
    },

    // Delete item
    deleteItem: async (id) => {
        const response = await api.delete(`/items/${id}`);

        return response.data;
    }
};

export default itemApi;
