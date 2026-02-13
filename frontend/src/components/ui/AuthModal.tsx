import React, { useState, useEffect } from 'react'
import Input from './Input'
import Card from './Card'
import { X, Mail, Lock, User, ArrowRight, Eye, EyeOff, Check, AlertCircle } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

interface AuthModalProps {
    isOpen: boolean
    onClose: () => void
}

interface ValidationErrors {
    email?: string
    password?: string
    confirmPassword?: string
    fullName?: string
}

const validateEmail = (email: string): string | undefined => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!email.trim()) return 'Email is required'
    if (!emailRegex.test(email)) return 'Please enter a valid email address'
    return undefined
}

const validatePassword = (password: string): string | undefined => {
    if (!password) return 'Password is required'
    if (password.length < 8) return 'At least 8 characters'
    if (!/[A-Z]/.test(password)) return 'One uppercase letter'
    if (!/[a-z]/.test(password)) return 'One lowercase letter'
    if (!/[0-9]/.test(password)) return 'One number'
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) return 'One special character'
    return undefined
}

const validateFullName = (name: string): string | undefined => {
    if (!name.trim()) return 'Full name is required'
    if (name.trim().length < 2) return 'At least 2 characters'
    return undefined
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
    const [isLogin, setIsLogin] = useState(true)
    const { login, register } = useAuth()

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [fullName, setFullName] = useState('')

    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [errors, setErrors] = useState<ValidationErrors>({})

    useEffect(() => {
        if (isOpen) {
            setEmail('')
            setPassword('')
            setConfirmPassword('')
            setFullName('')
            setError('')
            setErrors({})
        }
    }, [isOpen, isLogin])

    const getPasswordStrength = (pwd: string): { strength: number; label: string; color: string } => {
        let strength = 0
        if (pwd.length >= 8) strength++
        if (/[A-Z]/.test(pwd)) strength++
        if (/[a-z]/.test(pwd)) strength++
        if (/[0-9]/.test(pwd)) strength++
        if (/[!@#$%^&*(),.?":{}|<>]/.test(pwd)) strength++

        if (strength <= 2) return { strength: 1, label: 'Weak', color: 'bg-red-500' }
        if (strength <= 3) return { strength: 2, label: 'Fair', color: 'bg-yellow-500' }
        if (strength <= 4) return { strength: 3, label: 'Good', color: 'bg-blue-500' }
        return { strength: 4, label: 'Strong', color: 'bg-green-500' }
    }

    const passwordStrength = !isLogin ? getPasswordStrength(password) : null

    const handleSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault()
        setError('')
        setErrors({})

        const newErrors: ValidationErrors = {}

        if (!isLogin) {
            const nameError = validateFullName(fullName)
            if (nameError) newErrors.fullName = nameError

            const pwdError = validatePassword(password)
            if (pwdError) newErrors.password = pwdError

            if (password !== confirmPassword) {
                newErrors.confirmPassword = 'Passwords do not match'
            }
        }

        const emailError = validateEmail(email)
        if (emailError) newErrors.email = emailError

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors)
            return
        }

        setLoading(true)
        try {
            if (isLogin) {
                await login(email.toLowerCase().trim(), password)
            } else {
                await register(email.toLowerCase().trim(), password, fullName.trim())
            }
            onClose()
        } catch (err) {
            const detail = err instanceof Error ? err.message : 'Authentication failed. Please try again.'
            setError(detail)
        } finally {
            setLoading(false)
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault()
            handleSubmit()
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 md:p-4">
            <div
                className="absolute inset-0 bg-gradient-to-br from-purple-50/50 to-pink-50/50 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            <Card
                variant="elevated"
                className="relative w-full max-w-sm md:max-w-md lg:max-w-lg p-4 md:p-6 lg:p-8 overflow-hidden animate-in fade-in zoom-in duration-300 bg-gradient-to-br from-white to-purple-50 border-2 border-purple-200 shadow-2xl hover:from-white hover:to-white"
                padding="lg"
            >
                <div className="absolute -top-20 -left-20 w-40 h-40 bg-gradient-to-br from-purple-400/20 to-pink-400/20 rounded-full blur-3xl pointer-events-none" />

                <button
                    onClick={onClose}
                    className="absolute top-2 md:top-4 right-2 md:right-4 text-muted-foreground hover:text-purple-600 hover:bg-purple-50 rounded-full p-1 transition-all duration-200"
                >
                    <X size={20} />
                </button>

                <form
                    className="relative z-10 flex flex-col gap-4 md:gap-6"
                    onSubmit={handleSubmit}
                    onKeyDown={handleKeyDown}
                >
                    <div className="text-center space-y-2">
                        <h2 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent tracking-tight">
                            {isLogin ? 'Welcome Back' : 'Create Account'}
                        </h2>
                        <p className="text-muted-foreground text-xs md:text-sm">
                            {isLogin
                                ? 'Enter your credentials to access your workspace'
                                : 'Get started with your private RAG assistant'}
                        </p>
                    </div>

                    <div className="space-y-4">
                        {error && (
                            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm text-center flex items-center justify-center gap-2">
                                <AlertCircle size={16} />
                                {error}
                            </div>
                        )}

                        {!isLogin && (
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground ml-1">
                                    Full Name
                                </label>
                                <Input
                                    placeholder="John Doe"
                                    type="text"
                                    inputSize="md"
                                    leftIcon={
                                        <User
                                            className={errors.fullName ? 'text-red-500' : 'text-purple-500'}
                                            size={18}
                                        />
                                    }
                                    value={fullName}
                                    onChange={(e) => {
                                        setFullName(e.target.value)
                                        if (errors.fullName) setErrors(prev => ({ ...prev, fullName: undefined }))
                                    }}
                                    error={errors.fullName}
                                />
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground ml-1">
                                Email Address
                            </label>
                            <Input
                                placeholder="name@example.com"
                                type="email"
                                inputSize="md"
                                leftIcon={
                                    <Mail className={errors.email ? 'text-red-500' : 'text-blue-500'} size={18} />
                                }
                                value={email}
                                onChange={(e) => {
                                    setEmail(e.target.value)
                                    if (errors.email) setErrors(prev => ({ ...prev, email: undefined }))
                                }}
                                error={errors.email}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground ml-1">
                                Password
                            </label>
                            <div className="relative">
                                <Input
                                    placeholder={isLogin ? '••••••••' : 'Create password'}
                                    type={showPassword ? 'text' : 'password'}
                                    inputSize="md"
                                    leftIcon={
                                        <Lock className={errors.password ? 'text-red-500' : 'text-pink-500'} size={18} />
                                    }
                                    value={password}
                                    onChange={(e) => {
                                        setPassword(e.target.value)
                                        if (errors.password) setErrors(prev => ({ ...prev, password: undefined }))
                                    }}
                                    error={errors.password}
                                    className="pr-10"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                            {!isLogin && password && passwordStrength && (
                                <div className="space-y-1">
                                    <div className="flex gap-1">
                                        {[1, 2, 3, 4].map((level) => (
                                            <div
                                                key={level}
                                                className={`h-1 flex-1 rounded-full transition-colors ${
                                                    level <= passwordStrength.strength
                                                        ? passwordStrength.color
                                                        : 'bg-gray-200'
                                                }`}
                                            />
                                        ))}
                                    </div>
                                    <p className="text-xs text-gray-500">
                                        Password strength: <span className={passwordStrength.color.replace('bg-', 'text-')}>{passwordStrength.label}</span>
                                    </p>
                                </div>
                            )}
                        </div>

                        {!isLogin && (
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground ml-1">
                                    Confirm Password
                                </label>
                                <Input
                                    placeholder="••••••••"
                                    type={showPassword ? 'text' : 'password'}
                                    inputSize="md"
                                    leftIcon={
                                        <Lock className={errors.confirmPassword ? 'text-red-500' : 'text-pink-500'} size={18} />
                                    }
                                    value={confirmPassword}
                                    onChange={(e) => {
                                        setConfirmPassword(e.target.value)
                                        if (errors.confirmPassword) setErrors(prev => ({ ...prev, confirmPassword: undefined }))
                                    }}
                                    error={errors.confirmPassword}
                                />
                            </div>
                        )}

                        {!isLogin && (
                            <div className="text-xs text-gray-500 space-y-1">
                                <p className="font-medium">Password requirements:</p>
                                <div className="grid grid-cols-2 gap-1">
                                    <div className="flex items-center gap-1">
                                        <Check size={12} className={password.length >= 8 ? 'text-green-500' : 'text-gray-300'} />
                                        <span>8+ characters</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Check size={12} className={/[A-Z]/.test(password) ? 'text-green-500' : 'text-gray-300'} />
                                        <span>Uppercase</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Check size={12} className={/[a-z]/.test(password) ? 'text-green-500' : 'text-gray-300'} />
                                        <span>Lowercase</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Check size={12} className={/[0-9]/.test(password) ? 'text-green-500' : 'text-gray-300'} />
                                        <span>Number</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <button
                        type="submit"
                        className="w-full flex items-center justify-center group px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 rounded-lg font-semibold text-base disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                        disabled={loading}
                    >
                        {loading ? (
                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <>
                                <span>{isLogin ? 'Login' : 'Create Account'}</span>
                                <ArrowRight
                                    className="ml-2 group-hover:translate-x-1 transition-transform"
                                    size={18}
                                />
                            </>
                        )}
                    </button>

                    <div className="text-center">
                        <button
                            type="button"
                            onClick={() => {
                                setIsLogin(!isLogin)
                                setError('')
                                setErrors({})
                            }}
                            className="text-sm text-muted-foreground hover:text-purple-600 transition-colors hover:underline hover:decoration-purple-400"
                        >
                            {isLogin
                                ? "Don't have an account? Sign up"
                                : 'Already have an account? Sign in'}
                        </button>
                    </div>
                </form>
            </Card>
        </div>
    )
}

export default AuthModal
