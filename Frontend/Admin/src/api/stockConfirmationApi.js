import api from './axios'

export const getStockConfirmation = () => {
  return api.get('/stock-confirmation')
}

export const updateStockConfirmation = (payload) => {
  return api.put('/stock-confirmation', payload)
}
