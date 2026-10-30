import api from './axios'

export const getInventoryLocations = (params = {}) => {
    return api.get('/inventory-locations', {
        params
    })
}

export const getInventoryLocationById = (id) => {
    return api.get(`/inventory-locations/${id}`)
}

export const createInventoryLocation = (data) => {
    return api.post('/inventory-locations', data)
}

export const updateInventoryLocation = (id, data) => {
    return api.put(`/inventory-locations/${id}`, data)
}

export const deleteInventoryLocation = (id) => {
    return api.delete(`/inventory-locations/${id}`)
}
