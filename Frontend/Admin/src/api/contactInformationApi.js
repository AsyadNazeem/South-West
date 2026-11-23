import api from './axios'

export const getContactInformation = () => {
  return api.get('/contact-information')
}

export const updateContactInformation = (payload) => {
  return api.put('/contact-information', payload)
}
