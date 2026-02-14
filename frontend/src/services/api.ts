/**
 * API Service - Refactored into modular endpoints
 * Organized by feature: Auth, Chat, Documents, Collections, RAG, Cache
 */

import axios, { type AxiosInstance, type AxiosResponse } from 'axios'
import type {
    User, UserCreate, UserLogin, UserUpdate, Token,
    Collection, CollectionCreate,
    Document,
    ChatRequest, ChatResponse, SourceInfo,
    TranslateRequest, TranslateResponse,
    TTSRequest,
    GetSourcesRequest, GetSourcesResponse,
    UserSettings, UserSettingsUpdate, UserSettingsResponse,
    HealthCheck,
    ChatSessionsResponse, ChatMessagesResponse, ChatSessionBackend, ChatMessageBackend,
} from '../types/api'
import { errorHandler } from '../utils/errorHandler'
import { storage, STORAGE_KEYS } from '../utils/storage'

// Base API configuration
const createApiClient = (): AxiosInstance => {
    const client = axios.create({
        baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
        timeout: 300000,
    })

    client.interceptors.request.use((config) => {
        const token = localStorage.getItem('token')
        if (token) config.headers['Authorization'] = `Bearer ${token}`
        return config
    })

    client.interceptors.response.use(
        (response) => response,
        (error) => {
            if (error.response?.status === 401) {
                localStorage.removeItem('token')
                Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key))
                window.location.href = '/'
            }
            return Promise.reject(errorHandler.normalizeError(error))
        }
    )

    return client
}

const apiClient = createApiClient()

// Generic response handler
async function handleResponse<T>(promise: Promise<AxiosResponse<T>>): Promise<T> {
    try {
        const response = await promise
        return response.data
    } catch (error) {
        throw errorHandler.normalizeError(error)
    }
}

// ============ Auth Endpoints ============
export const authApi = {
    async register(userData: UserCreate): Promise<User> {
        return handleResponse(apiClient.post<User>('/auth/register', userData))
    },

    async login(credentials: UserLogin): Promise<Token> {
        return handleResponse(apiClient.post<Token>('/auth/login', credentials))
    },

    async logout(): Promise<{ detail: string }> {
        return handleResponse(apiClient.post<{ detail: string }>('/auth/logout'))
    },

    async getCurrentUser(): Promise<User> {
        return handleResponse(apiClient.get<User>('/auth/me'))
    },

    async updateUser(userData: UserUpdate): Promise<User> {
        return handleResponse(apiClient.put<User>('/auth/me', userData))
    },

    async getSettings(): Promise<UserSettingsResponse> {
        return handleResponse(apiClient.get<UserSettingsResponse>('/auth/settings'))
    },

    async updateSettings(settings: UserSettingsUpdate): Promise<UserSettingsResponse> {
        return handleResponse(apiClient.put<UserSettingsResponse>('/auth/settings', settings))
    },

    async resetSettings(): Promise<UserSettingsResponse> {
        return handleResponse(apiClient.post<UserSettingsResponse>('/auth/settings/reset'))
    },
}

// ============ Collection Endpoints ============
export const collectionApi = {
    async getAll(): Promise<Collection[]> {
        return handleResponse(apiClient.get<Collection[]>('/collections/'))
    },

    async getById(id: number): Promise<Collection> {
        return handleResponse(apiClient.get<Collection>(`/collections/${id}`))
    },

    async create(data: CollectionCreate): Promise<Collection> {
        return handleResponse(apiClient.post<Collection>('/collections/', data))
    },

    async delete(id: number): Promise<{ detail: string }> {
        return handleResponse(apiClient.delete<{ detail: string }>(`/collections/${id}`))
    },
}

