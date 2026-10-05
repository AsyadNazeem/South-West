import axios from 'axios'

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
})

// ===============================
// REQUEST INTERCEPTOR
// ===============================
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token')

        if (token) {
            config.headers = config.headers || {}
            config.headers.Authorization = `Bearer ${token}`
        }

        return config
    },
    (error) => {
        return Promise.reject(error)
    }
)

// ===============================
// RESPONSE INTERCEPTOR
// ===============================
api.interceptors.response.use(
    (response) => {
        return response
    },
    (error) => {
        const isLoginRequest = error.config?.url?.includes('/auth/login')

        if (error.response?.status === 401 && !isLoginRequest) {
            localStorage.removeItem('token')
            localStorage.removeItem('user')

            if (window.location.pathname !== '/login') {
                window.location.replace('/login')
            }
        }

        return Promise.reject(error)
    }
)

export default api
