import api from './axios'

export const getFaqs = () => {
    return api.get('/faqs')
}

export const getFaqById = (id) => {
    return api.get(`/faqs/${encodeURIComponent(id)}`)
}

export const createFaq = (payload) => {
    return api.post('/faqs', payload)
}

export const updateFaq = (id, payload) => {
    return api.put(`/faqs/${encodeURIComponent(id)}`, payload)
}

export const updateFaqStatus = (id, isActive) => {
    return api.patch(
        `/faqs/${encodeURIComponent(id)}/status`,
        { is_active: isActive }
    )
}

export const deleteFaq = (id) => {
    return api.delete(`/faqs/${encodeURIComponent(id)}`)
}
