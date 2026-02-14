// Comprehensive error handling utility for the frontend application
// Standardizes error handling patterns across the application

import { AppError, Storage } from './helpers'
import { APP_CONSTANTS, isDevelopment, isProduction } from '../constants'

/**
 * Error Types
 */
export type ErrorType =
    | 'network'
    | 'authentication'
    | 'validation'
    | 'not_found'
    | 'server'
    | 'unknown'

/**
 * Standardized Error Response
 */
export interface StandardErrorResponse {
    type: ErrorType
    message: string
    statusCode: number
    timestamp: string
    context?: any
    isRetryable: boolean
}

/**
 * Error Handler Class
 */
export class ErrorHandler {
    private static instance: ErrorHandler

    private constructor() {}

    public static getInstance(): ErrorHandler {
        if (!ErrorHandler.instance) {
            ErrorHandler.instance = new ErrorHandler()
        }
        return ErrorHandler.instance
    }

    /**
     * Handle API errors
     */
    public handleApiError(error: any): StandardErrorResponse {
        let type: ErrorType = 'unknown'
        let message: string = APP_CONSTANTS.ERROR_MESSAGES.UNKNOWN_ERROR
        let statusCode: number = 500
        let isRetryable: boolean = false

        if (error.response) {
            // The request was made and the server responded with a status code
            // that falls out of the range of 2xx
            statusCode = error.response.status

            switch (statusCode) {
                case 400:
                    type = 'validation'
                    message =
                        error.response.data?.detail ||
                        APP_CONSTANTS.ERROR_MESSAGES.VALIDATION_ERROR
                    break
                case 401:
                    type = 'authentication'
                    message = APP_CONSTANTS.ERROR_MESSAGES.UNAUTHORIZED
                    this.handleUnauthorizedError()
                    break
                case 403:
                    type = 'authentication'
                    message = APP_CONSTANTS.ERROR_MESSAGES.FORBIDDEN
                    break
                case 404:
                    type = 'not_found'
                    message = APP_CONSTANTS.ERROR_MESSAGES.NOT_FOUND
                    break
                case 408:
                    type = 'network'
                    message = APP_CONSTANTS.ERROR_MESSAGES.NETWORK_ERROR
                    isRetryable = true
                    break
                case 500:
                case 502:
                case 503:
                case 504:
                    type = 'server'
                    message = APP_CONSTANTS.ERROR_MESSAGES.SERVER_ERROR
                    isRetryable = true
                    break
                default:
                    type = 'unknown'
                    message =
                        error.response.data?.detail ||
                        APP_CONSTANTS.ERROR_MESSAGES.UNKNOWN_ERROR
            }
        } else if (error.request) {
            // The request was made but no response was received
            type = 'network'
            message = APP_CONSTANTS.ERROR_MESSAGES.NETWORK_ERROR
            statusCode = 0
            isRetryable = true
        } else {
            // Something happened in setting up the request that triggered an Error
            type = 'unknown'
            message =
                error.message || APP_CONSTANTS.ERROR_MESSAGES.UNKNOWN_ERROR
        }

        return {
            type,
            message,
            statusCode,
            timestamp: new Date().toISOString(),
            context: error,
            isRetryable,
        }
    }

    /**
     * Handle network errors
     */
    public handleNetworkError(error: any): StandardErrorResponse {
        return {
            type: 'network',
            message: APP_CONSTANTS.ERROR_MESSAGES.NETWORK_ERROR,
            statusCode: 0,
            timestamp: new Date().toISOString(),
            context: error,
            isRetryable: true,
        }
    }

    /**
     * Handle authentication errors
     */
    public handleAuthenticationError(error: any): StandardErrorResponse {
        return {
            type: 'authentication',
            message: APP_CONSTANTS.ERROR_MESSAGES.AUTHENTICATION_FAILED,
            statusCode: 401,
            timestamp: new Date().toISOString(),
            context: error,
            isRetryable: false,
        }
    }

