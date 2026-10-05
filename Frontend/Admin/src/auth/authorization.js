import { reactive } from 'vue'
import {
    getCurrentUser,
    logout as logoutRequest
} from '../api/authApi'

const TOKEN_KEY = 'token'
const USER_KEY = 'user'

export const authorizationState = reactive({
    user: null,
    initialized: false,
    loading: false
})

let authorizationRequest = null

const normalizeUser = (user) => ({
    id: user.id,
    email: user.email,
    is_active: user.is_active,
    roles: Array.isArray(user.roles) ? user.roles : [],
    permissions: [...new Set(Array.isArray(user.permissions) ? user.permissions : [])]
})

export const getAccessToken = () => localStorage.getItem(TOKEN_KEY)

export const setAuthenticatedSession = ({ token, user }) => {
    const authorizedUser = normalizeUser(user)

    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(USER_KEY, JSON.stringify(authorizedUser))

    authorizationState.user = authorizedUser
    authorizationState.initialized = true
}

export const clearAuthentication = () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)

    authorizationState.user = null
    authorizationState.initialized = true
}

export const refreshAuthorization = async () => {
    if (!getAccessToken()) {
        authorizationState.user = null
        authorizationState.initialized = true
        return null
    }

    if (authorizationRequest) {
        return authorizationRequest
    }

    authorizationState.loading = true

    authorizationRequest = getCurrentUser()
        .then((user) => {
            const authorizedUser = normalizeUser(user)

            localStorage.setItem(USER_KEY, JSON.stringify(authorizedUser))
            authorizationState.user = authorizedUser
            authorizationState.initialized = true

            return authorizedUser
        })
        .catch((error) => {
            authorizationState.user = null
            authorizationState.initialized = true

            throw error
        })
        .finally(() => {
            authorizationState.loading = false
            authorizationRequest = null
        })

    return authorizationRequest
}

export const ensureAuthorization = async () => {
    if (authorizationState.initialized) {
        return authorizationState.user
    }

    return refreshAuthorization()
}

export const hasPermission = (permission) => {
    return Boolean(
        authorizationState.user?.permissions?.includes(permission)
    )
}

export const hasAnyPermission = (permissions) => {
    return permissions.some((permission) => hasPermission(permission))
}

export const hasAllPermissions = (permissions) => {
    return permissions.every((permission) => hasPermission(permission))
}

export const logout = async () => {
    try {
        if (getAccessToken()) {
            await logoutRequest()
        }
    } finally {
        clearAuthentication()
    }
}
