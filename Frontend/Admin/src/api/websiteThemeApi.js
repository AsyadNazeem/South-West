import api from './axios'

const BASE_URL = '/website-themes'

export const getWebsiteThemes = (params = {}) =>
    api.get(BASE_URL, { params })

export const createWebsiteTheme = payload =>
    api.post(BASE_URL, payload)

export const updateWebsiteTheme = (id, payload) =>
    api.put(`${BASE_URL}/${id}`, payload)

export const updateWebsiteThemeStatus = (id, is_active) =>
    api.patch(`${BASE_URL}/${id}/status`, { is_active })

export const deleteWebsiteTheme = id =>
    api.delete(`${BASE_URL}/${id}`)
