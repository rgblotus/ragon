// Individual chat message component for better organization
import React, { useState } from 'react'
import {
    User,
    Bot,
    Copy,
    Volume2,
    Languages,
    Edit2,
    Loader2,
    Square,
    ChevronDown,
    ChevronRight,
    FileText,
} from 'lucide-react'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import type { ChatMessage } from '../../types/api'

const parseMarkdown = (text: string): React.ReactNode[] => {
    const elements: React.ReactNode[] = []
    const lines = text.split('\n')
    let inCodeBlock = false
    let codeContent: string[] = []
    let codeKey = 0

    lines.forEach((line, lineIndex) => {
        if (line.startsWith('```')) {
            if (inCodeBlock) {
                elements.push(
                    <pre key={`code-${codeKey++}`} className="bg-slate-800 text-slate-100 p-3 rounded-lg my-2 overflow-x-auto text-xs font-mono">
                        <code>{codeContent.join('\n')}</code>
                    </pre>
                )
                codeContent = []
            }
            inCodeBlock = !inCodeBlock
            return
        }

        if (inCodeBlock) {
            codeContent.push(line)
            return
        }

        if (line.startsWith('### ')) {
            elements.push(
                <h4 key={lineIndex} className="text-sm font-bold text-purple-700 mt-3 mb-1">
                    {line.slice(4)}
                </h4>
            )
            return
        }

        if (line.startsWith('## ')) {
            elements.push(
                <h3 key={lineIndex} className="text-base font-bold text-purple-700 mt-3 mb-1">
                    {line.slice(3)}
                </h3>
            )
            return
        }

        if (line.startsWith('# ')) {
            elements.push(
                <h2 key={lineIndex} className="text-lg font-bold text-purple-700 mt-3 mb-2">
                    {line.slice(2)}
                </h2>
            )
            return
        }

        if (line.match(/^\d+\.\s/)) {
            const match = line.match(/^(\d+)\.\s(.*)$/)
            if (match) {
                elements.push(
                    <div key={lineIndex} className="flex gap-2 my-1">
                        <span className="text-purple-600 font-bold text-sm">{match[1]}.</span>
                        <span className="text-slate-700 text-sm" dangerouslySetInnerHTML={{ __html: formatInline(match[2]) }} />
                    </div>
                )
            }
            return
        }

        if (line.startsWith('- ') || line.startsWith('* ')) {
            elements.push(
                <div key={lineIndex} className="flex gap-2 my-1">
                    <span className="text-purple-500 mt-1">•</span>
                    <span className="text-slate-700 text-sm" dangerouslySetInnerHTML={{ __html: formatInline(line.slice(2)) }} />
                </div>
            )
            return
        }

        if (line.trim() === '') {
            elements.push(<br key={lineIndex} />)
            return
        }

        elements.push(
            <p key={lineIndex} className="text-slate-700 text-sm my-1" dangerouslySetInnerHTML={{ __html: formatInline(line) }} />
        )
    })

    return elements
}

const renderMath = (latex: string, displayMode: boolean): string => {
    try {
        return katex.renderToString(latex, {
            displayMode,
            throwOnError: false,
            errorColor: '#cc0000',
        })
    } catch {
        return latex
    }
}

