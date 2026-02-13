import React from 'react'
import { cn } from '../../utils/cn'

interface CardProps {
    children: React.ReactNode
    className?: string
    onClick?: () => void
    variant?: 'default' | 'elevated' | 'outlined' | 'flat' | 'gradient'
    padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl'
    hoverEffect?: boolean
    interactive?: boolean
}

const Card: React.FC<CardProps> = ({
    children,
    className = '',
    onClick,
    variant = 'default',
    padding = 'md',
    hoverEffect = true,
    interactive = false,
}) => {
    const paddingVariants = {
        none: '',
        sm: 'p-3',
        md: 'p-4',
        lg: 'p-6',
        xl: 'p-8',
    }

    const cardVariants = {
        default: cn(
            'bg-gradient-to-br from-white to-slate-50 border border-slate-200 shadow-sm',
            'hover:shadow-lg hover:shadow-purple-500/10 hover:border-purple-200',
            'hover:from-purple-50/30 hover:to-pink-50/30 hover-lift',
            'transition-all duration-200'
        ),
        elevated: cn(
            'bg-gradient-to-br from-white to-slate-50 border border-slate-200 shadow-xl shadow-purple-500/10',
            'hover:shadow-2xl hover:shadow-purple-500/20 hover:border-purple-300',
            'hover:from-purple-50/50 hover:to-pink-50/50 hover-lift',
            'transition-all duration-200'
        ),
        outlined: cn(
            'bg-transparent border-2 border-gradient-to-r from-purple-300 via-blue-300 to-pink-300',
            'hover:bg-gradient-to-r hover:from-purple-50 hover:via-blue-50 hover:to-pink-50 hover:border-purple-500 hover:shadow-md',
            'transition-all duration-200'
        ),
        flat: cn(
            'bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200/50',
            'hover:bg-gradient-to-br hover:from-purple-50 hover:to-pink-50',
            'hover:border-purple-200',
            'transition-all duration-200'
        ),
        gradient: cn(
            'bg-gradient-to-br from-purple-100 via-blue-100 to-pink-100 border border-purple-200/50 shadow-lg',
            'hover:shadow-xl hover:shadow-purple-500/20 hover:from-purple-200 hover:via-blue-200 hover:to-pink-200 hover:border-purple-300',
            'hover-lift transition-all duration-200'
        ),
    }

    const isInteractive = interactive || !!onClick

    // Always render as div to prevent nested button issues
    const Component = 'div'

    return (
        <Component
            onClick={onClick}
            className={cn(
                // Base card styles
                'rounded-lg',
                'text-card-foreground',
                'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2',
                // Variant styles
                cardVariants[variant],
                // Padding
                paddingVariants[padding],
                // Interactive styles
                isInteractive &&
                    'cursor-pointer hover:shadow-lg hover:shadow-purple-500/10',
                // Animation
                hoverEffect && 'transition-all duration-200',
                className
            )}
            {...(onClick && { type: 'button' })}
        >
            {children}
        </Component>
    )
}

export default Card
