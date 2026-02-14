import React, { useRef } from 'react'
import { ChatMessage } from '../../types/api'
import ChatMessageItem from './ChatMessage'

interface ChatMessagesProps {
    messages: ChatMessage[]
    isLoading: boolean
    error: string | null
    currentPage: number
    itemsPerPage: number
    onRetry: () => void
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

export const ChatMessages: React.FC<ChatMessagesProps> = ({
    messages,
    isLoading,
    error,
    currentPage,
    itemsPerPage,
    onRetry,
    activeUtilityId,
    onCopy,
    onSpeak,
    onTranslate,
    onFetchSources,
    collectionId,
    isStreaming = false,
}) => {
    const messagesEndRef = useRef<HTMLDivElement>(null)

    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    const paginatedMessages = messages.slice(startIndex, endIndex)

    React.useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages, isStreaming])

    if (isLoading && messages.length === 0) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        )
    }

    if (error) {
        return (
            <div
                className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative"
                role="alert"
            >
                <strong className="font-bold">Error:</strong>
                <span className="block sm:inline"> {error}</span>
                <button
                    onClick={onRetry}
                    className="mt-2 bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                >
                    Retry
                </button>
            </div>
        )
    }

    if (messages.length === 0) {
        return (
            <div className="text-center py-8 text-gray-500">
                No messages yet. Start a conversation!
            </div>
        )
    }

    return (
        <div className="flex-1 overflow-y-auto px-2 space-y-1">
            {paginatedMessages.map((message) => (
                <ChatMessageItem
                    key={message.id}
                    message={message}
                    activeUtilityId={activeUtilityId}
                    onCopy={onCopy}
                    onSpeak={onSpeak}
                    onTranslate={onTranslate}
                    onFetchSources={onFetchSources}
                    collectionId={collectionId}
                    isStreaming={isStreaming}
                />
            ))}
            <div ref={messagesEndRef} />
        </div>
    )
}

export default ChatMessages
