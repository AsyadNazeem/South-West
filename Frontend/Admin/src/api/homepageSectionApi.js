import api from './axios'

export const getHomepageSections = () => {
  return api.get('/homepage-sections')
}

export const updateHomepageSections = (sections) => {
  return api.put('/homepage-sections', {
    sections,
  })
}
