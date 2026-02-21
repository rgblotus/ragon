import React, { useState, useRef, useEffect } from 'react'
import { MessageCircle, X, Send, Loader2 } from 'lucide-react'
import type { ChatMessage } from '../../types/api'

interface ChatBubbleProps {
    apiUrl?: string
    apiKey?: string
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({
    apiUrl = 'http://localhost:3000',
    apiKey = '',
}) => {
    const [isOpen, setIsOpen] = useState(false)
    const [input, setInput] = useState('')
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [loading, setLoading] = useState(false)
    const [streamingText, setStreamingText] = useState('')
    const messagesEndRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages, streamingText])

    const handleSend = async () => {
        if (!input.trim() || loading) return

        const userMessage: ChatMessage = {
            id: Date.now().toString(),
            text: input.trim(),
            sender: 'user',
            timestamp: new Date(),
        }

        setMessages((prev) => [...prev, userMessage])
        setInput('')
        setLoading(true)
        setStreamingText('')

        const aiMessageId = (Date.now() + 1).toString()

        try {
            // Call OpenWebUI API through proxy
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                'Accept': 'text/event-stream',
            }
            
            // Add API key if provided
            if (apiKey) {
                headers['Authorization'] = `Bearer ${apiKey}`
            }
            
            const response = await fetch(`/openwebui/api/chat/completions`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    model: 'phi3.5:latest', // Your OpenWebUI model
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a helpful AI assistant. Provide clear and concise answers.'
                        },
                        ...messages.map(m => ({
                            role: m.sender === 'user' ? 'user' : 'assistant',
                            content: m.text
                        })),
                        {
                            role: 'user',
                            content: userMessage.text
                        }
                    ],
                    stream: true,
                    temperature: 0.7,
                }),
            })

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
            }

            const reader = response.body?.getReader()
            const decoder = new TextDecoder()
            let accumulatedText = ''

            if (reader) {
                while (true) {
                    const { done, value } = await reader.read()
                    if (done) break

                    const chunk = decoder.decode(value)
                    const lines = chunk.split('\n')

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const data = line.slice(6)
                            if (data === '[DONE]') continue

                            try {
                                const parsed = JSON.parse(data)
                                const content = parsed.choices?.[0]?.delta?.content || parsed.choices?.[0]?.message?.content || ''
                                if (content) {
                                    accumulatedText += content
                                    setStreamingText(accumulatedText)
                                }
                            } catch {
                                // Ignore parse errors for non-JSON lines
                            }
                        }
                    }
                }
            }

            const aiMessage: ChatMessage = {
                id: aiMessageId,
                text: accumulatedText || 'Sorry, I could not generate a response.',
                sender: 'ai',
                timestamp: new Date(),
            }

            setMessages((prev) => [...prev, aiMessage])
        } catch (error) {
            console.error('Chat error:', error)
            
            // Show error message in chat
            const errorMessage: ChatMessage = {
                id: aiMessageId,
                text: apiKey 
                    ? `Sorry, I couldn't connect to the AI service. Please make sure OpenWebUI is running on localhost:3000. Error: ${error instanceof Error ? error.message : 'Unknown error'}`
                    : `Sorry, I couldn't connect to the AI service. OpenWebUI requires authentication. Please add your API key to the ChatBubble component. Get your API key from OpenWebUI Settings → Account → API Keys.`,
                sender: 'ai',
                timestamp: new Date(),
            }
            setMessages((prev) => [...prev, errorMessage])
        } finally {
            setLoading(false)
            setStreamingText('')
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    return (
        <>
            {/* Floating Chat Bubble */}
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-r from-purple-600 to-pink-500 text-white shadow-lg hover:shadow-xl hover:scale-110 transition-all duration-200 flex items-center justify-center"
                title="Open Chat"
            >
                <MessageCircle size={28} />
            </button>

            {/* Chat Modal */}
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-end sm:justify-center p-4 sm:p-6">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Chat Modal Container */}
                    <div className="relative w-full max-w-md h-[500px] sm:h-[600px] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-500 text-white">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                                    <MessageCircle size={18} />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-sm">AI Assistant</h3>
                                    <p className="text-xs text-white/70">Powered by OpenWebUI</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
                            {messages.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-center">
                                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center mb-4">
                                        <MessageCircle size={32} className="text-purple-500" />
                                    </div>
                                    <h4 className="font-semibold text-slate-700 mb-1">
                                        Start a conversation
                                    </h4>
                                    <p className="text-xs text-slate-500 max-w-xs">
                                        Ask me anything! I'm connected to OpenWebUI at localhost:3000 via proxy.
                                    </p>
                                </div>
                            ) : (
                                <>
                                    {messages.map((message) => (
                                        <div
                                            key={message.id}
                                            className={`flex gap-2 ${
                                                message.sender === 'user' ? 'flex-row-reverse' : ''
                                            }`}
                                        >
                                            <div
                                                className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold ${
                                                    message.sender === 'user'
                                                        ? 'bg-gradient-to-br from-purple-500 to-purple-600 text-white'
                                                        : 'bg-gradient-to-br from-pink-400 to-purple-500 text-white'
                                                }`}
                                            >
                                                {message.sender === 'user' ? 'U' : 'AI'}
                                            </div>
                                            <div
                                                className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                                                    message.sender === 'user'
                                                        ? 'bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-tr-none'
                                                        : 'bg-white border border-slate-200 text-slate-700 rounded-tl-none shadow-sm'
                                                }`}
                                            >
                                                <p className="whitespace-pre-wrap">{message.text}</p>
                                            </div>
                                        </div>
                                    ))}
                                    {streamingText && (
                                        <div className="flex gap-2">
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex-shrink-0 flex items-center justify-center text-xs font-bold text-white">
                                                AI
                                            </div>
                                            <div className="max-w-[80%] p-3 rounded-2xl text-sm bg-white border border-slate-200 text-slate-700 rounded-tl-none shadow-sm">
                                                <p className="whitespace-pre-wrap">{streamingText}</p>
                                            </div>
                                        </div>
                                    )}
                                    <div ref={messagesEndRef} />
                                </>
                            )}
                        </div>

                        {/* Input Area */}
                        <div className="p-3 bg-white border-t border-slate-100">
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Type your message..."
                                    className="flex-1 px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
                                    disabled={loading}
                                />
                                <button
                                    onClick={handleSend}
                                    disabled={!input.trim() || loading}
                                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 ${
                                        input.trim() && !loading
                                            ? 'bg-gradient-to-r from-purple-600 to-pink-500 text-white shadow-md hover:shadow-lg hover:scale-105'
                                            : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                    }`}
                                >
                                    {loading ? (
                                        <Loader2 size={18} className="animate-spin" />
                                    ) : (
                                        <Send size={18} />
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}

export default ChatBubble
