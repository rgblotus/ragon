import React, { useState, useEffect, useRef } from 'react'
import {
    Settings,
    RotateCcw,
    Sparkles,
    Search,
    Volume2,
    Database,
    ChevronDown,
    Save,
    Check,
    Loader2,
} from 'lucide-react'
import Button from '../ui/Button'
import type { Collection } from '../../types/api'

interface AISettingsPanelProps {
    temperature: number
    topK: number
    vocalVoice: 'en_female' | 'hi_female'
    customRAGPrompt: string
    collections: Collection[]
    selectedCollectionId: string | null
    hasActiveThread: boolean
    onUpdateSettings: (settings: { temperature: number; topK: number }) => void
    onCollectionChange: (collectionId: string | null) => void
    onVocalVoiceChange: (
        vocalVoice: 'en_female' | 'hi_female',
    ) => void
    onCustomRAGPromptChange: (prompt: string) => void
    onResetToDefaults: () => void
    onSaveSettings?: () => Promise<void>
    className?: string
}

const AISettingsPanel: React.FC<AISettingsPanelProps> = ({
    temperature,
    topK,
    vocalVoice,
    customRAGPrompt,
    collections,
    selectedCollectionId,
    hasActiveThread,
    onUpdateSettings,
    onCollectionChange,
    onVocalVoiceChange,
    onCustomRAGPromptChange,
    onResetToDefaults,
    onSaveSettings,
    className = '',
}) => {
    const [localTemperature, setLocalTemperature] = useState(temperature)
    const [localTopK, setLocalTopK] = useState(topK)
    const [isSaving, setIsSaving] = useState(false)
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>(
        'idle',
    )
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    // Auto-resize textarea based on content
    const adjustTextareaHeight = () => {
        const textarea = textareaRef.current
        if (textarea) {
            textarea.style.height = 'auto'
            textarea.style.height = Math.max(60, textarea.scrollHeight) + 'px'
        }
    }

    // Update local state when props change
    useEffect(() => {
        setLocalTemperature(temperature)
        setLocalTopK(topK)
    }, [temperature, topK])

    // Auto-resize textarea when content changes
    useEffect(() => {
        adjustTextareaHeight()
    }, [customRAGPrompt])

    const handleTemperatureChange = (value: number) => {
        setLocalTemperature(value)
        onUpdateSettings({ temperature: value, topK: localTopK })
    }

    const handleTopKChange = (value: number) => {
        setLocalTopK(value)
        onUpdateSettings({ temperature: localTemperature, topK: value })
    }

    const handleReset = () => {
        const defaultTemp = 0.7
        const defaultTopK = 20
        setLocalTemperature(defaultTemp)
        setLocalTopK(defaultTopK)
        onUpdateSettings({ temperature: defaultTemp, topK: defaultTopK })
        onResetToDefaults()
    }

    const handleSave = async () => {
        if (!onSaveSettings) return

        setIsSaving(true)
        setSaveStatus('idle')

        try {
            await onSaveSettings()
            setSaveStatus('saved')
            // Clear saved status after 2 seconds
            setTimeout(() => setSaveStatus('idle'), 2000)
        } catch (error) {
            console.error('Failed to save settings:', error)
            setSaveStatus('error')
            // Clear error status after 3 seconds
            setTimeout(() => setSaveStatus('idle'), 3000)
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <div
            className={`h-full flex flex-col bg-gradient-to-br from-white via-indigo-50/30 to-purple-50/40 backdrop-blur-sm border-r border-purple-200/50 ${className}`}
        >
            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Header */}
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg">
                        <Settings size={16} className="text-white" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-sm font-semibold text-purple-800">
                            AI Settings
                        </h3>
                        <p className="text-xs text-purple-600">
                            Customize your AI assistant
                        </p>
                    </div>
                    {/* Save Button */}
                    {onSaveSettings && (
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="flex items-center gap-1 px-3 py-2 text-xs bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 border-0 rounded-lg text-white hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
                            title="Save settings to backend"
                        >
                            {isSaving ? (
                                <Loader2 size={14} className="animate-spin" />
                            ) : saveStatus === 'saved' ? (
                                <Check size={14} className="text-green-200" />
                            ) : (
                                <Save size={14} />
                            )}
                            {isSaving
                                ? 'Saving...'
                                : saveStatus === 'saved'
                                  ? 'Saved!'
                                  : 'Save'}
                        </button>
                    )}
                </div>

                {/* Collection Selector */}
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <Database size={14} className="text-green-500" />
                        <label className="text-xs font-medium text-slate-700">
                            Knowledge Base
                        </label>
                        {hasActiveThread && (
                            <span className="text-xs text-amber-600 font-medium ml-auto">
                                Locked
                            </span>
                        )}
                    </div>
                    <div className="relative">
                        <select
                            value={selectedCollectionId?.toString() || ''}
                            onChange={(e) =>
                                onCollectionChange(e.target.value || null)
                            }
                            disabled={hasActiveThread}
                            className={`w-full px-3 py-2 bg-white border border-slate-200 rounded-md text-slate-700 text-sm focus:outline-none appearance-none hover:border-slate-300 ${
                                hasActiveThread
                                    ? 'cursor-not-allowed bg-slate-50 text-slate-400'
                                    : 'focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 cursor-pointer'
                            }`}
                        >
                            <option
                                value=""
                                className="bg-white text-slate-700"
                            >
                                No collection selected
                            </option>
                            {collections.map((collection) => (
                                <option
                                    key={collection.id}
                                    value={collection.id}
                                    className="bg-white text-slate-700"
                                >
                                    {collection.name} (
                                    {collection.document_count} docs)
                                </option>
                            ))}
                        </select>
                        <ChevronDown
                            size={14}
                            className={`absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none ${
                                hasActiveThread
                                    ? 'text-slate-300'
                                    : 'text-slate-400'
                            }`}
                        />
                        {hasActiveThread && (
                            <div className="absolute inset-0 bg-slate-50/50 rounded-md pointer-events-none" />
                        )}
                    </div>
                    {hasActiveThread && (
                        <p className="text-xs text-slate-500">
                            Collection cannot be changed once conversation has
                            started. Create a new chat session for different
                            collection.
                        </p>
                    )}
                </div>

                {/* Voice Model Selector */}
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <Volume2 size={14} className="text-cyan-500" />
                        <label className="text-xs font-medium text-slate-700">
                            Voice Model
                        </label>
                    </div>
                    <div className="relative">
                        <select
                            value={vocalVoice}
                            onChange={(e) =>
                                onVocalVoiceChange(
                                    e.target.value as 'en_female' | 'hi_female',
                                )
                            }
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 appearance-none cursor-pointer hover:border-slate-300"
                        >
                            <option
                                value="en_female"
                                className="bg-white text-slate-700"
                            >
                                English - Female
                            </option>
                            <option
                                value="hi_female"
                                className="bg-white text-slate-700"
                            >
                                Hindi - Female
                            </option>
                        </select>
                        <ChevronDown
                            size={14}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                        />
                    </div>
                </div>

                {/* Temperature Control */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <Sparkles size={14} className="text-purple-500" />
                        <label className="text-xs font-medium text-slate-700">
                            Creativity
                        </label>
                        <span className="text-xs text-slate-500 ml-auto">
                            {localTemperature.toFixed(1)}
                        </span>
                    </div>

                    <div className="space-y-1">
                        <input
                            type="range"
                            min="0"
                            max="2"
                            step="0.1"
                            value={localTemperature}
                            onChange={(e) =>
                                handleTemperatureChange(
                                    parseFloat(e.target.value),
                                )
                            }
                            className="w-full h-2 bg-gradient-to-r from-purple-200 to-indigo-200 rounded-full appearance-none cursor-pointer slider"
                            style={{
                                background:
                                    'linear-gradient(to right, #c7d2fe, #a5b4fc, #818cf8)',
                                boxShadow: '0 1px 3px rgba(147, 51, 234, 0.2)',
                            }}
                        />
                        <div className="flex justify-between text-xs text-purple-600 font-medium">
                            <span>Precise</span>
                            <span>Balanced</span>
                            <span>Creative</span>
                        </div>
                    </div>
                </div>

                {/* Top K Control */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <Search size={14} className="text-blue-500" />
                        <label className="text-xs font-medium text-slate-700">
                            Sources
                        </label>
                        <span className="text-xs text-slate-500 ml-auto">
                            {localTopK} docs
                        </span>
                    </div>

                    <div className="space-y-1">
                        <input
                            type="range"
                            min="20"
                            max="50"
                            step="1"
                            value={localTopK}
                            onChange={(e) =>
                                handleTopKChange(parseInt(e.target.value))
                            }
                            className="w-full h-2 bg-gradient-to-r from-blue-200 to-cyan-200 rounded-full appearance-none cursor-pointer slider"
                            style={{
                                background:
                                    'linear-gradient(to right, #bfdbfe, #7dd3fc, #06b6d4)',
                                boxShadow: '0 1px 3px rgba(56, 189, 248, 0.2)',
                            }}
                        />
                        <div className="flex justify-between text-xs text-blue-600 font-medium">
                            <span>20</span>
                            <span>35</span>
                            <span>50</span>
                        </div>
                    </div>
                </div>

                {/* Custom RAG Prompt */}
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <Sparkles size={14} className="text-orange-500" />
                        <label className="text-xs font-medium text-slate-700">
                            Custom Prompt
                        </label>
                    </div>
                    <textarea
                        ref={textareaRef}
                        value={customRAGPrompt}
                        onChange={(e) => {
                            onCustomRAGPromptChange(e.target.value)
                            adjustTextareaHeight()
                        }}
                        placeholder="Enter custom RAG instruction..."
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md text-slate-700 text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 resize-none overflow-hidden hover:border-slate-300"
                        rows={1}
                        style={{ minHeight: '60px' }}
                    />
                </div>

                {/* Preset Buttons */}
                <div className="space-y-2">
                    <label className="text-xs font-medium text-purple-700">
                        Quick Presets
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={() => handleTemperatureChange(0.1)}
                            className="px-3 py-2 text-xs bg-white/60 hover:bg-white border border-purple-200 rounded-lg text-purple-700 hover:text-purple-800 transition-all shadow-sm hover:shadow-md"
                            style={{
                                boxShadow: '0 1px 3px rgba(147, 51, 234, 0.1)',
                            }}
                        >
                            Research
                        </button>
                        <button
                            onClick={() => handleTemperatureChange(0.8)}
                            className="px-3 py-2 text-xs bg-white/60 hover:bg-white border border-purple-200 rounded-lg text-purple-700 hover:text-purple-800 transition-all shadow-sm hover:shadow-md"
                            style={{
                                boxShadow: '0 1px 3px rgba(147, 51, 234, 0.1)',
                            }}
                        >
                            Creative
                        </button>
                    </div>
                </div>

                {/* Reset Button */}
                <div className="pt-3 border-t border-purple-200/50">
                    <Button
                        variant="secondary"
                        onClick={handleReset}
                        className="w-full flex items-center gap-2 justify-center text-sm py-3 bg-gradient-to-r from-purple-100 to-indigo-100 hover:from-purple-200 hover:to-indigo-200 border border-purple-200 text-purple-700 hover:text-purple-800 shadow-md hover:shadow-lg transition-all"
                    >
                        <RotateCcw size={16} />
                        Reset to Defaults
                    </Button>
                </div>
            </div>

            {/* Sticky Info Section */}
            <div className="p-4 pt-3 bg-gradient-to-r from-blue-50 to-cyan-50 border-t border-blue-200/50">
                <div className="flex items-start gap-2">
                    <Volume2
                        size={14}
                        className="text-blue-600 mt-0.5 flex-shrink-0"
                    />
                    <div>
                        <p className="text-xs font-medium text-blue-700 mb-1">
                            Usage Info
                        </p>
                        <p className="text-xs text-blue-600 leading-relaxed">
                            Select a knowledge base to start chatting. Once
                            conversation begins, the collection cannot be
                            changed. Create a new session for different
                            collections.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default React.memo(AISettingsPanel)
