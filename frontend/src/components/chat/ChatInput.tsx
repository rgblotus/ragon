import React, { useRef, useEffect } from 'react'
import { Send, Square, RotateCcw } from 'lucide-react'

interface ChatInputProps {
    inputValue?: string
    setInputValue?: (value: string) => void
    isLoading?: boolean
    onSend?: () => void
    onStop?: () => void
    onRestart?: () => void
    hasPartialResponse?: boolean
}

export const ChatInput: React.FC<ChatInputProps> = ({
    inputValue = '',
    setInputValue = () => {},
    isLoading = false,
    onSend = () => {},
    onStop = () => {},
    onRestart = () => {},
    hasPartialResponse = false,
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
        <div className="bg-white border border-slate-200 rounded-xl p-2 shadow-sm">
            <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                    <textarea
                        ref={textareaRef}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Type your message..."
                        className="w-full min-h-[44px] max-h-[200px] resize-none border border-slate-200 rounded-lg px-4 py-3 pr-16 focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-slate-700 placeholder-slate-400 bg-slate-50 transition-all"
                        rows={1}
                        disabled={isLoading}
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-medium text-slate-400 pointer-events-none">
                        {inputValue.length}/1000
                    </div>
                </div>

                <div className="flex gap-2 flex-shrink-0 items-center">
                    {hasPartialResponse && !isLoading && (
                        <button
                            onClick={onRestart}
                            className="flex items-center justify-center w-11 h-[44px] rounded-lg transition-all duration-200 bg-amber-500 text-white shadow-md hover:bg-amber-600"
                            title="Regenerate response"
                        >
                            <RotateCcw size={18} />
                        </button>
                    )}

                    <button
                        onClick={isLoading ? onStop : onSend}
                        className={`flex items-center justify-center w-11 h-[44px] rounded-lg transition-all duration-200 ${
                            (inputValue.trim() && !isLoading)
                                ? 'bg-purple-600 text-white shadow-md hover:bg-purple-700'
                                : isLoading
                                ? 'bg-red-500 text-white shadow-md hover:bg-red-600'
                                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        }`}
                        title={isLoading ? "Stop generating" : "Send message"}
                        disabled={!inputValue.trim() && !isLoading}
                    >
                        {isLoading ? (
                            <Square size={18} className="fill-current" />
                        ) : (
                            <Send size={20} />
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default ChatInput
