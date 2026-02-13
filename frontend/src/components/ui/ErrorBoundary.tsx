// Error Boundary component for consistent error handling
import React, { Component } from 'react'
import type { ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import Button from './Button'

interface Props {
    children: ReactNode
    fallback?: ReactNode
    onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

interface State {
    hasError: boolean
    error: Error | null
    errorInfo: React.ErrorInfo | null
}

class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props)
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
        }
    }

    static getDerivedStateFromError(error: Error): State {
        return {
            hasError: true,
            error,
            errorInfo: null,
        }
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        this.setState({
            errorInfo,
        })

        // Call custom error handler if provided
        if (this.props.onError) {
            this.props.onError(error, errorInfo)
        }

        // Log to console in development
        if (import.meta.env.DEV) {
            console.error('ErrorBoundary caught an error:', error, errorInfo)
        }
    }

    handleRetry = () => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
        })
    }

    handleGoHome = () => {
        window.location.href = '/dashboard'
    }

    render() {
        if (this.state.hasError) {
            // Custom fallback UI
            if (this.props.fallback) {
                return this.props.fallback
            }

            // Default error UI
            return (
                <div className="min-h-screen bg-gradient-to-br from-red-50 via-pink-50 to-purple-50 flex items-center justify-center p-4">
                    <div className="max-w-md w-full bg-gradient-to-br from-white to-slate-50 border-2 border-gradient-to-r from-red-200 via-pink-200 to-purple-200 rounded-2xl p-8 text-center shadow-2xl shadow-red-500/10">
                        <div className="w-16 h-16 bg-gradient-to-br from-red-100 to-pink-100 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-red-200">
                            <AlertTriangle className="text-red-600" size={32} />
                        </div>

                        <h1 className="text-2xl font-bold bg-gradient-to-r from-red-600 via-pink-600 to-purple-600 bg-clip-text text-transparent mb-2">
                            Something went wrong
                        </h1>
                        <p className="text-slate-600 mb-6">
                            An unexpected error occurred. This has been logged
                            and we'll look into it.
                        </p>

                        {import.meta.env.DEV && this.state.error && (
                            <details className="mb-6 text-left">
                                <summary className="text-sm text-slate-500 cursor-pointer hover:text-purple-600 transition-colors">
                                    Error Details (Development)
                                </summary>
                                <div className="mt-2 p-3 bg-gradient-to-br from-slate-100 to-slate-200 rounded-lg text-xs text-red-600 font-mono overflow-auto border border-slate-300">
                                    <div className="mb-2">
                                        <strong>Error:</strong>{' '}
                                        {this.state.error.message}
                                    </div>
                                    {this.state.errorInfo && (
                                        <div>
                                            <strong>Stack:</strong>
                                            <pre className="whitespace-pre-wrap">
                                                {
                                                    this.state.errorInfo
                                                        .componentStack
                                                }
                                            </pre>
                                        </div>
                                    )}
                                </div>
                            </details>
                        )}

                        <div className="flex gap-3">
                            <Button
                                variant="secondary"
                                onClick={this.handleRetry}
                                className="flex-1 gap-2 bg-gradient-to-r from-slate-100 to-slate-200 hover:from-red-100 hover:to-pink-100 border-slate-300 hover:border-red-300 text-slate-700 hover:text-red-700"
                            >
                                <RefreshCw size={16} />
                                Try Again
                            </Button>
                            <Button
                                variant="primary"
                                onClick={this.handleGoHome}
                                className="flex-1 gap-2 bg-gradient-to-r from-purple-600 via-pink-600 to-purple-700 hover:from-purple-700 hover:via-pink-700 hover:to-purple-800 text-white shadow-lg hover:shadow-xl"
                            >
                                <Home size={16} />
                                Go Home
                            </Button>
                        </div>
                    </div>
                </div>
            )
        }

        return this.props.children
    }
}

export default ErrorBoundary
