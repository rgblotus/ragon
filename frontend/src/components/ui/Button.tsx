import React from 'react'
import { cn } from '../../utils/cn'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?:
        | 'default'
        | 'secondary'
        | 'outline'
        | 'ghost'
        | 'primary'
        | 'accent'
        | 'success'
        | 'warning'
        | 'danger'
    size?: 'sm' | 'md' | 'lg' | 'xl'
    children: React.ReactNode
    loading?: boolean
    icon?: React.ReactNode
    fullWidth?: boolean
}

const Button: React.FC<ButtonProps> = ({
    variant = 'default',
    size = 'md',
    children,
    className = '',
    loading = false,
    icon,
    fullWidth = false,
    disabled,
    ...props
}) => {
    const sizeVariants = {
        sm: 'px-3 py-1.5 text-sm',
        md: 'px-4 py-2 text-sm',
        lg: 'px-6 py-3 text-base',
        xl: 'px-8 py-4 text-lg',
    }

    const buttonVariants = {
        default: cn(
            'bg-gradient-to-r from-slate-100 to-slate-200 border border-slate-300 text-slate-700',
            'hover:from-purple-100 hover:to-pink-100 hover:border-purple-300 hover:text-purple-700',
            'focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500',
            'active:scale-95',
            'shadow-sm hover:shadow-md',
            'transition-all duration-200'
        ),
        primary: cn(
            'bg-gradient-to-r from-purple-600 via-blue-600 to-pink-600 hover:from-purple-700 hover:via-blue-700 hover:to-pink-700 text-white border-0',
            'hover:shadow-lg hover:shadow-purple-500/25 active:scale-95',
            'focus:ring-2 focus:ring-purple-500/50 focus:ring-offset-2',
            'transition-all duration-200'
        ),
        secondary: cn(
            'bg-gradient-to-r from-blue-100 to-pink-100 border border-blue-200 text-blue-700',
            'hover:from-blue-200 hover:to-pink-200 hover:border-blue-300 hover:text-blue-800',
            'hover:shadow-md active:scale-95',
            'focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500',
            'transition-all duration-200'
        ),
        outline: cn(
            'bg-transparent border-2 border-purple-300 text-purple-600',
            'hover:bg-gradient-to-r hover:from-purple-50 hover:to-pink-50 hover:border-purple-500 hover:text-purple-700',
            'focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500',
            'active:scale-95',
            'transition-all duration-200'
        ),
        ghost: cn(
            'bg-transparent text-slate-600',
            'hover:bg-gradient-to-r hover:from-purple-50 hover:to-pink-50 hover:text-purple-600',
            'focus:ring-2 focus:ring-purple-500/50',
            'active:scale-95',
            'transition-all duration-200'
        ),
        accent: cn(
            'bg-gradient-to-r from-green-100 to-emerald-100 border border-green-200 text-green-700',
            'hover:from-green-200 hover:to-emerald-200 hover:border-green-300 hover:text-green-800',
            'hover:shadow-md active:scale-95',
            'focus:ring-2 focus:ring-green-500/50',
            'transition-all duration-200'
        ),
        success: cn(
            'bg-gradient-to-r from-emerald-500 to-green-500 text-white border-0',
            'hover:from-emerald-600 hover:to-green-600 hover:shadow-lg hover:shadow-green-500/25 active:scale-95',
            'focus:ring-2 focus:ring-green-500/50',
            'transition-all duration-200'
        ),
        warning: cn(
            'bg-gradient-to-r from-yellow-500 to-orange-500 text-white border-0',
            'hover:from-yellow-600 hover:to-orange-600 hover:shadow-lg hover:shadow-yellow-500/25 active:scale-95',
            'focus:ring-2 focus:ring-yellow-500/50',
            'transition-all duration-200'
        ),
        danger: cn(
            'bg-gradient-to-r from-red-500 to-pink-500 text-white border-0',
            'hover:from-red-600 hover:to-pink-600 hover:shadow-lg hover:shadow-red-500/25 active:scale-95',
            'focus:ring-2 focus:ring-red-500/50',
            'transition-all duration-200'
        ),
    }

    const isDisabled = disabled || loading

    return (
        <button
            className={cn(
                // Base button styles
                'relative inline-flex items-center justify-center',
                'font-medium rounded-lg',
                'focus:outline-none focus:ring-2 focus:ring-offset-2',
                'disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none',
                'hover-lift interactive',
                // Size variants
                sizeVariants[size],
                // Variant styles
                buttonVariants[variant],
                // Full width
                fullWidth && 'w-full',
                className
            )}
            disabled={isDisabled}
            {...props}
        >
            {loading && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                </div>
            )}

            <span
                className={cn(
                    'flex items-center justify-center gap-2',
                    loading && 'opacity-0'
                )}
            >
                {icon && !loading && (
                    <span className="flex-shrink-0">{icon}</span>
                )}
                {children}
            </span>
        </button>
    )
}

export default Button
