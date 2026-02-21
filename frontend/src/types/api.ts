// Shared TypeScript types aligned with backend API schemas
// Generated from backend models and schemas

export interface User {
    id: number
    email: string
    full_name?: string
    is_active?: boolean
    created_at?: string
}

export interface UserCreate {
    email: string
    password: string
    confirm_password: string
    full_name: string
}

export interface UserLogin {
    email: string
    password: string
}

export interface UserUpdate {
    email?: string
    full_name?: string
    password?: string
}

export interface Token {
    access_token: string
    token_type: string
}

export interface TokenData {
    email: string
}

// Collection types
export interface Collection {
    id: number
    name: string
    description?: string
    is_default: boolean
    user_id: number
    document_count: number
    created_at?: string
}

export interface CollectionCreate {
    name: string
    description?: string
}

export interface CollectionUpdate {
    name?: string
    description?: string
}

export interface CollectionRead extends Collection {}

// Document types
export interface Document {
    id: number
    filename: string
    file_path: string
    content_type: string
    size_bytes: number
    user_id: number
    collection_id: number
    processed: boolean
    created_at: string
}

export interface DocumentRead extends Document {}

// RAG/Chat types
export interface ChatRequest {
    query: string
    collection_id: number
    temperature?: number
    top_k?: number
    custom_prompt?: string
    fetch_sources?: boolean
}

export interface ChatResponse {
    response: string
    sources: SourceInfo[]
}

export interface SourceInfo {
    source: string
    similarity_score: number
    content: string
}

export interface GetSourcesRequest {
    query: string
    collection_id: number
    temperature?: number
    top_k?: number
    custom_prompt?: string
}

export interface GetSourcesResponse {
    sources: SourceInfo[]
    query: string
    collection_id: number
    error?: string
}

export interface TranslateRequest {
    text: string
}

export interface TranslateResponse {
    translated_text?: string
    error?: string
}

export interface TTSRequest {
    text: string
    voice?: string
}

// API Response wrapper
export interface ApiResponse<T> {
    data: T
    message?: string
    success: boolean
}

// Error response
export interface ApiError {
    detail: string
    status_code?: number
    timestamp?: string
}

// Pagination
export interface PaginatedResponse<T> {
    items: T[]
    total: number
    page: number
    size: number
    pages: number
}

// Health check
export interface HealthCheck {
    status: string
    service: string
    version: string
    timestamp: string
    environment: string
    components?: Record<string, any>
    metrics?: Record<string, any>
}

// User Settings
export interface UserSettings {
    id: number
    user_id: number
    default_temperature: number
    default_top_k: number
    preferred_collection_id: number | null
    theme: string
    language: string
    auto_save_chat: boolean
    show_translations: boolean
    enable_tts: boolean
    created_at: string
    updated_at: string
}

export interface UserSettingsUpdate {
    default_temperature?: number
    default_top_k?: number
    preferred_collection_id?: number | null
    theme?: string
    language?: string
    auto_save_chat?: boolean
    show_translations?: boolean
    enable_tts?: boolean
}

export interface UserSettingsResponse {
    success: boolean
    message: string
    data: UserSettings
}

// Cache Monitoring
export interface CacheStats {
    cache_stats: Record<string, any>
    monitor_stats: Record<string, any>
    timestamp: string
    rag_service?: {
        embeddings_cache_info: string
        vector_results_cache_info: string
        llm_responses_cache_info: string
        document_chunks_cache_info: string
        cache_warming_active: boolean
        cache_health: any
    }
}

export interface CacheHealth {
    health: any
    recent_alerts: any[]
    alerts_count: number
}

// Chat session types (frontend-specific)
// Sync note: Backend uses snake_case, frontend uses camelCase
export interface ChatMessage {
    id: string
    session_id?: string  // Added to sync with backend
    text: string         // Backend field is 'content'
    translation?: string
    sender: 'user' | 'ai'
    timestamp: Date      // Backend field is 'created_at'
    sources?: SourceInfo[]
    suggestions?: string[]
    aiAskedQuestion?: boolean
}

export interface ChatSession {
    id: string
    user_id?: number     // Added to sync with backend
    title: string
    messages: ChatMessage[]
    collectionId: number | null
    temperature: number
    topK: number        // Backend field is 'top_k'
    timestamp: Date      // Backend field is 'created_at'
    vocalVoice?: 'en_female' | 'hi_female'  // Backend: 'vocal_voice'
    customRAGPrompt?: string  // Backend: 'custom_rag_prompt'
    updated_at?: Date   // Added to sync with backend
    is_active?: boolean  // Added to sync with backend
}

// Collection list response
export interface CollectionListResponse {
    collections: Collection[]
}

// Document list response
export interface DocumentListResponse {
    documents: Document[]
}

// Upload response
export interface UploadResponse {
    message: string
    document?: Document
}

// Chat API types (backend aligned with snake_case)
export interface ChatSessionBackend {
    id: number
    user_id: number
    title: string
    collection_id: number | null
    temperature: number
    top_k: number
    created_at: string
    updated_at?: string
    vocal_voice?: string
    custom_rag_prompt?: string
    is_active: boolean
}

export interface ChatMessageBackend {
    id: number
    session_id: number
    content: string
    sender: 'user' | 'ai'
    created_at: string
    translation?: string
    sources?: unknown
}

export interface ChatSessionsResponse {
    sessions: ChatSessionBackend[]
}

export interface ChatMessagesResponse {
    messages: ChatMessageBackend[]
}
