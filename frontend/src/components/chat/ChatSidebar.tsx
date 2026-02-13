// Chat sidebar for session management - Light compact design
import React, { useState, useEffect } from 'react'
import Button from '../ui/Button'
import {
    MessageSquare,
    Plus,
    Trash2,
    Clock,
    MessageCircle,
    Sparkles,
    User,
    Bot,
} from 'lucide-react'
import type { Collection, ChatSession } from '../../types/api'

interface ChatSidebarProps {
    sessions: ChatSession[]
    activeSessionId: string
    onSessionSelect: (sessionId: string) => void
    onNewSession: () => void
    onDeleteSession: (sessionId: string) => void
    collections: Collection[]
    isCollapsed: boolean
}

const ChatSidebar: React.FC<ChatSidebarProps> = ({
    sessions = [],
    activeSessionId = '',
    onSessionSelect = () => {},
    onNewSession = () => {},
    onDeleteSession = () => {},
    collections = [],
    isCollapsed = false,
}) => {
    const currentSession = sessions.find((s) => s.id === activeSessionId)
    const userMessages = currentSession?.messages.filter((m) => m.sender === 'user').length || 0
    const aiMessages = currentSession?.messages.filter((m) => m.sender === 'ai').length || 0
    const totalMessages = (currentSession?.messages.length || 0)
    const [sessionDuration, setSessionDuration] = useState(() => {
        if (!currentSession?.timestamp) return 0
        return Math.floor((Date.now() - new Date(currentSession.timestamp).getTime()) / (1000 * 60))
    })

    useEffect(() => {
        if (!currentSession?.timestamp) return
        const updateDuration = () => {
            setSessionDuration(Math.floor((Date.now() - new Date(currentSession.timestamp).getTime()) / (1000 * 60)))
        }
        updateDuration()
        const interval = setInterval(updateDuration, 60000)
        return () => clearInterval(interval)
    }, [currentSession?.timestamp])

    if (isCollapsed) return null

    return (
        <div className="h-full flex flex-col bg-white/80 backdrop-blur-xl border-r border-slate-200">
            {/* Header */}
            <div className="p-3 border-b border-slate-200">
                <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-4 h-4 text-purple-500" />
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Chats</span>
                </div>
                <Button
                    variant="primary"
                    onClick={onNewSession}
                    className="w-full flex items-center justify-center gap-2 text-sm py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 border-0 shadow-lg shadow-purple-500/20"
                >
                    <Plus className="w-4 h-4" />
                    <span>New Chat</span>
                </Button>
            </div>

            {/* Session List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {sessions.map((session) => {
                    const collection = (collections || []).find((c) => c.id === session.collectionId)
                    const collectionName = collection?.name || 'No collection'
                    const isActive = activeSessionId === session.id

                    return (
                        <div
                            key={session.id}
                            onClick={() => onSessionSelect(session.id)}
                            className={`group relative p-2.5 rounded-lg cursor-pointer transition-all duration-200 ${
                                isActive
                                    ? 'bg-purple-50 border border-purple-200'
                                    : 'hover:bg-slate-50 border border-transparent hover:border-slate-200'
                            }`}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                    isActive ? 'bg-purple-100' : 'bg-slate-100'
                                }`}>
                                    <MessageSquare className={`w-4 h-4 ${isActive ? 'text-purple-600' : 'text-slate-500'}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className={`text-sm font-medium truncate ${isActive ? 'text-slate-900' : 'text-slate-700'}`}>
                                        {session.title}
                                    </h3>
                                    <p className="text-xs text-slate-400 truncate">{collectionName}</p>
                                </div>
                                {sessions.length > 1 && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            onDeleteSession(session.id)
                                        }}
                                        className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-50 rounded-lg transition-all"
                                    >
                                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                    </button>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Compact Session Stats */}
            <div className="p-3 border-t border-slate-200 bg-slate-50">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 px-2 py-1.5 bg-white rounded-lg border border-slate-200">
                        <User className="w-3 h-3 text-blue-500" />
                        <span className="text-xs text-slate-600 font-medium">{userMessages}</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2 py-1.5 bg-white rounded-lg border border-slate-200">
                        <Bot className="w-3 h-3 text-purple-500" />
                        <span className="text-xs text-slate-600 font-medium">{aiMessages}</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2 py-1.5 bg-white rounded-lg border border-slate-200">
                        <MessageCircle className="w-3 h-3 text-green-500" />
                        <span className="text-xs text-slate-600 font-medium">{totalMessages}</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2 py-1.5 bg-white rounded-lg border border-slate-200">
                        <Clock className="w-3 h-3 text-orange-500" />
                        <span className="text-xs text-slate-600 font-medium">{sessionDuration}m</span>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default React.memo(ChatSidebar)
