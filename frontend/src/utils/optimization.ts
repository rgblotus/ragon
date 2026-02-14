/**
 * Frontend Performance Optimizations
 * - Memoization utilities
 * - Async loading helpers
 * - Memory management
 */

// Memoization cache with TTL
const memoCache = new Map<string, { value: unknown; expiresAt: number }>()

export function memoize<T>(
    fn: () => T,
    key: string,
    ttlMs: number = 60000
): () => T {
    return () => {
        const cached = memoCache.get(key)
        if (cached && cached.expiresAt > Date.now()) {
            return cached.value as T
        }
        const value = fn()
        memoCache.set(key, { value, expiresAt: Date.now() + ttlMs })
        return value
    }
}

export function memoizeWithArgs<T, A extends unknown[]>(
    fn: (...args: A) => T,
    getKey: (...args: A) => string,
    ttlMs: number = 60000
): (...args: A) => T {
    return (...args: A) => {
        const key = getKey(...args)
        const cached = memoCache.get(key)
        if (cached && cached.expiresAt > Date.now()) {
            return cached.value as T
        }
        const value = fn(...args)
        memoCache.set(key, { value, expiresAt: Date.now() + ttlMs })
        return value
    }
}

export function clearMemoCache(pattern?: string): void {
    if (pattern) {
        for (const key of memoCache.keys()) {
            if (key.includes(pattern)) {
                memoCache.delete(key)
            }
        }
    } else {
        memoCache.clear()
    }
}

// Lazy import with caching
const lazyModules = new Map<string, Promise<unknown>>()

export function lazyImport<T>(
    loader: () => Promise<{ default: T }>,
    moduleName: string
): () => Promise<T> {
    return async () => {
        const cached = lazyModules.get(moduleName)
        if (cached) {
            return cached.then((m: unknown) => (m as { default: T }).default)
        }
        const module = loader()
        lazyModules.set(moduleName, module)
        return module.then((m: unknown) => (m as { default: T }).default)
    }
}

// Batch DOM updates using requestAnimationFrame
const pendingUpdates: (() => void)[] = []
let rafId: number | null = null

function flushUpdates() {
    const updates = pendingUpdates.splice(0)
    rafId = null
    updates.forEach((update) => update())
}

export function batchDOMUpdate(update: () => void): void {
    pendingUpdates.push(update)
    if (!rafId) {
        rafId = requestAnimationFrame(flushUpdates)
    }
}

// Cleanup utilities for component unmount
export function createCleanup(fn: () => void): () => void {
    let called = false
    return () => {
        if (!called) {
            called = true
            fn()
        }
    }
}

export function useCleanup(fn: () => void): void {
     
    React.useEffect(() => createCleanup(fn), [fn])
}

// Memory cleanup for large objects
export function cleanupObject(obj: Record<string, unknown>): void {
    Object.keys(obj).forEach((key) => {
        const value = obj[key]
        if (value instanceof HTMLElement) {
            obj[key] = null as unknown
        } else if (typeof value === 'object' && value !== null) {
            cleanupObject(value as Record<string, unknown>)
        }
    })
}

// Performance tracking
const perfMarks = new Map<string, number>()

export function perfMark(name: string): void {
    perfMarks.set(name, performance.now())
}

export function perfMeasure(name: string, startMark: string): number {
    const start = perfMarks.get(startMark) || performance.now()
    const duration = performance.now() - start
    console.log(`[Perf] ${name}: ${duration.toFixed(2)}ms`)
    return duration
}

export function perfGetMarks(): Record<string, number> {
    return Object.fromEntries(perfMarks)
}

export function perfClearMarks(): void {
    perfMarks.clear()
}

// React imports for hooks
import React from 'react'
