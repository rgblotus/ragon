import React from 'react'
import { cn } from '../../utils/cn'

interface ProgressBarProps {
    progress: number // 0-100
    message?: string
    error?: string
    className?: string
    size?: 'sm' | 'md' | 'lg'
}

const ProgressBar: React.FC<ProgressBarProps> = ({
    progress,
    message,
    error,
    className = '',
    size = 'md',
}) => {
    const clampedProgress = Math.min(100, Math.max(0, progress))
    const isError = !!error

    const sizeVariants = {
        sm: {
            container: 'h-2',
            text: 'text-xs',
        },
        md: {
            container: 'h-3',
            text: 'text-sm',
        },
        lg: {
            container: 'h-4',
            text: 'text-base',
        },
    }

    const currentSize = sizeVariants[size]

    return (
        <div className={cn('space-y-2', className)}>
            {/* Progress Bar */}
            <div
                className={cn(
                    'relative bg-gradient-to-r from-slate-100 to-slate-200 rounded-full overflow-hidden border border-slate-300',
                    currentSize.container
                )}
            >
                <div
                    className={cn(
                        'h-full transition-all duration-500 ease-out rounded-full',
                        isError
                            ? 'bg-gradient-to-r from-red-500 to-pink-500'
                            : 'bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500'
                    )}
                    style={{ width: `${clampedProgress}%` }}
                />
            </div>

            {/* Progress Text */}
            <div className="flex justify-between items-center">
                <div
                    className={cn(
                        'font-medium text-slate-700 truncate flex-1 min-w-0',
                        currentSize.text
                    )}
                >
                    {error || message || 'Processing...'}
                </div>
                <div
                    className={cn(
                        'font-bold text-slate-600 ml-2 flex-shrink-0',
                        currentSize.text
                    )}
                >
                    {clampedProgress}%
                </div>
            </div>
        </div>
    )
}

export default ProgressBar
