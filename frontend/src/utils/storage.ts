/**
 * Unified Storage Utility
 * Centralized localStorage management for caching API data
 */

const CACHE_PREFIX = 'app_'

export const STORAGE_KEYS = {
    SESSIONS: 'chat_sessions',
    ACTIVE_SESSION: 'active_session_id',
    COLLECTIONS: 'collections',
    USER_SETTINGS: 'user_settings',
    COLLECTIONS_TIMESTAMP: 'collections_timestamp',
    SETTINGS_TIMESTAMP: 'settings_timestamp',
    SELECTED_COLLECTION: 'selected_collection_id',
    CUSTOM_RAG_PROMPT: 'custom_rag_prompt',
} as const

const getKey = (key: string) => `${CACHE_PREFIX}${key}`

export const storage = {
    get: <T>(key: string, defaultValue: T): T => {
        try {
            const item = localStorage.getItem(getKey(key))
            return item ? JSON.parse(item) : defaultValue
        } catch {
            return defaultValue
        }
    },

    set: <T>(key: string, value: T): void => {
        try {
            localStorage.setItem(getKey(key), JSON.stringify(value))
        } catch (e) {
            console.error('Failed to save to localStorage:', e)
        }
    },

    remove: (key: string): void => {
        localStorage.removeItem(getKey(key))
    },

    clearAll: (): void => {
        Object.values(STORAGE_KEYS).forEach(key => {
            localStorage.removeItem(getKey(key))
        })
    },
}

export const cache = {
    async getOrFetch<T>(
        key: string,
        fetchFn: () => Promise<T>,
        ttlMs: number = 3600000
    ): Promise<T> {
        const timestampKey = `${key}_timestamp`
        const cached = storage.get<{ data: T; timestamp: number }>(key, null)
        const now = Date.now()

        if (cached && (now - cached.timestamp) < ttlMs) {
            return cached.data
        }

        try {
            const data = await fetchFn()
            storage.set(key, { data, timestamp: now })
            return data
        } catch (error) {
            if (cached) {
                console.warn(`Cache stale, using expired cache for ${key}`)
                return cached.data
            }
            throw error
        }
    },

    invalidate: (key: string): void => {
        storage.remove(key)
        storage.remove(`${key}_timestamp`)
    },

    invalidateAll: (): void => {
        Object.values(STORAGE_KEYS).forEach(key => {
            storage.remove(key)
            storage.remove(`${key}_timestamp`)
        })
    },
}
