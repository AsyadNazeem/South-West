import axios from 'axios'

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL,
})

const LAST_ACTIVITY_KEY = 'admin_last_activity'

api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token')

        if (token) {
            config.headers = config.headers || {}
            config.headers.Authorization = `Bearer ${token}`

            const lastActivity = localStorage.getItem(LAST_ACTIVITY_KEY)

            if (lastActivity) {
                config.headers['X-User-Activity-At'] = lastActivity
            }
        }

        return config
    },
    (error) => Promise.reject(error)
)

api.interceptors.response.use(
    (response) => response,
    (error) => {
        const isLoginRequest =
            error.config?.url?.includes('/auth/login')

        if (
            error.response?.status === 401 &&
            !isLoginRequest
        ) {
            localStorage.removeItem('token')
            localStorage.removeItem('user')
            localStorage.removeItem(LAST_ACTIVITY_KEY)

            if (window.location.pathname !== '/login') {
                window.location.replace('/login')
            }
        }

        return Promise.reject(error)
    }
)

export default api
