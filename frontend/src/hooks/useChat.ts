/**
 * Chat Hook - Unified session management with persistent storage
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { chatApi, ragApi, collectionApi, authApi } from '../services/api'
import { storage, STORAGE_KEYS } from '../utils/storage'
import type { Collection, ChatMessage, ChatSession, UserSettings, ChatRequest, SourceInfo } from '../types/api'

interface StreamingState {
    id: string
    text: string
    sources?: SourceInfo[]
}
import type { ParticleShape } from '../utils/shapeGenerators'

function restoreSessionDates(sessions: ChatSession[]): ChatSession[] {
    return sessions.map((session) => ({
        ...session,
        timestamp: new Date(session.timestamp),
        messages: session.messages.map((msg) => ({
            ...msg,
            timestamp: new Date(msg.timestamp),
        })),
    }))
}

export function useChat() {
    const { user } = useAuth()
    const chatEndRef = useRef<HTMLDivElement>(null)
    const audioRef = useRef<HTMLAudioElement | null>(null)
    const cachedActiveSessionRef = useRef<string | null>(null)
    const sessionsLoadedRef = useRef(false)

    const [collections, setCollections] = useState<Collection[]>([])
    const [sessions, setSessions] = useState<ChatSession[]>([])
    const [activeSessionId, setActiveSessionId] = useState<string>('')
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [activeUtilityId, setActiveUtilityId] = useState<string | null>(null)
    const [currentShape, setCurrentShape] = useState<ParticleShape>('none')
    const [particleCount, setParticleCount] = useState(1000)
    const [streamingMessage, setStreamingMessage] = useState<StreamingState | null>(null)
    const [userSettings, setUserSettings] = useState<UserSettings | null>(null)
    const [selectedColId, setSelectedColId] = useState<string | null>(null)
    const [customRAGPrompt, setCustomRAGPrompt] = useState<string>('')

    const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[0]
    const messages = activeSession?.messages || []
    const temperature = activeSession?.temperature || 0.7
    const topK = activeSession?.topK || 20
    const vocalVoice = (activeSession?.vocalVoice as 'en_female' | 'hi_female') || 'en_female'
    const hasActiveThread = messages.some((m) => m.sender === 'user')

    const loadCachedData = useCallback(() => {
        const cachedSessions = storage.get<ChatSession[]>(STORAGE_KEYS.SESSIONS, [])
        const cachedActiveId = storage.get<string>(STORAGE_KEYS.ACTIVE_SESSION, '')
        const cachedCollections = storage.get<Collection[]>(STORAGE_KEYS.COLLECTIONS, [])
        const cachedSettings = storage.get<UserSettings | null>(STORAGE_KEYS.USER_SETTINGS, null)
        const cachedSelectedColId = storage.get<string | null>(STORAGE_KEYS.SELECTED_COLLECTION, null)
        const cachedCustomPrompt = storage.get<string>(STORAGE_KEYS.CUSTOM_RAG_PROMPT, '')

        // Store the cached active session ID in a ref for later use
        cachedActiveSessionRef.current = cachedActiveId || null

        // Load cached selected collection
        if (cachedSelectedColId) {
            setSelectedColId(cachedSelectedColId)
        } else if (cachedSettings?.preferred_collection_id) {
            setSelectedColId(cachedSettings.preferred_collection_id.toString())
        }

        // Load cached custom RAG prompt
        if (cachedCustomPrompt) {
            setCustomRAGPrompt(cachedCustomPrompt)
        }

        if (cachedSessions.length > 0) {
            const sessionsWithDates = restoreSessionDates(cachedSessions)
            setSessions(sessionsWithDates)
            
            if (cachedActiveId && sessionsWithDates.find((s: ChatSession) => s.id === cachedActiveId)) {
                setActiveSessionId(cachedActiveId)
            } else if (sessionsWithDates.length > 0) {
                setActiveSessionId(sessionsWithDates[0].id)
            }
        } else {
            initializeDefaultSession()
        }

        if (cachedCollections.length > 0) {
            setCollections(cachedCollections)
        }

        if (cachedSettings) {
            setUserSettings(cachedSettings)
        }
        
        sessionsLoadedRef.current = true
    }, [])

    const loadSessionsFromAPI = useCallback(async () => {
        if (!user) return

        try {
            const response = await chatApi.getSessions()
            const rawSessions = response.sessions || []

            const formattedSessions = await Promise.all(
                rawSessions.map(async (session: unknown) => {
                    const s = session as { id: number; title: string; [key: string]: unknown }
                    let messages: ChatMessage[] = []
                    try {
                        const msgsResponse = await chatApi.getMessages(s.id)
                        messages = (msgsResponse.messages || []).map((m: unknown) => {
                            const msg = m as { id: number; content: string; sender: string; created_at: string; translation?: string; sources?: SourceInfo[] }
                            return {
                                id: msg.id.toString(),
                                text: msg.content,
                                sender: msg.sender as 'user' | 'ai',
                                timestamp: new Date(msg.created_at),
                                translation: msg.translation,
                                sources: msg.sources || [],
                            }
                        })
                    } catch {
                        console.warn(`Failed to load messages for session ${s.id}`)
                    }
                    return {
                        id: s.id.toString(),
                        title: s.title,
                        collectionId: (s.collection_id as number | null) || null,
                        temperature: s.temperature as number,
                        topK: (s.top_k as number) || 20,
                        vocalVoice: ((s.vocal_voice as string) || 'en_female') as 'en_female' | 'hi_female',
                        customRAGPrompt: (s.custom_rag_prompt as string) || '',
                        timestamp: new Date(s.created_at as string),
                        messages,
                    }
                })
            )

            setSessions(formattedSessions)
            storage.set(STORAGE_KEYS.SESSIONS, formattedSessions)

            // Use the cached active session ID from ref if it exists
            const savedActiveId = cachedActiveSessionRef.current
            
            // Only set active session from API if we don't have a cached one
            if (savedActiveId && formattedSessions.find((s: ChatSession) => s.id === savedActiveId)) {
                // Keep the cached active session ID - already set in loadCachedData
            } else if (formattedSessions.length > 0 && !activeSessionId) {
                setActiveSessionId(formattedSessions[0].id)
            } else if (formattedSessions.length === 0 && !activeSessionId) {
                initializeDefaultSession()
            }
        } catch (err) {
            console.error('Failed to load sessions from API:', err)
            const cachedSessions = storage.get<ChatSession[]>(STORAGE_KEYS.SESSIONS, [])
            if (cachedSessions.length > 0) {
                const sessionsWithDates = restoreSessionDates(cachedSessions)
                setSessions(sessionsWithDates)
                const savedActiveId = storage.get<string>(STORAGE_KEYS.ACTIVE_SESSION, '')
                if (savedActiveId && sessionsWithDates.find((s: ChatSession) => s.id === savedActiveId)) {
                    setActiveSessionId(savedActiveId)
                } else {
                    setActiveSessionId(sessionsWithDates[0].id)
                }
            } else {
                initializeDefaultSession()
            }
        }
    }, [user])

    const loadCollectionsFromAPI = useCallback(async () => {
        if (!user) return

        try {
            const response = await collectionApi.getAll()
            setCollections(response)
            storage.set(STORAGE_KEYS.COLLECTIONS, response)

            if (response.length > 0 && sessions.length === 1 && sessions[0].messages.length === 0) {
                const def = response.find((c: Collection) => c.is_default) || response[0]
                setSessions((prev) =>
                    prev.map((s) =>
                        s.id === 'default'
                            ? {
                                  ...s,
                                  collectionId: def.id,
                                  messages: [{
                                      id: 'init',
                                      text: `Session initialized with **${def.name}** (${def.document_count} files). How can I assist your analysis?`,
                                      sender: 'ai' as const,
                                      timestamp: new Date(),
                                  }],
                              }
                            : s
                    )
                )
            }
        } catch (err) {
            console.error('Failed to load collections:', err)
            const cached = storage.get<Collection[]>(STORAGE_KEYS.COLLECTIONS, [])
            if (cached.length > 0) {
                setCollections(cached)
            }
        }
    }, [user, sessions.length])

    const loadUserSettingsFromAPI = useCallback(async () => {
        if (!user) return

        try {
            const response = await authApi.getSettings()
            if (response.success && response.data) {
                setUserSettings(response.data)
                storage.set(STORAGE_KEYS.USER_SETTINGS, response.data)
            }
        } catch (err) {
            console.error('Failed to load user settings:', err)
            const cached = storage.get<UserSettings | null>(STORAGE_KEYS.USER_SETTINGS, null)
            if (cached) {
                setUserSettings(cached)
            }
        }
    }, [user])

    useEffect(() => {
        if (!user) {
            setSessions([])
            setActiveSessionId('')
            setCollections([])
            setUserSettings(null)
            return
        }

        loadCachedData()
        loadSessionsFromAPI()
        loadCollectionsFromAPI()
        loadUserSettingsFromAPI()
    }, [user])

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages, streamingMessage?.text])

    useEffect(() => {
        if (sessions.length > 0) {
            storage.set(STORAGE_KEYS.SESSIONS, sessions)
        }
        if (activeSessionId) {
            storage.set(STORAGE_KEYS.ACTIVE_SESSION, activeSessionId)
        }
    }, [sessions, activeSessionId])

    useEffect(() => {
        if (selectedColId) {
            storage.set(STORAGE_KEYS.SELECTED_COLLECTION, selectedColId)
        }
    }, [selectedColId])

    useEffect(() => {
        if (customRAGPrompt) {
            storage.set(STORAGE_KEYS.CUSTOM_RAG_PROMPT, customRAGPrompt)
        }
    }, [customRAGPrompt])

    // Sync selectedColId when switching sessions
    useEffect(() => {
        if (activeSession && activeSession.collectionId) {
            setSelectedColId(activeSession.collectionId.toString())
        }
    }, [activeSessionId])

    // Sync customRAGPrompt when switching sessions
    useEffect(() => {
        if (activeSession && activeSession.customRAGPrompt) {
            setCustomRAGPrompt(activeSession.customRAGPrompt)
        }
    }, [activeSessionId])

    function initializeDefaultSession() {
        const defaultSession: ChatSession = {
            id: 'default',
            title: 'New Chat',
            messages: [],
            collectionId: null,
            temperature: 0.7,
            topK: 20,
            timestamp: new Date(),
            vocalVoice: 'en_female',
            customRAGPrompt: '',
        }
        setSessions([defaultSession])
        setActiveSessionId('default')
    }

    async function updateActiveSession(update: Partial<ChatSession>) {
        setSessions((prev) => prev.map((s) => (s.id === activeSessionId ? { ...s, ...update } : s)))

        if (activeSessionId && activeSessionId !== 'default' && !isNaN(parseInt(activeSessionId))) {
            try {
                const dbUpdateData = {
                    title: update.title,
                    collection_id: update.collectionId,
                    temperature: update.temperature,
                    top_k: update.topK,
                    vocal_voice: update.vocalVoice,
                    custom_rag_prompt: update.customRAGPrompt,
                }
                await chatApi.updateSession(parseInt(activeSessionId), dbUpdateData)
            } catch (err) {
                console.error('Failed to update session:', err)
            }
        }
    }

    async function handleNewChat() {
        const selectedCollection = userSettings?.preferred_collection_id || collections.find((c) => c.is_default)?.id || collections[0]?.id

        if (!selectedCollection) {
            setError('No collections available. Please create a collection first.')
            setTimeout(() => setError(null), 5000)
            return
        }

        try {
            const sessionData = {
                title: `Chat Session ${sessions.length + 1}`,
                collection_id: selectedCollection,
                temperature: userSettings?.default_temperature ?? 0.7,
                top_k: userSettings?.default_top_k ?? 20,
                vocal_voice: userSettings?.language === 'hi' ? 'hi_female' : 'en_female',
                custom_rag_prompt: '',
            }

            const response = await chatApi.createSession(sessionData)

            const newSession: ChatSession = {
                id: (response as { id: number }).id.toString(),
                title: (response as { title: string }).title,
                collectionId: (response as { collection_id: number }).collection_id,
                temperature: (response as { temperature: number }).temperature,
                topK: (response as { top_k: number }).top_k,
                timestamp: new Date(),
                vocalVoice: ((response as { vocal_voice?: string }).vocal_voice as 'en_female' | 'hi_female') || 'en_female',
                customRAGPrompt: ((response as { custom_rag_prompt?: string }).custom_rag_prompt) || '',
                messages: [],
            }

            setSessions((prev) => [...prev, newSession])
            setActiveSessionId(newSession.id)
            setInput('')
        } catch (error) {
            console.error('Failed to create session:', error)
        }
    }

    async function handleDeleteSession(sessionId: string) {
        if (sessions.length <= 1) return

        if (sessionId !== 'default' && !isNaN(parseInt(sessionId))) {
            try {
                await chatApi.deleteSession(parseInt(sessionId))
            } catch (err) {
                console.error('Failed to delete session:', err)
            }
        }

        const newSessions = sessions.filter((s) => s.id !== sessionId)
        setSessions(newSessions)
        if (activeSessionId === sessionId) {
            setActiveSessionId(newSessions[0].id)
        }
    }

    function copyToClipboard(text: string) {
        navigator.clipboard.writeText(text)
    }

    async function handleSpeak(messageId: string, text: string) {
        if (activeUtilityId === messageId + '-tts') {
            if (audioRef.current) {
                audioRef.current.pause()
                audioRef.current = null
            }
            setActiveUtilityId(null)
            return
        }

        if (audioRef.current) {
            audioRef.current.pause()
            audioRef.current = null
        }

        setActiveUtilityId(messageId + '-tts')
        try {
            const isHindi = /[\u0900-\u097F]/.test(text)
            const isMale = vocalVoice.endsWith('_male')
            const targetVoice = isHindi
                ? isMale ? 'hi_male' : 'hi_female'
                : isMale ? 'en_male' : 'en_female'

            const audioBlob = await ragApi.textToSpeech({ text, voice: targetVoice })
            const audioUrl = URL.createObjectURL(audioBlob)
            const audio = new Audio(audioUrl)
            audioRef.current = audio
            audio.play()

            audio.onended = () => {
                URL.revokeObjectURL(audioUrl)
                setActiveUtilityId(null)
                audioRef.current = null
            }
            audio.onerror = () => {
                console.error('Audio playback failed')
                URL.revokeObjectURL(audioUrl)
                setActiveUtilityId(null)
                audioRef.current = null
            }
        } catch (err) {
            console.error('TTS failed:', err)
            setError('Audio playback unavailable')
            setTimeout(() => setError(null), 5000)
            setActiveUtilityId(null)
        }
    }

    async function handleTranslate(messageId: string, text: string) {
        setActiveUtilityId(messageId + '-translate')
        try {
            const response = await ragApi.translate({ text })
            if (response.translated_text) {
                setSessions((prev) =>
                    prev.map((s) =>
                        s.id === activeSessionId
                            ? {
                                  ...s,
                                  messages: s.messages.map((m) =>
                                      m.id === messageId ? { ...m, translation: response.translated_text } : m
                                  ),
                              }
                            : s
                    )
                )
            } else {
                setError('Translation failed')
                setTimeout(() => setError(null), 5000)
            }
        } catch (err) {
            console.error('Translation failed:', err)
            setError('Translation unavailable')
            setTimeout(() => setError(null), 5000)
        } finally {
            setActiveUtilityId(null)
        }
    }

    async function handleFetchSources(messageId: string, query: string, collectionId: number) {
        if (!collectionId) {
            setError('No collection selected')
            return
        }
        setActiveUtilityId(messageId + '-sources')
        try {
            const response = await ragApi.getSources({
                query,
                collection_id: collectionId,
                temperature,
                top_k: topK,
                custom_prompt: customRAGPrompt,
            })
            if (response.error) {
                setError('Failed to fetch sources')
                setTimeout(() => setError(null), 5000)
            } else {
                setSessions((prev) =>
                    prev.map((s) =>
                        s.id === activeSessionId
                            ? {
                                  ...s,
                                  messages: s.messages.map((m) =>
                                      m.id === messageId ? { ...m, sources: response.sources } : m
                                  ),
                              }
                            : s
                    )
                )
            }
        } catch (err) {
            console.error('Source fetch failed:', err)
            setError('Source fetch unavailable')
            setTimeout(() => setError(null), 5000)
        } finally {
            setActiveUtilityId(null)
        }
    }

    async function handleSend() {
        if (!input.trim() || loading || !selectedColId) return

        const userMessage: ChatMessage = {
            id: Date.now().toString(),
            text: input.trim(),
            sender: 'user',
            timestamp: new Date(),
        }

        let newTitle = activeSession.title
        if (!hasActiveThread) {
            newTitle = userMessage.text.slice(0, 30) + (userMessage.text.length > 30 ? '...' : '')
        }

        const aiMessageId = (Date.now() + 1).toString()
        setStreamingMessage({ id: aiMessageId, text: '' })

        setSessions((prev) =>
            prev.map((s) =>
                s.id === activeSessionId
                    ? { ...s, messages: [...s.messages, userMessage], title: newTitle }
                    : s
            )
        )

        setInput('')
        setLoading(true)
        setError(null)

        try {
            if (activeSessionId && activeSessionId !== 'default' && !isNaN(parseInt(activeSessionId))) {
                chatApi.createMessage(parseInt(activeSessionId), {
                    content: userMessage.text,
                    sender: 'user',
                }).catch(console.error)
                if (newTitle !== activeSession.title) {
                    chatApi.updateSession(parseInt(activeSessionId), { title: newTitle }).catch(console.error)
                }
            }

            const request: ChatRequest = {
                query: userMessage.text,
                collection_id: selectedColId ? parseInt(selectedColId) : 0,
                temperature,
                top_k: topK,
                custom_prompt: customRAGPrompt,
                fetch_sources: true,
            }

            const stream = await chatApi.streamChat(request)
            const reader = stream.getReader()
            const decoder = new TextDecoder()
            let accumulatedText = ''
            let accumulatedSources: SourceInfo[] = []
            let buffer = ''

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                const chunk = decoder.decode(value, { stream: true })
                buffer += chunk

                while (buffer.includes('\n')) {
                    const newlineIndex = buffer.indexOf('\n')
                    const line = buffer.slice(0, newlineIndex)
                    buffer = buffer.slice(newlineIndex + 1)

                    if (line.startsWith('data: ')) {
                        const jsonData = line.slice(6).trim()
                        if (jsonData) {
                            try {
                                const parsed = JSON.parse(jsonData)
                                if (parsed.type === 'sources') {
                                    accumulatedSources = parsed.sources || []
                                    setStreamingMessage((prev) =>
                                        prev ? { ...prev, sources: accumulatedSources } : null
                                    )
                                    continue
                                } else if (parsed.type === 'chunk' && parsed.content) {
                                    accumulatedText += parsed.content
                                } else if (parsed.type === 'error') {
                                    console.error('Stream error:', parsed.message)
                                }
                            } catch {
                            }
                        }
                    }
                }
                setStreamingMessage((prev) =>
                    prev ? { ...prev, text: accumulatedText } : null
                )
            }

            const finalAiMessage: ChatMessage = {
                id: aiMessageId,
                text: accumulatedText,
                sender: 'ai',
                timestamp: new Date(),
                sources: accumulatedSources as SourceInfo[],
            }

            setSessions((prev) =>
                prev.map((s) =>
                    s.id === activeSessionId
                        ? { ...s, messages: [...s.messages, finalAiMessage] }
                        : s
                )
            )

            if (activeSessionId && activeSessionId !== 'default' && !isNaN(parseInt(activeSessionId)) && accumulatedText.trim()) {
                chatApi.createMessage(parseInt(activeSessionId), {
                    content: accumulatedText,
                    sender: 'ai',
                    sources: accumulatedSources,
                }).catch(console.error)
            }
        } catch (err) {
            console.error('Streaming error:', err)
            setError('Communication error. Please check your connection.')
        } finally {
            setLoading(false)
            setStreamingMessage(null)
        }
    }

    function handleUpdateSettings(settings: { temperature: number; topK: number }) {
        updateActiveSession({ temperature: settings.temperature, topK: settings.topK })
    }

    function handleCollectionChange(collectionId: string | null) {
        if (hasActiveThread) {
            setError('Cannot change collection once conversation has started.')
            setTimeout(() => setError(null), 5000)
            return
        }
        const parsedId = collectionId ? parseInt(collectionId) : null
        setSelectedColId(collectionId)
        updateActiveSession({ collectionId: parsedId })
        
        // Save preferred collection to backend
        authApi.updateSettings({
            preferred_collection_id: parsedId,
        }).catch(console.error)
    }

    function handleVocalVoiceChange(vocalVoice: 'en_female' | 'hi_female') {
        updateActiveSession({ vocalVoice })
    }

    function handleCustomRAGPromptChange(customRAGPrompt: string) {
        setCustomRAGPrompt(customRAGPrompt)
        updateActiveSession({ customRAGPrompt })
    }

    function handleShapeChange(shape: ParticleShape) {
        setCurrentShape(shape)
    }

    function handleParticleCountChange(density: number) {
        setParticleCount(Math.round(density * 1500))
    }

    async function handleSaveSettings() {
        try {
            await authApi.updateSettings({
                default_temperature: temperature,
                default_top_k: topK,
                preferred_collection_id: selectedColId ? parseInt(selectedColId.toString()) : null,
            })
        } catch (error) {
            console.error('Failed to save settings:', error)
            throw error
        }
    }

    async function handleResetToDefaults() {
        try {
            const response = await authApi.resetSettings()
            updateActiveSession({
                temperature: response.data.default_temperature,
                topK: response.data.default_top_k,
                collectionId: response.data.preferred_collection_id,
                customRAGPrompt: '',
            })
        } catch (error) {
            console.error('Failed to reset settings:', error)
        }
    }

    function clearCache() {
        storage.remove(STORAGE_KEYS.SESSIONS)
        storage.remove(STORAGE_KEYS.ACTIVE_SESSION)
        storage.remove(STORAGE_KEYS.COLLECTIONS)
        storage.remove(STORAGE_KEYS.USER_SETTINGS)
        storage.remove(STORAGE_KEYS.SELECTED_COLLECTION)
        storage.remove(STORAGE_KEYS.CUSTOM_RAG_PROMPT)
    }

    return {
        collections, sessions, activeSessionId, input, loading, error,
        activeUtilityId, currentShape, particleCount, userSettings, messages,
        selectedColId, temperature, topK, vocalVoice, customRAGPrompt,
        hasActiveThread, chatEndRef, audioRef, streamingMessage,
        setInput, setError, setActiveUtilityId, setActiveSessionId,
        handleShapeChange, handleParticleCountChange, handleUpdateSettings,
        handleCollectionChange, handleVocalVoiceChange, handleCustomRAGPromptChange,
        handleSaveSettings, handleResetToDefaults, handleNewChat, handleDeleteSession,
        copyToClipboard, handleSpeak, handleTranslate, handleFetchSources, handleSend,
        clearCache,
    }
}