// ============ Document Endpoints ============
export const documentApi = {
    async getAll(collectionId?: number): Promise<Document[]> {
        const params = collectionId ? `?collection_id=${collectionId}` : ''
        return handleResponse(apiClient.get<Document[]>(`/documents/${params}`))
    },

    async upload(
        file: File,
        collectionId?: number,
        onProgress?: (progress: number) => void
    ): Promise<Document> {
        const formData = new FormData()
        formData.append('file', file)
        const params = collectionId ? `?collection_id=${collectionId}` : ''
        return handleResponse(apiClient.post<Document>(`/documents/upload${params}`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            onUploadProgress: (e) => onProgress?.(Math.round((e.loaded * 100) / (e.total || 1))),
        }))
    },

    async delete(id: number): Promise<{ detail: string }> {
        return handleResponse(apiClient.delete<{ detail: string }>(`/documents/${id}`))
    },

    async getContent(docId: number): Promise<Blob> {
        const token = localStorage.getItem('token')
        const response = await fetch(`${apiClient.defaults.baseURL}/documents/${docId}/content`, {
            headers: { Authorization: `Bearer ${token}` },
        })
        if (!response.ok) throw new Error(`Failed to download: ${response.statusText}`)
        return response.blob()
    },

    async getProgress(taskId: string): Promise<{ progress: number; status: string }> {
        return handleResponse(apiClient.get(`/documents/progress/${taskId}`))
    },
}

