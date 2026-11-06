
import axios from 'axios'

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 15000,
})

let progressRequestId = 0
function dispatchProgress(type, id) {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(`southwest:progress-${type}`, { detail: { id } }))
    }
}

// Attach the customer token to protected API requests.
api.interceptors.request.use(
    config => {
        try {
            if (config.method?.toLowerCase() === 'get') {
                config._progressId = ++progressRequestId
                dispatchProgress('start', config._progressId)
            }
            let token = null
            try {
                token = globalThis.sessionStorage?.getItem('customerToken') || null
            } catch {
                token = null
            }

            if (token) {
                config.headers.Authorization = `Bearer ${token}`
            } else {
                delete config.headers.Authorization
            }

            return config
        } catch (error) {
            if (config._progressId) dispatchProgress('end', config._progressId)
            return Promise.reject(error)
        }
    },
    error => Promise.reject(error),
)

api.interceptors.response.use(
    response => {
        if (response.config?._progressId) dispatchProgress('end', response.config._progressId)
        return response
    },
    error => {
        if (error.config?._progressId) dispatchProgress('end', error.config._progressId)
        return Promise.reject(error)
    },
)

export default api
