import api from './axios'

const BASE_URL = '/website-themes'

export const getWebsiteThemes = (params = {}) =>
    api.get(BASE_URL, { params })

export const updateWebsiteThemeStatus = (id, is_active) =>
    api.patch(`${BASE_URL}/${id}/status`, { is_active })