const formatInline = (text: string): string => {
    text = text
        .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-slate-800">$1</strong>')
        .replace(/\*(.*?)\*/g, '<em class="italic text-slate-600">$1</em>')
        .replace(/`([^`]+)`/g, '<code class="bg-slate-100 text-purple-600 px-1.5 py-0.5 rounded text-xs font-mono">$1</code>')

    // Handle display math: $$...$$ and \[...\]
    text = text.replace(/\$\$(.+?)\$\$/gs, (_, latex) => {
        return `<div class="my-2 text-center">${renderMath(latex.trim(), true)}</div>`
    })

    text = text.replace(/\\\[(.+?)\\\]/gs, (_, latex) => {
        return `<div class="my-2 text-center">${renderMath(latex.trim(), true)}</div>`
    })

    // Handle inline math: $...$ and \(...\)
    text = text.replace(/\$([^$\n]+?)\$/g, (_, latex) => {
        return renderMath(latex.trim(), false)
    })

    text = text.replace(/\\\((.+?)\\\)/g, (_, latex) => {
        return renderMath(latex.trim(), false)
    })

    return text
}

interface ChatMessageProps {
    message: ChatMessage
    activeUtilityId: string | null
    onCopy: (text: string) => void
    onSpeak: (messageId: string, text: string) => void
    onTranslate: (messageId: string, text: string) => void
    onFetchSources?: (
        messageId: string,
        query: string,
        collectionId: number,
    ) => void
    collectionId?: number | null
    isStreaming?: boolean
}

const ChatMessageComponent: React.FC<ChatMessageProps> = ({
    message,
    activeUtilityId,
    onCopy,
    onSpeak,
    onTranslate,
    onFetchSources,
    collectionId,
    isStreaming = false,
}) => {
    const [sourcesExpanded, setSourcesExpanded] = useState(false)

    const isUser = message.sender === 'user'
    const hasTranslation = !!message.translation
    const hasSources = !!message.sources && message.sources.length > 0
    const isTTSActive = activeUtilityId === message.id + '-tts'
    const isTranslating = activeUtilityId === message.id + '-translate'

    return (
        <div className={`flex gap-2 group ${isUser ? 'flex-row-reverse' : ''}`}>
            {/* Avatar */}
            <div
                className={`w-9 h-9 md:w-10 md:h-10 rounded-xl flex-shrink-0 flex items-center justify-center border shadow-xl transition-all ${
                    isUser
                        ? 'bg-gradient-to-br from-purple-500 to-indigo-600 border-purple-300 text-white shadow-purple-200 scale-105'
                        : 'bg-gradient-to-br from-white to-purple-50 border-purple-200 text-purple-700 shadow-purple-100'
                }`}
            >
                {isUser ? <User size={18} /> : <Bot size={18} />}
            </div>

            <div
                className={`flex flex-col gap-1 max-w-[85%] ${
                    isUser ? 'items-end' : 'items-start'
                }`}
            >
                    {/* Message Bubble */}
                <div
                    className={`p-3 px-4 md:p-3.5 md:px-5 rounded-2xl text-sm leading-relaxed shadow-lg transition-all break-words overflow-hidden ${
                        isUser
                            ? 'bg-gradient-to-br from-purple-500 to-indigo-600 border border-purple-400 rounded-tr-none text-white shadow-purple-200/30'
                            : 'bg-gradient-to-br from-white to-purple-50/60 border border-purple-100 rounded-tl-none text-slate-700 shadow-purple-100/20'
                    }`}
                >
                    {/* Loading state for AI messages */}
                    {!isUser && !message.text ? (
                        <div className="flex items-center gap-3 py-1">
                            <div className="flex gap-1 items-center">
                                <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                <div className="w-1.5 h-1.5 bg-purple-300 rounded-full animate-bounce" />
                            </div>
                            <span className="text-xs text-slate-500 font-bold uppercase tracking-widest italic truncate">
                                Analyzing...
                            </span>
                        </div>
                    ) : (
                        <div className="relative z-10 overflow-hidden chat-message-content">
                            {isUser ? (
                                <p className="whitespace-pre-wrap text-sm break-words">{message.text}</p>
                            ) : (
                                <div className="space-y-0.5 break-words">
                                    {parseMarkdown(message.text)}
                                </div>
                            )}
                        </div>
                    )}

                        {/* Translation */}
                        {hasTranslation && (
                            <div className="mt-3 pt-3 border-t border-slate-200 relative z-10 animate-fade-in">
                                <div className="text-xs font-black uppercase tracking-[0.2em] text-purple-600 mb-1 opacity-80">
                                    Hindi
                                </div>
                                <p className="text-slate-600 font-medium leading-relaxed text-sm">
                                    {message.translation}
                                </p>
                            </div>
                        )}

                    {/* Sources Section - Only for AI messages */}
                    {hasSources && (
                        <div className="mt-3 pt-3 border-t border-purple-100 relative z-10">
                            <button
                                onClick={() =>
                                    setSourcesExpanded(!sourcesExpanded)
                                }
                                className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-purple-600 mb-2 hover:text-purple-700 transition-colors"
                            >
                                {sourcesExpanded ? (
                                    <ChevronDown size={14} />
                                ) : (
                                    <ChevronRight size={14} />
                                )}
                                Sources ({message.sources!.length})
                            </button>

                            {sourcesExpanded && (
                                <div className="space-y-2 animate-fade-in">
                                    {message.sources!.map(
                                        (source, index) => (
                                            <div
                                                key={index}
                                                className="bg-white/60 rounded-lg p-3 border border-purple-100 shadow-sm"
                                                style={{
                                                    boxShadow:
                                                        '0 1px 3px rgba(147, 51, 234, 0.1)',
                                                }}
                                            >
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <FileText
                                                            size={12}
                                                            className="text-purple-500"
                                                        />
                                                        <span className="text-xs font-medium text-purple-700 truncate">
                                                            {source.source}
                                                        </span>
                                                    </div>
                                                    <div className="text-xs font-bold text-purple-600">
                                                        {(
                                                            source.similarity_score *
                                                            100
                                                        ).toFixed(1)}
                                                        %
                                                    </div>
                                                </div>
                                                <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">
                                                    {source.content}
                                                </p>
                                            </div>
                                        ),
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* No Sources State - Show fetch button */}
                    {!isUser && !hasSources && (
                        <div className="mt-3 pt-3 border-t border-slate-200 relative z-10">
                            <button
                                onClick={() =>
                                    onFetchSources?.(
                                        message.id,
                                        message.text,
                                        collectionId || 0,
                                    )
                                }
                                className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-slate-500 hover:text-purple-600 transition-colors opacity-70 hover:opacity-100"
                                title="Fetch sources for this response"
                            >
                                <FileText size={12} />
                                Fetch Sources
                            </button>
                        </div>
                    )}

                    {/* Suggestions Section - Only for AI messages */}
                    {message.suggestions && message.suggestions.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-purple-100 relative z-10">
                            <div className="text-xs font-black uppercase tracking-[0.2em] text-purple-600 mb-2 opacity-80">
                                Suggested
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {message.suggestions.map((suggestion, index) => (
                                    <button
                                        key={index}
                                        onClick={() => {
                                            // Emit event or handle suggestion click
                                            window.dispatchEvent(new CustomEvent('suggestion-click', { detail: suggestion }))
                                        }}
                                        className="text-xs bg-purple-50 hover:bg-purple-100 text-purple-700 px-3 py-1.5 rounded-full border border-purple-200 hover:border-purple-300 transition-colors text-left"
                                    >
                                        {suggestion}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Time - below message */}
                <span className="text-xs text-slate-400 font-mono px-1">
                    {message.timestamp.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                    })}
                </span>

                {/* Utility Icons - Below message on hover */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity mt-1 px-1">
                    {/* User message utilities */}
                    {isUser && (
                        <>
                            <button
                                title="Edit"
                                className="p-1.5 hover:bg-purple-100 rounded-lg text-purple-600 hover:text-purple-700 transition-colors"
                                aria-label="Edit message"
                            >
                                <Edit2 size={14} />
                            </button>
                            <button
                                onClick={() => onCopy(message.text)}
                                title="Copy"
                                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-700 transition-colors"
                                aria-label="Copy message"
                            >
                                <Copy size={14} />
                            </button>
                        </>
                    )}

                    {/* AI message utilities */}
                    {!isUser && (
                        <>
                            <button
                                onClick={() => onCopy(message.text)}
                                title="Copy"
                                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-700 transition-colors"
                                aria-label="Copy message"
                            >
                                <Copy size={14} />
                            </button>
                            <button
                                onClick={() =>
                                    onSpeak(message.id, message.text)
                                }
                                title={
                                    isTTSActive
                                        ? 'Stop Reading'
                                        : isStreaming
                                            ? 'Audio unavailable during streaming'
                                            : 'Read Aloud'
                                }
                                disabled={isStreaming}
                                className="p-1.5 hover:bg-purple-100 rounded-lg text-purple-600 hover:text-purple-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                aria-label="Read aloud"
                            >
                                {isTTSActive ? (
                                    <Square
                                        size={14}
                                        className="fill-purple-500 text-purple-500"
                                    />
                                ) : isStreaming ? (
                                    <Loader2
                                        size={14}
                                        className="animate-pulse"
                                    />
                                ) : (
                                    <Volume2 size={14} />
                                )}
                            </button>
                            <button
                                onClick={() =>
                                    onTranslate(message.id, message.text)
                                }
                                title="Translate to Hindi"
                                disabled={
                                    isTranslating ||
                                    hasTranslation
                                }
                                className="p-1.5 hover:bg-purple-100 rounded-lg text-purple-600 hover:text-purple-700 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                                aria-label="Translate message"
                            >
                                {isTranslating ? (
                                    <Loader2
                                        size={14}
                                        className="animate-spin"
                                    />
                                ) : (
                                    <Languages size={14} />
                                )}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}

// Export memoized component to prevent unnecessary re-renders during streaming
const ChatMessageItem = React.memo(
    ChatMessageComponent,
    (prevProps, nextProps) => {
        return (
            prevProps.message.text === nextProps.message.text &&
            prevProps.message.id === nextProps.message.id &&
            prevProps.activeUtilityId === nextProps.activeUtilityId &&
            prevProps.message.translation === nextProps.message.translation &&
            prevProps.message.sources === nextProps.message.sources
        )
    },
)

export default ChatMessageItem
