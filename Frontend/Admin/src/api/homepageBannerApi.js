
import api from './axios'

export const getHomepageBanners = () =>
  api.get('/homepage-banners')

export const getHomepageBanner = (id) =>
  api.get(`/homepage-banners/${id}`)

export const createHomepageBanner = (formData) =>
  api.post('/homepage-banners', formData)

export const updateHomepageBanner = (id, formData) =>
  api.put(`/homepage-banners/${id}`, formData)

export const updateHomepageBannerStatus = (id, isActive) =>
  api.patch(`/homepage-banners/${id}/status`, {
    is_active: isActive,
  })

export const deleteHomepageBanner = (id) =>
  api.delete(`/homepage-banners/${id}`)
