import React from 'react'
import { cn } from '../../utils/cn'

interface InputProps
    extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
    className?: string
    variant?: 'default' | 'filled' | 'outlined' | 'underlined'
    inputSize?: 'sm' | 'md' | 'lg'
    label?: string
    error?: string
    helperText?: string
    leftIcon?: React.ReactNode
    rightIcon?: React.ReactNode
}

const Input: React.FC<InputProps> = ({
    className = '',
    variant = 'default',
    inputSize = 'md',
    label,
    error,
    helperText,
    leftIcon,
    rightIcon,
    id,
    ...props
}) => {
    const [generatedId] = React.useState(() => `input-${Math.random().toString(36).substr(2, 9)}`)
    const inputId = id || generatedId

    const sizeVariants = {
        sm: 'h-8 px-3 text-sm',
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-5 text-base',
    }

    const inputVariants = {
        default: cn(
            'bg-gradient-to-r from-white to-slate-50 border border-slate-200',
            'hover:from-purple-50 hover:to-pink-50 hover:border-purple-300',
            'focus:from-white focus:to-slate-50 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20',
            'transition-all duration-200'
        ),
        filled: cn(
            'bg-gradient-to-r from-slate-100 to-slate-200 border-0',
            'hover:from-purple-100 hover:to-pink-100',
            'focus:from-white focus:to-slate-50 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20',
            'transition-all duration-200'
        ),
        outlined: cn(
            'bg-transparent border-2 border-slate-200',
            'hover:border-purple-300 hover:bg-purple-50/50',
            'focus:border-purple-500 focus:bg-white focus:ring-2 focus:ring-purple-500/20',
            'transition-all duration-200'
        ),
        underlined: cn(
            'bg-transparent border-0 border-b-2 border-slate-200',
            'hover:border-purple-300',
            'focus:border-purple-500 focus:bg-purple-50/50 focus:ring-0 focus:ring-offset-0',
            'rounded-none',
            'transition-all duration-200'
        ),
    }

    return (
        <div className="relative w-full">
            {label && (
                <label
                    htmlFor={inputId}
                    className="block text-sm font-medium text-foreground mb-2"
                >
                    {label}
                </label>
            )}

            <div className="relative">
                {leftIcon && (
                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-purple-400">
                        {leftIcon}
                    </div>
                )}

                <input
                    id={inputId}
                    className={cn(
                        // Base input styles
                        'w-full font-medium',
                        'placeholder:text-muted-foreground',
                        'disabled:opacity-50 disabled:cursor-not-allowed',
                        'focus:outline-none',
                        // Size variants
                        sizeVariants[inputSize],
                        // Variant styles
                        inputVariants[variant],
                        // Error state
                        error &&
                            'border-red-500 focus:border-red-500 focus:ring-red-500/20',
                        // Icon padding adjustments
                        leftIcon && 'pl-10',
                        rightIcon && 'pr-10',
                        className
                    )}
                    {...props}
                />

                {rightIcon && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-purple-400">
                        {rightIcon}
                    </div>
                )}
            </div>

            {error && <p className="mt-1 text-sm text-destructive">{error}</p>}

            {helperText && !error && (
                <p className="mt-1 text-sm text-muted-foreground">
                    {helperText}
                </p>
            )}
        </div>
    )
}

export default Input
