// Reusable Loading component for consistent loading states
import React from 'react'

interface LoadingProps {
    size?: 'sm' | 'md' | 'lg' | 'xl'
    text?: string
    variant?: 'primary' | 'secondary' | 'overlay'
    className?: string
}

const Loading: React.FC<LoadingProps> = ({
    size = 'md',
    text = 'Loading...',
    variant = 'secondary',
    className = '',
}) => {
    const sizeMap = {
        sm: 16,
        md: 24,
        lg: 32,
        xl: 48,
    }

    const textSizeClasses = {
        sm: 'text-xs',
        md: 'text-sm',
        lg: 'text-base',
        xl: 'text-lg',
    }

    if (variant === 'overlay') {
        return (
            <div
                className={`fixed inset-0 bg-gradient-to-br from-purple-900/20 via-blue-900/20 to-pink-900/20 backdrop-blur-sm flex items-center justify-center z-50 ${className}`}
            >
                <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl p-8 text-center border-2 border-purple-200/50 shadow-2xl shadow-purple-500/20">
                    <div
                        className="mx-auto mb-4 border-4 border-purple-200 border-t-purple-500 border-r-blue-500 border-b-pink-500 rounded-full animate-spin"
                        style={{ width: sizeMap[size], height: sizeMap[size] }}
                    />
                    <p
                        className={`${textSizeClasses[size]} bg-gradient-to-r from-purple-600 via-blue-600 to-pink-600 bg-clip-text text-transparent font-bold`}
                    >
                        {text}
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div className={`flex items-center justify-center gap-3 ${className}`}>
            <div
                className="border-4 border-purple-200 border-t-purple-500 border-r-blue-500 border-b-pink-500 rounded-full animate-spin"
                style={{ width: sizeMap[size], height: sizeMap[size] }}
            />
            {text && (
                <span
                    className={`${textSizeClasses[size]} bg-gradient-to-r from-purple-600 via-blue-600 to-pink-600 bg-clip-text text-transparent font-bold`}
                >
                    {text}
                </span>
            )}
        </div>
    )
}

// Specialized loading components for common use cases
export const PageLoading: React.FC<{ text?: string }> = ({
    text = 'Loading...',
}) => (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
        <Loading size="xl" text={text} variant="secondary" />
    </div>
)

export const InlineLoading: React.FC<{ text?: string; className?: string }> = ({
    text = 'Loading...',
    className = '',
}) => (
    <Loading size="md" text={text} variant="secondary" className={className} />
)

export const OverlayLoading: React.FC<{ text?: string }> = ({
    text = 'Loading...',
}) => <Loading size="lg" text={text} variant="overlay" />

export default Loading
