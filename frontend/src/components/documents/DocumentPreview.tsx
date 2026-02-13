import React, { useState } from 'react'
import { FileText, Loader2, Eye, Sparkles } from 'lucide-react'
import { api } from '../../services/api'
import type { Document } from '../../types/api'

interface DocumentPreviewProps {
    document: Document
}

const DocumentPreview: React.FC<DocumentPreviewProps> = ({ document }) => {
    const [loading, setLoading] = useState(false)
    const [previewError, setPreviewError] = useState(false)
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)

    const contentType = document.content_type || ''
    const filename = document.filename || ''
    const extension = filename.split('.').pop()?.toUpperCase() || 'FILE'

    const getFileTypeStyles = (type: string) => {
        if (type === 'pdf') return {
            bg: 'from-red-50 via-red-50 to-rose-100',
            bgHover: 'group-hover:from-red-100 group-hover:via-red-50 to-rose-100',
            icon: 'text-red-600',
            iconBg: 'bg-gradient-to-br from-red-500 to-rose-600',
            badge: 'text-red-700 bg-red-100/80 border border-red-200',
            accent: 'bg-red-500',
            shadow: 'shadow-red-500/20',
            glow: 'group-hover:shadow-red-500/30'
        }
        if (type === 'txt') return {
            bg: 'from-blue-50 via-blue-50 to-cyan-100',
            bgHover: 'group-hover:from-blue-100 group-hover:via-blue-50 to-cyan-100',
            icon: 'text-blue-600',
            iconBg: 'bg-gradient-to-br from-blue-500 to-cyan-600',
            badge: 'text-blue-700 bg-blue-100/80 border border-blue-200',
            accent: 'bg-blue-500',
            shadow: 'shadow-blue-500/20',
            glow: 'group-hover:shadow-blue-500/30'
        }
        if (['doc', 'docx'].includes(type)) return {
            bg: 'from-indigo-50 via-indigo-50 to-violet-100',
            bgHover: 'group-hover:from-indigo-100 group-hover:via-indigo-50 to-violet-100',
            icon: 'text-indigo-600',
            iconBg: 'bg-gradient-to-br from-indigo-500 to-violet-600',
            badge: 'text-indigo-700 bg-indigo-100/80 border border-indigo-200',
            accent: 'bg-indigo-500',
            shadow: 'shadow-indigo-500/20',
            glow: 'group-hover:shadow-indigo-500/30'
        }
        if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(type)) return {
            bg: 'from-green-50 via-green-50 to-emerald-100',
            bgHover: 'group-hover:from-green-100 group-hover:via-green-50 to-emerald-100',
            icon: 'text-green-600',
            iconBg: 'bg-gradient-to-br from-green-500 to-emerald-600',
            badge: 'text-green-700 bg-green-100/80 border border-green-200',
            accent: 'bg-green-500',
            shadow: 'shadow-green-500/20',
            glow: 'group-hover:shadow-green-500/30'
        }
        return {
            bg: 'from-slate-50 via-slate-50 to-slate-100',
            bgHover: 'group-hover:from-slate-100 group-hover:via-slate-50 to-slate-200',
            icon: 'text-slate-600',
            iconBg: 'bg-gradient-to-br from-slate-500 to-slate-600',
            badge: 'text-slate-700 bg-slate-100/80 border border-slate-200',
            accent: 'bg-slate-500',
            shadow: 'shadow-slate-500/20',
            glow: 'group-hover:shadow-slate-500/30'
        }
    }

    const styles = getFileTypeStyles(contentType)

    React.useEffect(() => {
        if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(contentType) && !previewUrl && !previewError) {
            const loadImagePreview = async () => {
                try {
                    setLoading(true)
                    const token = localStorage.getItem('token')
                    if (!token) return

                    const response = await fetch(
                        `${api.getBaseUrl()}/documents/${document.id}/content`,
                        {
                            headers: {
                                Authorization: `Bearer ${token}`,
                                Accept: 'application/octet-stream',
                            },
                        }
                    )

                    if (response.ok) {
                        const blob = await response.blob()
                        const url = URL.createObjectURL(blob)
                        setPreviewUrl(url)
                    }
                } catch {
                    setPreviewError(true)
                } finally {
                    setLoading(false)
                }
            }

            loadImagePreview()
        }
    }, [document.id, contentType, previewUrl, previewError])

    if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(contentType) && previewUrl && !previewError) {
        return (
            <div className={`group w-full h-full bg-gradient-to-br ${styles.bg} flex items-center justify-center overflow-hidden transition-all duration-500 ${styles.bgHover}`}>
                {loading ? (
                    <div className="flex flex-col items-center gap-2">
                        <Loader2 className={`animate-spin ${styles.icon}`} size={28} />
                        <span className={`text-xs font-medium ${styles.icon}`}>Loading...</span>
                    </div>
                ) : (
                    <img
                        src={previewUrl}
                        alt={filename}
                        className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105"
                        onError={() => setPreviewError(true)}
                    />
                )}
            </div>
        )
    }

    return (
        <div className={`group w-full h-full bg-gradient-to-br ${styles.bg} ${styles.bgHover} flex flex-col items-center justify-center p-4 relative overflow-hidden transition-all duration-500`}>
            {/* Animated gradient overlay */}
            <div className={`absolute inset-0 bg-gradient-to-tr from-white/40 via-transparent to-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
            
            {/* Decorative floating circles with animation */}
            <div className={`absolute top-[-40px] right-[-40px] w-32 h-32 ${styles.iconBg} opacity-5 rounded-full blur-xl group-hover:scale-125 transition-transform duration-700`} />
            <div className={`absolute top-[-20px] right-[-20px] w-20 h-20 ${styles.iconBg} opacity-10 rounded-full group-hover:rotate-12 transition-transform duration-500`} />
            <div className={`absolute bottom-[-30px] left-[-30px] w-24 h-24 ${styles.iconBg} opacity-5 rounded-full blur-xl group-hover:scale-125 transition-transform duration-700`} />
            <div className={`absolute bottom-[-15px] left-[-15px] w-16 h-16 ${styles.iconBg} opacity-10 rounded-full group-hover:-rotate-12 transition-transform duration-500`} />
            
            {/* Corner accent lines */}
            <div className={`absolute top-2 left-2 w-8 h-px ${styles.accent} opacity-20 group-hover:w-12 transition-all duration-300`} />
            <div className={`absolute top-2 left-2 w-px h-8 ${styles.accent} opacity-20 group-hover:h-12 transition-all duration-300`} />
            <div className={`absolute bottom-2 right-2 w-8 h-px ${styles.accent} opacity-20 group-hover:w-12 transition-all duration-300`} />
            <div className={`absolute bottom-2 right-2 w-px h-8 ${styles.accent} opacity-20 group-hover:h-12 transition-all duration-300`} />
            
            {/* Main icon with enhanced styling */}
            <div className={`relative w-20 h-20 ${styles.iconBg} rounded-2xl flex items-center justify-center mb-4 shadow-lg ${styles.shadow} group-hover:shadow-xl ${styles.glow} transition-all duration-300 group-hover:scale-110`}>
                <FileText size={36} className="text-white drop-shadow-md" />
                
                {/* Subtle shine effect */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </div>
            
            {/* File extension badge with enhanced styling */}
            <span className={`px-3 py-1.5 ${styles.badge} rounded-full text-xs font-bold uppercase tracking-wider mb-3 shadow-sm backdrop-blur-sm group-hover:scale-105 transition-transform duration-300`}>
                {extension}
            </span>
            
            {/* File type label with animation */}
            <span className={`text-sm font-semibold ${styles.icon} opacity-80 group-hover:opacity-100 transition-all duration-300 group-hover:tracking-wider`}>
                {(contentType || 'FILE').toUpperCase()}
            </span>
            
            {/* View indicator on hover */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none">
                <div className={`w-12 h-12 ${styles.iconBg} rounded-full flex items-center justify-center shadow-lg scale-50 group-hover:scale-100 transition-transform duration-300`}>
                    <Eye size={20} className="text-white" />
                </div>
            </div>
            
            {/* Status indicator with enhanced styling */}
            <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2">
                <div className="flex items-center gap-2 px-2 py-1 bg-white/60 backdrop-blur-sm rounded-full shadow-sm">
                    <div className={`w-2 h-2 rounded-full ${styles.accent} ${!document.processed ? 'animate-pulse' : ''}`} />
                    <span className="text-[10px] text-slate-600 font-semibold">
                        {document.processed ? (
                            <span className="flex items-center gap-1">
                                Indexed
                            </span>
                        ) : (
                            'Processing'
                        )}
                    </span>
                </div>
            </div>
        </div>
    )
}

export default DocumentPreview
