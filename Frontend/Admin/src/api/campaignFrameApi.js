import api from './axios'

const BASE_URL = '/campaign-frames'

export const getCampaignFrames = () =>
    api.get(BASE_URL)

export const createCampaignFrame = (name, file) => {
    const formData = new FormData()
    formData.append('name', name)
    formData.append('frame', file)

    return api.post(BASE_URL, formData)
}

export const updateCampaignFrame = (id, { name, file }) => {
    const formData = new FormData()

    if (name !== undefined) formData.append('name', name)
    if (file) formData.append('frame', file)

    return api.put(`${BASE_URL}/${id}`, formData)
}

export const updateCampaignFrameStatus = (id, is_active) =>
    api.patch(`${BASE_URL}/${id}/status`, { is_active })

export const deleteCampaignFrame = id =>
    api.delete(`${BASE_URL}/${id}`)
