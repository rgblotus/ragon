import React, { useState, useRef, useEffect } from 'react'
import { Send, Loader2 } from 'lucide-react'

interface ChatInputProps {
    inputValue?: string
    setInputValue?: (value: string) => void
    isLoading?: boolean
    onSend?: () => void
}

export const ChatInput: React.FC<ChatInputProps> = ({
    inputValue = '',
    setInputValue = () => {},
    isLoading = false,
    onSend = () => {},
}) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto'
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
        }
    }, [inputValue])

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            if (inputValue.trim() && !isLoading) {
                onSend()
            }
        }
    }

    return (
        <div className="bg-white border border-slate-200 rounded-xl p-2 shadow-sm relative">
            <div className="flex items-end gap-2">
                {/* Textarea */}
                <textarea
                    ref={textareaRef}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type your message..."
                    className="flex-1 min-h-[44px] max-h-[200px] w-full resize-none border border-slate-200 rounded-lg px-4 py-3 pr-24 focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-slate-700 placeholder-slate-400 bg-slate-50 transition-all"
                    rows={1}
                    disabled={isLoading}
                />

                {/* Character counter */}
                <div className="absolute bottom-4 right-20 text-[10px] font-medium text-slate-400 bg-white px-2 py-0.5 rounded-full border border-slate-100">
                    {inputValue.length}/1000
                </div>

                {/* Send button */}
                <button
                    onClick={onSend}
                    className={`flex items-center justify-center w-11 h-[44px] rounded-lg transition-all duration-200 flex-shrink-0 ${
                        inputValue.trim() && !isLoading
                            ? 'bg-purple-600 text-white shadow-md hover:bg-purple-700'
                            : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    }`}
                    title="Send message"
                    disabled={!inputValue.trim() || isLoading}
                >
                    {isLoading ? (
                        <Loader2 size={20} className="animate-spin text-white" />
                    ) : (
                        <Send size={20} />
                    )}
                </button>
            </div>
        </div>
    )
}

export default ChatInput