// ============ Chat Endpoints ============
export const chatApi = {
    async getSessions(): Promise<ChatSessionsResponse> {
        return handleResponse(apiClient.get<ChatSessionsResponse>('/chat/sessions'))
    },

    async getSession(sessionId: number): Promise<ChatSessionBackend> {
        return handleResponse(apiClient.get<ChatSessionBackend>(`/chat/sessions/${sessionId}`))
    },

    async createSession(data: Record<string, unknown>): Promise<ChatSessionBackend> {
        return handleResponse(apiClient.post<ChatSessionBackend>('/chat/sessions', data))
    },

    async updateSession(sessionId: number, data: Record<string, unknown>): Promise<ChatSessionBackend> {
        return handleResponse(apiClient.put<ChatSessionBackend>(`/chat/sessions/${sessionId}`, data))
    },

    async deleteSession(sessionId: number): Promise<{ detail: string }> {
        return handleResponse(apiClient.delete<{ detail: string }>(`/chat/sessions/${sessionId}`))
    },

    async getMessages(sessionId: number): Promise<ChatMessagesResponse> {
        return handleResponse(apiClient.get<ChatMessagesResponse>(`/chat/sessions/${sessionId}/messages`))
    },

    async createMessage(sessionId: number, data: Record<string, unknown>): Promise<ChatMessageBackend> {
        return handleResponse(apiClient.post<ChatMessageBackend>(`/chat/sessions/${sessionId}/messages`, data))
    },

    async deleteMessage(messageId: number): Promise<{ detail: string }> {
        return handleResponse(apiClient.delete<{ detail: string }>(`/chat/messages/${messageId}`))
    },

    // Streaming chat - returns ReadableStream
    async streamChat(request: ChatRequest): Promise<ReadableStream> {
        const token = localStorage.getItem('token')
        const response = await fetch(`${apiClient.defaults.baseURL}/rag/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(request),
        })

        if (!response.ok) throw new Error(`HTTP error: ${response.status}`)
        if (!response.body) throw new Error('No response body')

        return response.body
    },
}

// ============ RAG Endpoints ============
export const ragApi = {
    async warmup(): Promise<{ status: string; message: string }> {
        return handleResponse(apiClient.post<{ status: string; message: string }>('/rag/warmup'))
    },

    async translate(request: TranslateRequest): Promise<TranslateResponse> {
        return handleResponse(apiClient.post<TranslateResponse>('/rag/translate', request))
    },

    async getSources(request: GetSourcesRequest): Promise<GetSourcesResponse> {
        return handleResponse(apiClient.post<GetSourcesResponse>('/rag/sources', request))
    },

    async textToSpeech(request: TTSRequest): Promise<Blob> {
        const token = localStorage.getItem('token')
        const params = new URLSearchParams({
            text: request.text,
            voice: request.voice || 'en_female',
        })
        const response = await fetch(`${apiClient.defaults.baseURL}/rag/tts?${params}`, {
            headers: { Authorization: `Bearer ${token}` },
        })
        if (!response.ok) throw new Error(`TTS failed: ${response.statusText}`)
        return response.blob()
    },

    async debugDocuments(collectionId?: number): Promise<unknown> {
        const url = new URL(`${apiClient.defaults.baseURL}/rag/debug/documents`)
        if (collectionId) url.searchParams.set('collection_id', collectionId.toString())
        const response = await fetch(url.toString(), {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        })
        if (!response.ok) throw new Error(`HTTP error: ${response.status}`)
        return response.json()
    },
}

// ============ Cache Endpoints ============
export const cacheApi = {
    async getStats(): Promise<unknown> {
        return handleResponse(apiClient.get('/rag/cache/stats'))
    },

    async getHealth(): Promise<unknown> {
        return handleResponse(apiClient.get('/rag/cache/health'))
    },

    async warmup(): Promise<unknown> {
        return handleResponse(apiClient.post('/rag/cache/warmup'))
    },
}

// ============ Health Endpoints ============
export const healthApi = {
    async check(): Promise<HealthCheck> {
        return handleResponse(apiClient.get('/health'))
    },

    async detailedCheck(): Promise<HealthCheck> {
        return handleResponse(apiClient.get('/health/detailed'))
    },
}

// ============ Utility ============
export const apiUtils = {
    isAuthenticated(): boolean {
        return !!localStorage.getItem('token')
    },

    setToken(token: string): void {
        localStorage.setItem('token', token)
    },

    clearToken(): void {
        localStorage.removeItem('token')
        Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key))
    },

    formatFileSize(bytes: number): string {
        if (bytes === 0) return '0 Bytes'
        const k = 1024
        const sizes = ['Bytes', 'KB', 'MB', 'GB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
    },

    isValidFileType(file: File): boolean {
        const allowed = ['.pdf', '.txt', '.doc', '.docx']
        const ext = '.' + file.name.split('.').pop()?.toLowerCase()
        return allowed.includes(ext)
    },
}

// Backward compatibility - export combined api object with all methods
// Old pages use methods like api.getChatSessions(), api.getUserSettings() etc.
// New preferred approach: use individual APIs (authApi, chatApi, etc.)
export const api = {
    // Auth methods
    ...authApi,
    login: authApi.login,
    register: authApi.register,
    getCurrentUser: authApi.getCurrentUser,
    updateUser: authApi.updateUser,
    getSettings: authApi.getSettings,
    updateSettings: authApi.updateSettings,
    resetSettings: authApi.resetSettings,
    logout: authApi.logout,

    // Collection methods
    getCollections: collectionApi.getAll,
    createCollection: collectionApi.create,
    deleteCollection: collectionApi.delete,
    getCollection: collectionApi.getById,

    // Document methods
    getDocuments: documentApi.getAll,
    uploadDocument: documentApi.upload,
    deleteDocument: documentApi.delete,
    getDocumentContent: documentApi.getContent,
    getDocumentProgress: documentApi.getProgress,

    // Chat methods
    getChatSessions: chatApi.getSessions,
    getChatSession: chatApi.getSession,
    createChatSession: chatApi.createSession,
    updateChatSession: chatApi.updateSession,
    deleteChatSession: chatApi.deleteSession,
    getChatMessages: chatApi.getMessages,
    createChatMessage: chatApi.createMessage,
    deleteChatMessage: chatApi.deleteMessage,
    chatWithDocs: chatApi.streamChat,

    // RAG methods
    warmupRag: ragApi.warmup,
    translateText: ragApi.translate,
    textToSpeech: ragApi.textToSpeech,
    getSources: ragApi.getSources,
    debugDocuments: ragApi.debugDocuments,

    // Settings methods
    getUserSettings: async () => {
        const response = await authApi.getSettings()
        return response.data
    },
    updateUserSettings: async (data: any) => {
        const response = await authApi.updateSettings(data)
        return response.data
    },
    resetUserSettings: async () => {
        const response = await authApi.resetSettings()
        return response.data
    },

    // Utility methods
    getBaseUrl: () => apiClient.defaults.baseURL,
    isAuthenticated: apiUtils.isAuthenticated,
    setToken: apiUtils.setToken,
    clearToken: apiUtils.clearToken,
    formatFileSize: apiUtils.formatFileSize,
    isValidFileType: apiUtils.isValidFileType,

    // Generic methods for flexibility
    async get<T>(url: string): Promise<T> {
        return handleResponse(apiClient.get<T>(url))
    },
    async post<T>(url: string, data?: Record<string, unknown>): Promise<T> {
        return handleResponse(apiClient.post<T>(url, data))
    },
    async put<T>(url: string, data?: Record<string, unknown>): Promise<T> {
        return handleResponse(apiClient.put<T>(url, data))
    },
    async delete<T>(url: string): Promise<T> {
        return handleResponse(apiClient.delete<T>(url))
    },
}
