import { reactive } from 'vue'
import {
    getCurrentUser,
    logout as logoutRequest
} from '../api/authApi'

const TOKEN_KEY = 'token'
const USER_KEY = 'user'
const LAST_ACTIVITY_KEY = 'admin_last_activity'

export const authorizationState = reactive({
    user: null,
    initialized: false,
    loading: false
})

let authorizationRequest = null

const normalizeUser = (user) => {
    const roles = Array.isArray(user?.roles)
        ? user.roles
        : []

    const permissions = [
        ...(Array.isArray(user?.permissions)
            ? user.permissions
            : []),

        ...roles.flatMap((role) =>
            Array.isArray(role?.permissions)
                ? role.permissions.map((permission) =>
                    typeof permission === 'string'
                        ? permission
                        : permission?.name
                )
                : []
        )
    ].filter(Boolean)

    return {
        id: user?.id ?? null,
        email: user?.email ?? null,
        is_active: user?.is_active ?? false,
        roles,
        permissions: [...new Set(permissions)]
    }
}

export const getAccessToken = () => {
    return localStorage.getItem(TOKEN_KEY)
}

export const setAuthenticatedSession = ({ token, user }) => {
    const authorizedUser = normalizeUser(user)

    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()))
    localStorage.setItem(
        USER_KEY,
        JSON.stringify(authorizedUser)
    )

    authorizationState.user = authorizedUser
    authorizationState.initialized = true
}

export const clearAuthentication = () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    localStorage.removeItem(LAST_ACTIVITY_KEY)

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

            localStorage.setItem(
                USER_KEY,
                JSON.stringify(authorizedUser)
            )

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
    if (!Array.isArray(permissions)) {
        return false
    }

    return permissions.some((permission) =>
        hasPermission(permission)
    )
}

export const hasAllPermissions = (permissions) => {
    if (!Array.isArray(permissions)) {
        return false
    }

    return permissions.every((permission) =>
        hasPermission(permission)
    )
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
