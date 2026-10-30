import api from './axios'

const itemPriceApi = {
    getItemPrices: async () => {
        const response = await api.get('/item-prices')
        return response.data
    },

    getItemPriceById: async (id) => {
        const response = await api.get(`/item-prices/${id}`)
        return response.data
    }
}

export default itemPriceApi
