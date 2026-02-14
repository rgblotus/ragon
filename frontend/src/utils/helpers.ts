// Comprehensive utility functions for the frontend application
// Consolidates common operations and helper functions

import { APP_CONSTANTS, debugLog, debugError } from '../constants'

/**
 * Storage Utilities
 */
export const Storage = {
    get: (key: string): string | null => {
        return localStorage.getItem(key)
    },

    set: (key: string, value: string): void => {
        localStorage.setItem(key, value)
    },

    remove: (key: string): void => {
        localStorage.removeItem(key)
    },

    clear: (): void => {
        localStorage.clear()
    },

    getObject: <T>(key: string): T | null => {
        const item = localStorage.getItem(key)
        return item ? JSON.parse(item) : null
    },

    setObject: <T>(key: string, value: T): void => {
        localStorage.setItem(key, JSON.stringify(value))
    },
}

/**
 * Session Management
 */
export const Session = {
    getToken: (): string | null => {
        return Storage.get(APP_CONSTANTS.TOKEN_STORAGE_KEY)
    },

    setToken: (token: string): void => {
        Storage.set(APP_CONSTANTS.TOKEN_STORAGE_KEY, token)
    },

    clearSession: (): void => {
        Storage.remove(APP_CONSTANTS.TOKEN_STORAGE_KEY)
        Storage.remove(APP_CONSTANTS.CHAT_SESSIONS_STORAGE_KEY)
        Storage.remove(APP_CONSTANTS.ACTIVE_SESSION_STORAGE_KEY)
    },

    isAuthenticated: (): boolean => {
        return !!Session.getToken()
    },
}

/**
 * Error Handling Utilities
 */
export class AppError extends Error {
    constructor(
        public message: string,
        public statusCode: number = 500,
        public timestamp: string = new Date().toISOString(),
        public context?: any,
    ) {
        super(message)
        this.name = 'AppError'
        debugError('AppError created:', { message, statusCode, context })
    }

    static fromUnknown(error: unknown): AppError {
        if (error instanceof AppError) {
            return error
        }

        if (error instanceof Error) {
            return new AppError(error.message, 500, undefined, error)
        }

        return new AppError('Unknown error occurred', 500, undefined, error)
    }

    static fromApiError(error: any): AppError {
        const statusCode = error.status_code || error.status || 500
        const message = error.detail || error.message || 'API request failed'
        return new AppError(message, statusCode, undefined, error)
    }
}

/**
 * API Response Handling
 */
export interface ApiResponse<T> {
    data?: T
    error?: AppError
    status: 'success' | 'error'
    timestamp: string
}

/**
 * Debounce Utility
 */
export function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number = APP_CONSTANTS.DEBOUNCE_DELAY,
): (...args: Parameters<T>) => void {
    let timeout: ReturnType<typeof setTimeout> | null = null

    return function (...args: Parameters<T>): void {
        if (timeout) {
            clearTimeout(timeout)
        }

        timeout = setTimeout(() => {
            func(...args)
        }, wait)
    }
}

/**
 * Throttle Utility
 */
export function throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number = 1000,
): (...args: Parameters<T>) => void {
    let lastFunc: ReturnType<typeof setTimeout> | null = null
    let lastRan = 0

    return function (...args: Parameters<T>): void {
        const now = Date.now()

        if (!lastRan || now - lastRan >= limit) {
            func(...args)
            lastRan = now
        } else if (lastFunc) {
            clearTimeout(lastFunc)
        }

        lastFunc = setTimeout(
            () => {
                func(...args)
                lastRan = Date.now()
            },
            limit - (now - lastRan),
        )
    }
}

/**
 * Promise Utilities
 */
export async function withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number = 10000,
    timeoutMessage: string = 'Request timed out',
): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) =>
            setTimeout(
                () => reject(new AppError(timeoutMessage, 408)),
                timeoutMs,
            ),
        ),
    ])
}

/**
 * Array Utilities
 */
export function chunkArray<T>(array: T[], size: number = 10): T[][] {
    const result: T[][] = []

    for (let i = 0; i < array.length; i += size) {
        result.push(array.slice(i, i + size))
    }

    return result
}

/**
 * Object Utilities
 */
export function deepMerge<T extends object>(target: T, source: any): T {
    const result = { ...target }

    for (const key in source) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
            const sourceValue = source[key]
            const targetValue = (target as any)[key]

            if (
                typeof sourceValue === 'object' &&
                sourceValue !== null &&
                typeof targetValue === 'object' &&
                targetValue !== null
            ) {
                ;(result as any)[key] = deepMerge(targetValue, sourceValue)
            } else {
                ;(result as any)[key] = sourceValue
            }
        }
    }

    return result as T
}

/**
 * Validation Utilities
 */
export function isEmailValid(email: string): boolean {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return re.test(email)
}

/**
 * Network Utilities
 */
export function isOnline(): boolean {
    return navigator.onLine
}

/**
 * URL Utilities
 */
export function buildUrl(
    base: string,
    params: Record<string, any> = {},
): string {
    const url = new URL(base)

    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
            url.searchParams.append(key, String(value))
        }
    })

    return url.toString()
}

/**
 * Performance Monitoring
 */
export function measurePerformance<T>(
    name: string,
    fn: () => T,
): { result: T; duration: number } {
    const start = performance.now()
    const result = fn()
    const duration = performance.now() - start

    debugLog(`Performance: ${name} took ${duration.toFixed(2)}ms`)

    return { result, duration }
}

/**
 * Async Performance Monitoring
 */
export async function measureAsyncPerformance<T>(
    name: string,
    fn: () => Promise<T>,
): Promise<{ result: T; duration: number }> {
    const start = performance.now()
    const result = await fn()
    const duration = performance.now() - start

    debugLog(`Async Performance: ${name} took ${duration.toFixed(2)}ms`)

    return { result, duration }
}

/**
 * Event Utilities
 */
export function once(
    eventTarget: EventTarget,
    eventName: string,
): Promise<Event> {
    return new Promise((resolve) => {
        const handler = (event: Event) => {
            eventTarget.removeEventListener(eventName, handler)
            resolve(event)
        }

        eventTarget.addEventListener(eventName, handler)
    })
}

/**
 * DOM Utilities
 */
export function scrollToTop(smooth: boolean = true): void {
    window.scrollTo({
        top: 0,
        behavior: smooth ? 'smooth' : 'auto',
    })
}

/**
 * Type Guards
 */
export function isNotEmpty<T>(value: T | null | undefined): value is T {
    return value !== null && value !== undefined
}

export function isArrayWithItems<T>(
    value: T[] | null | undefined,
): value is T[] {
    return Array.isArray(value) && value.length > 0
}

export function isObjectWithKeys(value: any): value is Record<string, any> {
    return (
        typeof value === 'object' &&
        value !== null &&
        Object.keys(value).length > 0
    )
}