    /**
     * Handle validation errors
     */
    public handleValidationError(
        errors: Record<string, string[]>,
    ): StandardErrorResponse {
        const errorMessages = Object.entries(errors)
            .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
            .join('; ')

        return {
            type: 'validation',
            message:
                errorMessages || APP_CONSTANTS.ERROR_MESSAGES.VALIDATION_ERROR,
            statusCode: 400,
            timestamp: new Date().toISOString(),
            context: errors,
            isRetryable: false,
        }
    }

    /**
     * Handle unauthorized errors (clear session and redirect)
     */
    private handleUnauthorizedError(): void {
        // Clear session
        Storage.remove(APP_CONSTANTS.TOKEN_STORAGE_KEY)
        Storage.remove(APP_CONSTANTS.CHAT_SESSIONS_STORAGE_KEY)
        Storage.remove(APP_CONSTANTS.ACTIVE_SESSION_STORAGE_KEY)

        // Redirect to home page
        window.location.href = APP_CONSTANTS.ROUTES.HOME
    }

    /**
     * Create error from AppError
     */
    public fromAppError(error: AppError): StandardErrorResponse {
        return {
            type: this.getErrorTypeFromStatus(error.statusCode),
            message: error.message,
            statusCode: error.statusCode,
            timestamp: error.timestamp,
            context: error.context,
            isRetryable: this.isRetryable(error.statusCode),
        }
    }

    /**
     * Get error type from status code
     */
    private getErrorTypeFromStatus(statusCode: number): ErrorType {
        if (statusCode === 0) return 'network'
        if (statusCode === 401 || statusCode === 403) return 'authentication'
        if (statusCode === 400) return 'validation'
        if (statusCode === 404) return 'not_found'
        if (statusCode >= 500) return 'server'
        return 'unknown'
    }

    /**
     * Check if error is retryable
     */
    private isRetryable(statusCode: number): boolean {
        const retryableCodes = [0, 408, 500, 502, 503, 504]
        return retryableCodes.includes(statusCode)
    }

    /**
     * Log error for debugging
     */
    public logError(error: StandardErrorResponse | Error | any): void {
        if (isDevelopment()) {
            console.error('Error Handler:', error)
        }

        // In production, you might want to send errors to an error tracking service
        if (isProduction()) {
            this.sendErrorToTrackingService(error)
        }
    }

    /**
     * Send error to tracking service (stub for implementation)
     */
    private sendErrorToTrackingService(error: any): void {
        // TODO: Implement error tracking service integration
        // This could be Sentry, LogRocket, or a custom solution
        if (isDevelopment()) {
            console.log('Error sent to tracking service:', error)
        }
    }

    /**
     * Create user-friendly error message
     */
    public getUserFriendlyMessage(error: StandardErrorResponse): string {
        // Add more specific messages based on context if available
        if (error.context?.field) {
            return `${error.context.field}: ${error.message}`
        }

        return error.message
    }

    /**
     * Handle error with toast notification
     */
    public async handleErrorWithToast(
        error: any,
        showToast: (message: string, type: 'error' | 'warning') => void,
    ): Promise<StandardErrorResponse> {
        const standardError = this.handleApiError(error)
        this.logError(standardError)

        const userMessage = this.getUserFriendlyMessage(standardError)
        showToast(userMessage, 'error')

        return standardError
    }

    /**
     * Handle error with retry logic
     */
    public async handleWithRetry<T>(
        operation: () => Promise<T>,
        maxRetries: number = 3,
        delay: number = 1000,
    ): Promise<T> {
        let lastError: StandardErrorResponse | null = null

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await operation()
            } catch (error) {
                const standardError = this.handleApiError(error)
                lastError = standardError

                if (!standardError.isRetryable || attempt === maxRetries) {
                    throw lastError
                }

                // Exponential backoff
                await new Promise((resolve) =>
                    setTimeout(resolve, delay * attempt),
                )
            }
        }

        throw lastError
    }

    /**
     * Normalize error for API calls - throws StandardErrorResponse
     */
    public normalizeError(error: any): never {
        const standardError = this.handleApiError(error)
        throw standardError
    }
}

// Singleton instance for easy access
export const errorHandler = ErrorHandler.getInstance()

export default errorHandler
