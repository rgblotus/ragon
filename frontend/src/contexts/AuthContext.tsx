// Modernized AuthContext using shared API service and types
import React, { createContext, useContext, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi, apiUtils } from '../services/api'
import { storage, STORAGE_KEYS } from '../utils/storage'
import type {
    User,
    UserLogin,
    UserUpdate,
} from '../types/api'

interface AuthContextType {
    user: User | null
    token: string | null
    isAuthenticated: boolean
    isLoading: boolean
    error: string | null
    login: (email: string, password: string) => Promise<void>
    register: (
        email: string,
        password: string,
        fullName: string
    ) => Promise<void>
    updateUser: (data: UserUpdate) => Promise<void>
    logout: () => Promise<void>
    clearError: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    const [user, setUser] = useState<User | null>(null)
    const [token, setToken] = useState<string | null>(
        apiUtils.isAuthenticated() ? localStorage.getItem('token') : null
    )
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const navigate = useNavigate()

    // Clear error function
    const clearError = () => setError(null)

    // Initialize auth state on mount
    useEffect(() => {
        const initializeAuth = async () => {
            if (!token) {
                setIsLoading(false)
                return
            }

            try {
                const currentUser = await authApi.getCurrentUser()
                setUser(currentUser)
            } catch (error) {
                console.error('Failed to fetch current user:', error)
                handleLogout()
            } finally {
                setIsLoading(false)
            }
        }

        initializeAuth()
    }, [token])

    const handleLogout = async () => {
        try {
            await authApi.logout()
        } catch (error) {
            console.error('Logout API call failed:', error)
        }
        setUser(null)
        setToken(null)
        localStorage.removeItem('token')
        Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key))
        navigate('/')
    }

    const handleLogin = async (email: string, password: string) => {
        try {
            setIsLoading(true)
            setError(null)

            const credentials: UserLogin = { email, password }
            const tokenResponse = await authApi.login(credentials)

            setToken(tokenResponse.access_token)
            localStorage.setItem('token', tokenResponse.access_token)

            const currentUser = await authApi.getCurrentUser()
            setUser(currentUser)

            navigate('/dashboard')
        } catch (err) {
            const apiError = err as { detail?: string }
            setError(apiError.detail || 'Login failed')
            throw err
        } finally {
            setIsLoading(false)
        }
    }

    const handleRegister = async (
        email: string,
        password: string,
        fullName: string,
    ) => {
        try {
            setIsLoading(true)
            setError(null)

            await authApi.register({
                email,
                password,
                confirm_password: password,
                full_name: fullName,
            })

            await handleLogin(email, password)
        } catch (err) {
            const apiError = err as { detail?: string }
            setError(apiError.detail || 'Registration failed')
            throw err
        } finally {
            setIsLoading(false)
        }
    }

    const handleUpdateUser = async (userData: UserUpdate) => {
        try {
            setIsLoading(true)
            setError(null)

            const updatedUser = await authApi.updateUser(userData)
            setUser(updatedUser)
        } catch (err) {
            const apiError = err as { detail?: string }
            setError(apiError.detail || 'Update failed')
            throw err
        } finally {
            setIsLoading(false)
        }
    }

    const value: AuthContextType = {
        user,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        error,
        login: handleLogin,
        register: handleRegister,
        updateUser: handleUpdateUser,
        logout: handleLogout,
        clearError,
    }

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}
