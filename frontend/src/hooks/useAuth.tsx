/**
 * useAuth Hook - Authentication context provider
 */
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '../services/api'
import { storage, STORAGE_KEYS } from '../utils/storage'
import type { User, UserUpdate } from '../types/api'
import { errorHandler } from '../utils/errorHandler'

interface AuthContextType {
    user: User | null
    token: string | null
    isAuthenticated: boolean
    isLoading: boolean
    error: string | null
    login: (email: string, password: string) => Promise<void>
    register: (email: string, password: string, fullName: string) => Promise<void>
    updateUser: (data: UserUpdate) => Promise<void>
    logout: () => void
    clearError: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [token, setToken] = useState<string | null>(
        localStorage.getItem('token')
    )
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const navigate = useNavigate()

    const clearError = useCallback(() => setError(null), [])

    useEffect(() => {
        if (!token) {
            setIsLoading(false)
            return
        }

        const initAuth = async () => {
            try {
                const currentUser = await authApi.getCurrentUser()
                setUser(currentUser)
            } catch {
                handleLogout()
            } finally {
                setIsLoading(false)
            }
        }

        initAuth()
    }, [token])

    const handleLogin = async (email: string, password: string) => {
        try {
            setIsLoading(true)
            setError(null)
            const tokenResponse = await authApi.login({ email, password })
            setToken(tokenResponse.access_token)
            localStorage.setItem('token', tokenResponse.access_token)
            const currentUser = await authApi.getCurrentUser()
            setUser(currentUser)
            navigate('/dashboard')
        } catch (err) {
            const apiError = errorHandler.handleApiError(err)
            setError(apiError.message || 'Login failed')
            throw err
        } finally {
            setIsLoading(false)
        }
    }

    const handleRegister = async (email: string, password: string, fullName: string) => {
        try {
            setIsLoading(true)
            setError(null)
            await authApi.register({ email, password, confirm_password: password, full_name: fullName })
            await handleLogin(email, password)
        } catch (err) {
            const apiError = errorHandler.handleApiError(err)
            setError(apiError.message || 'Registration failed')
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
            const apiError = errorHandler.handleApiError(err)
            setError(apiError.message || 'Update failed')
            throw err
        } finally {
            setIsLoading(false)
        }
    }

    const handleLogout = () => {
        setUser(null)
        setToken(null)
        localStorage.removeItem('token')
        Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key))
        navigate('/')
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

export function useAuth() {
    const context = useContext(AuthContext)
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}
