// Modern Chat page - Light theme
import React, { useEffect, useRef, useState, lazy, Suspense } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useChat } from '../hooks/useChat'
import ChatSidebar from '../components/chat/ChatSidebar'
import ChatMessages from '../components/chat/ChatMessages'
import ChatInput from '../components/chat/ChatInput'
import AISettingsPanel from '../components/chat/AISettingsPanel'
import {
    Brain,
    Sparkles,
    Settings,
    X,
    Menu,
    Database,
    ChevronRight,
    Home,
    FileText,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

// Lazy load heavy WebGL components
const ShapeGenerator = lazy(() => import('../components/webGL/ShapeGenerator'))
const WebGLBackground = lazy(() => import('../components/webGL/WebGLBackground'))

const Chat = () => {
    const { user } = useAuth()
    const navigate = useNavigate()
    const {
        collections, sessions, activeSessionId, input, loading, error,
        activeUtilityId, currentShape, particleCount, userSettings, messages,
        selectedColId, temperature, topK, vocalVoice, customRAGPrompt,
        hasActiveThread, audioRef, streamingMessage,
        setInput, setError, setActiveUtilityId, setActiveSessionId,
        handleShapeChange, handleParticleCountChange, handleUpdateSettings,
        handleCollectionChange, handleVocalVoiceChange, handleCustomRAGPromptChange,
        handleSaveSettings, handleResetToDefaults, handleNewChat, handleDeleteSession,
        copyToClipboard, handleSpeak, handleTranslate, handleFetchSources, handleSend,
        handleStopGeneration, handleRestartGeneration, hasPartialResponse, clearCache,
    } = useChat()

    const [isLeftCollapsed, setIsLeftCollapsed] = React.useState(false)
    const [isRightCollapsed, setIsRightCollapsed] = React.useState(false)
    const [servicesReady, setServicesReady] = React.useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!user) return

        const checkServices = async () => {
            try {
                const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/rag/cache/health`, {
                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
                })
                if (response.ok) {
                    setServicesReady(true)
                } else {
                    setServicesReady(false)
                }
            } catch {
                setServicesReady(false)
            }
        }

        checkServices()
        const interval = setInterval(checkServices, 30000)
        return () => clearInterval(interval)
    }, [user])

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages, streamingMessage?.text])

    // Handle suggestion clicks
    useEffect(() => {
        const handleSuggestionClick = (e: CustomEvent) => {
            const suggestion = e.detail
            if (suggestion && typeof suggestion === 'string') {
                setInput(suggestion)
                setTimeout(() => handleSend(), 100)
            }
        }
        window.addEventListener('suggestion-click', handleSuggestionClick as EventListener)
        return () => window.removeEventListener('suggestion-click', handleSuggestionClick as EventListener)
    }, [])

    if (!user) {
        return (
            <div className="flex items-center justify-center h-screen bg-gradient-to-br from-slate-100 via-purple-50 to-slate-100 text-slate-800">
                <div className="text-center">
                    <div className="relative mb-6">
                        <div className="absolute inset-0 bg-purple-400 blur-3xl opacity-20 rounded-full"></div>
                        <Brain className="w-20 h-20 mx-auto relative z-10 text-purple-600" />
                    </div>
                    <h2 className="text-3xl font-bold mb-2 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                        Olivia AI
                    </h2>
                    <p className="text-slate-500">Please login to continue</p>
                </div>
            </div>
        )
    }

    return (
        <div className="flex h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-slate-100 text-slate-800 overflow-hidden relative">
            {/* WebGL Background - Lazy loaded */}
            <div className="absolute inset-0 z-0">
                <Suspense fallback={null}>
                    <WebGLBackground
                        shape={currentShape}
                        particleCount={particleCount}
                    />
                </Suspense>
            </div>

            {/* Left Sidebar */}
            <div className={`${isLeftCollapsed ? 'w-0' : 'w-72'} transition-all duration-300 flex-shrink-0 relative z-10 border-r border-slate-200`}>
                <ChatSidebar
                    sessions={sessions}
                    activeSessionId={activeSessionId}
                    onSessionSelect={setActiveSessionId}
                    onNewSession={handleNewChat}
                    onDeleteSession={handleDeleteSession}
                    collections={collections}
                    isCollapsed={isLeftCollapsed}
                />
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0 relative z-10">
                {/* Header */}
                <header className="flex items-center justify-between px-4 py-3 bg-white/80 backdrop-blur-md border-b border-slate-200">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setIsLeftCollapsed(!isLeftCollapsed)}
                            className="p-2 hover:bg-slate-100 rounded-xl transition-all duration-200"
                        >
                            <Menu className="w-5 h-5 text-slate-600" />
                        </button>
                        
                        {/* Navigation Icons */}
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => navigate('/dashboard')}
                                className="p-2 hover:bg-slate-100 rounded-xl transition-all duration-200"
                                title="Dashboard"
                            >
                                <Home className="w-5 h-5 text-slate-600 hover:text-slate-900" />
                            </button>
                            <button
                                onClick={() => navigate('/documents')}
                                className="p-2 hover:bg-slate-100 rounded-xl transition-all duration-200"
                                title="Documents"
                            >
                                <FileText className="w-5 h-5 text-slate-600 hover:text-slate-900" />
                            </button>
                        </div>

                        <div className="h-6 w-px bg-slate-300"></div>

                        <div className="flex items-center gap-2">
                            <div className="relative">
                                <Brain className="w-7 h-7 text-purple-600" />
                                <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${servicesReady ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                            </div>
                            <div>
                                <h1 className="text-lg font-bold text-slate-800">Olivia AI</h1>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Shape Selector on Navbar - Lazy loaded */}
                        <div className="hidden md:flex items-center gap-1 bg-white rounded-lg p-1 shadow-lg z-50 relative">
                            <Suspense fallback={<div className="w-8 h-8" />}>
                                <ShapeGenerator
                                    currentShape={currentShape}
                                    onShapeChange={handleShapeChange}
                                />
                            </Suspense>
                        </div>

                        <button
                            onClick={() => setIsRightCollapsed(!isRightCollapsed)}
                            className="p-2 hover:bg-slate-100 rounded-xl transition-all duration-200"
                        >
                            {isRightCollapsed ? <ChevronRight className="w-5 h-5 text-slate-600" /> : <Settings className="w-5 h-5 text-slate-600" />}
                        </button>
                    </div>
                </header>

                {/* Chat Area */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Messages Area */}
                    <div className="flex-1 flex flex-col">
                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                            {messages.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-center">
                                    <div className="w-28 h-28 bg-purple-100 rounded-full flex items-center justify-center mb-6">
                                        <Brain className="w-14 h-14 text-purple-600" />
                                    </div>
                                    <h2 className="text-2xl font-bold text-slate-800 mb-2">
                                        Start a Conversation
                                    </h2>
                                    <p className="text-slate-500 max-w-md">
                                        Select a knowledge base from the settings panel and start chatting with Olivia AI.
                                    </p>
                                </div>
                            ) : (
                                <>
                                    {messages.map((message) => (
                                        <ChatMessages
                                            key={message.id}
                                            messages={[message]}
                                            isLoading={false}
                                            error={null}
                                            currentPage={1}
                                            itemsPerPage={100}
                                            onRetry={() => {}}
                                            activeUtilityId={activeUtilityId}
                                            onCopy={copyToClipboard}
                                            onSpeak={handleSpeak}
                                            onTranslate={handleTranslate}
                                            onFetchSources={handleFetchSources}
                                            collectionId={selectedColId ? parseInt(selectedColId) : null}
                                            isStreaming={false}
                                        />
                                    ))}
                                    {streamingMessage && (
                                        <ChatMessages
                                            messages={[{
                                                id: streamingMessage.id,
                                                text: streamingMessage.text,
                                                sender: 'ai',
                                                timestamp: new Date(),
                                                sources: streamingMessage.sources,
                                            }]}
                                            isLoading={false}
                                            error={null}
                                            currentPage={1}
                                            itemsPerPage={100}
                                            onRetry={() => {}}
                                            activeUtilityId={null}
                                            onCopy={copyToClipboard}
                                            onSpeak={handleSpeak}
                                            onTranslate={handleTranslate}
                                            onFetchSources={handleFetchSources}
                                            collectionId={selectedColId ? parseInt(selectedColId) : null}
                                            isStreaming={true}
                                            streamingText={streamingMessage.text}
                                        />
                                    )}
                                    <div ref={messagesEndRef} />
                                </>
                            )}
                        </div>

                        {/* Input Area - Full Width */}
                        <div className="px-4 py-3 bg-white/80 backdrop-blur-md border-t border-slate-200">
                            <div className="w-full">
                                <ChatInput
                                    inputValue={input}
                                    setInputValue={setInput}
                                    onSend={handleSend}
                                    onStop={handleStopGeneration}
                                    onRestart={handleRestartGeneration}
                                    hasPartialResponse={hasPartialResponse}
                                    isLoading={loading}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Right Panel - AI Settings */}
                    {!isRightCollapsed && (
                        <div className="w-80 bg-white/80 backdrop-blur-md border-l border-slate-200 overflow-y-auto">
                            <AISettingsPanel
                                temperature={temperature}
                                topK={topK}
                                vocalVoice={vocalVoice}
                                customRAGPrompt={customRAGPrompt}
                                onUpdateSettings={handleUpdateSettings}
                                onCollectionChange={handleCollectionChange}
                                onVocalVoiceChange={handleVocalVoiceChange}
                                onCustomRAGPromptChange={handleCustomRAGPromptChange}
                                onSaveSettings={handleSaveSettings}
                                onResetToDefaults={handleResetToDefaults}
                                collections={collections}
                                selectedCollectionId={selectedColId}
                                hasActiveThread={hasActiveThread}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default Chat
