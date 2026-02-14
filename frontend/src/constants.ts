// Centralized constants and configuration for the frontend application
// This improves maintainability and reduces magic strings/numbers

/**
 * Application Constants
 */
export const APP_CONSTANTS = {
    NAME: 'Olivia AI Assistant',
    VERSION: '2.0.0',
    DESCRIPTION: 'Modern AI Research Assistant with RAG Capabilities',

    // API Configuration
    DEFAULT_API_URL: 'http://localhost:8000',
    API_TIMEOUT: 300000, // 5 minutes for large file processing

    // Authentication
    TOKEN_STORAGE_KEY: 'token',
    CHAT_SESSIONS_STORAGE_KEY: 'chat_sessions',
    ACTIVE_SESSION_STORAGE_KEY: 'active_session_id',

    // File Uploads
    MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
    ALLOWED_FILE_TYPES: ['.pdf', '.txt', '.doc', '.docx'],

    // Pagination
    DEFAULT_PAGE_SIZE: 10,
    MAX_PAGE_SIZE: 100,

    // UI/UX
    DEBOUNCE_DELAY: 300, // ms for search inputs
    TOAST_DURATION: 5000, // ms for toast notifications
    ANIMATION_DURATION: 200, // ms for transitions

    // Error Messages
    ERROR_MESSAGES: {
        NETWORK_ERROR: 'Network error. Please check your connection.',
        AUTHENTICATION_FAILED:
            'Authentication failed. Please check your credentials.',
        UNAUTHORIZED: 'Session expired. Please login again.',
        FORBIDDEN: 'You do not have permission to perform this action.',
        NOT_FOUND: 'The requested resource was not found.',
        SERVER_ERROR: 'Server error. Please try again later.',
        VALIDATION_ERROR: 'Please correct the errors in the form.',
        UNKNOWN_ERROR: 'An unexpected error occurred. Please try again.',
    },

    // Success Messages
    SUCCESS_MESSAGES: {
        LOGIN_SUCCESS: 'Login successful!',
        LOGOUT_SUCCESS: 'Logout successful!',
        REGISTER_SUCCESS: 'Registration successful!',
        UPDATE_SUCCESS: 'Update successful!',
        DELETE_SUCCESS: 'Delete successful!',
        UPLOAD_SUCCESS: 'Upload successful!',
    },

    // Routes
    ROUTES: {
        HOME: '/',
        DASHBOARD: '/dashboard',
        PROFILE: '/profile',
        DOCUMENTS: '/documents',
        CHAT: '/chat',
        TEST: '/test',
    },

    // Local Storage Keys
    LOCAL_STORAGE: {
        THEME: 'theme',
        USER_PREFERENCES: 'user_preferences',
        LAST_VISITED: 'last_visited',
    },

    // Cache Settings
    CACHE: {
        ENABLED: true,
        TTL: 3600000, // 1 hour in ms
        MAX_ITEMS: 100,
    },

    // API Endpoints
    API_ENDPOINTS: {
        AUTH: {
            REGISTER: '/auth/register',
            LOGIN: '/auth/login',
            ME: '/auth/me',
            SETTINGS: '/auth/settings',
        },
        COLLECTIONS: '/collections/',
        DOCUMENTS: '/documents/',
        CHAT: '/chat/',
        RAG: {
            CHAT: '/rag/chat',
            TRANSLATE: '/rag/translate',
            SOURCES: '/rag/sources',
            TTS: '/rag/tts',
            CACHE: {
                STATS: '/rag/cache/stats',
                HEALTH: '/rag/cache/health',
                PERFORMANCE: '/rag/cache/performance-report',
                WARMUP: '/rag/cache/warmup',
            },
        },
        HEALTH: {
            BASIC: '/health',
            DETAILED: '/health/detailed',
        },
    },
} as const

/**
 * Type Utilities
 */
export type AppRoute = keyof typeof APP_CONSTANTS.ROUTES
export type ApiEndpoint = keyof typeof APP_CONSTANTS.API_ENDPOINTS
export type ErrorMessageKey = keyof typeof APP_CONSTANTS.ERROR_MESSAGES
export type SuccessMessageKey = keyof typeof APP_CONSTANTS.SUCCESS_MESSAGES

/**
 * Helper Functions
 */
export function getRoutePath(route: AppRoute): string {
    return APP_CONSTANTS.ROUTES[route]
}

export function getErrorMessage(key: ErrorMessageKey): string {
    return APP_CONSTANTS.ERROR_MESSAGES[key]
}

export function getSuccessMessage(key: SuccessMessageKey): string {
    return APP_CONSTANTS.SUCCESS_MESSAGES[key]
}

/**
 * Environment Utilities
 */
export function isProduction(): boolean {
    return import.meta.env.MODE === 'production'
}

export function isDevelopment(): boolean {
    return import.meta.env.MODE === 'development'
}

/**
 * File Utilities
 */
export function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * Validation Utilities
 */
export function isValidFileType(file: File): boolean {
    const extension = '.' + file.name.split('.').pop()?.toLowerCase()
    return (APP_CONSTANTS.ALLOWED_FILE_TYPES as readonly string[]).includes(
        extension,
    )
}

export function isFileSizeValid(file: File): boolean {
    return file.size <= APP_CONSTANTS.MAX_FILE_SIZE
}

/**
 * Date Utilities
 */
export function formatDate(date: Date | string): string {
    const d = new Date(date)
    return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    })
}

/**
 * String Utilities
 */
export function truncateString(str: string, maxLength: number = 50): string {
    if (str.length <= maxLength) return str
    return str.substring(0, maxLength) + '...'
}

/**
 * Debug Utilities
 */
export function debugLog(...args: unknown[]): void {
    if (isDevelopment()) {
        console.log('[DEBUG]', ...args)
    }
}

export function debugError(...args: unknown[]): void {
    if (isDevelopment()) {
        console.error('[ERROR]', ...args)
    }
}
