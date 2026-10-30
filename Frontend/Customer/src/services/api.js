
import axios from 'axios'

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 15000,
})

// Attach the customer token to protected API requests.
api.interceptors.request.use(
    config => {
        const token = sessionStorage.getItem('customerToken')

        if (token) {
            config.headers.Authorization = `Bearer ${token}`
        } else {
            delete config.headers.Authorization
        }

        return config
    },
    error => Promise.reject(error),
)

export default api
