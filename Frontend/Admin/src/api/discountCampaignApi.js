
import api from './axios'

const BASE_URL = '/discount-campaigns'

export const getDiscountCampaigns = () =>
    api.get(BASE_URL)

export const getDiscountCampaign = (id) =>
    api.get(`${BASE_URL}/${id}`)

export const createDiscountCampaign = (payload) =>
    api.post(BASE_URL, payload)

export const updateDiscountCampaign = (id, payload) =>
    api.put(`${BASE_URL}/${id}`, payload)

export const updateDiscountCampaignStatus = (id, status) =>
    api.patch(`${BASE_URL}/${id}/status`, { status })

export const deleteDiscountCampaign = (id) =>
    api.delete(`${BASE_URL}/${id}`)
