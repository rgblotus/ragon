import React, { useState, useEffect, useRef } from 'react'
import {
    X,
    ZoomIn,
    ZoomOut,
    FileText,
    Loader2,
    Copy,
    Maximize2,
} from 'lucide-react'
import { Document, Page, pdfjs } from 'react-pdf'
import Card from '../ui/Card'
import Button from '../ui/Button'
import { api } from '../../services/api'
import type { Document as DocumentType } from '../../types/api'

if (typeof window !== 'undefined') {
    pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'
}

interface DocumentContentModalProps {
    document: DocumentType
    onClose: () => void
    formatFileSize: (bytes: number) => string
}

const DocumentContentModal: React.FC<DocumentContentModalProps> = ({
    document: doc,
    onClose,
    formatFileSize,
}) => {
    const [numPages, setNumPages] = useState<number>(0)
    const [pageNumber, setPageNumber] = useState<number>(1)
    const [scale, setScale] = useState<number>(1.0)
    const [loading, setLoading] = useState<boolean>(true)
    const [error, setError] = useState<string | null>(null)
    const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null)
    const contentRef = useRef<HTMLDivElement>(null)
    const pageInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        const fetchDocument = async () => {
            try {
                setLoading(true)
                const token = localStorage.getItem('token')
                if (!token) {
                    throw new Error('No authentication token found')
                }

                const response = await fetch(
                    `${api.getBaseUrl()}/documents/${doc.id}/content`,
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                            Accept: 'application/pdf',
                        },
                    }
                )

                if (!response.ok) {
                    throw new Error(
                        `Failed to fetch document: ${response.status} ${response.statusText}`
                    )
                }

                const blob = await response.blob()
                const url = URL.createObjectURL(blob)
                setPdfBlobUrl(url)
                setLoading(false)
                setError(null)
            } catch (error) {
                setError(
                    `Failed to load document: ${
                        error instanceof Error ? error.message : 'Unknown error'
                    }`
                )
                setLoading(false)
            }
        }

        fetchDocument()

        return () => {
            if (pdfBlobUrl) {
                URL.revokeObjectURL(pdfBlobUrl)
            }
        }
    }, [doc.id])

    useEffect(() => {
        return () => {
            if (pdfBlobUrl) {
                URL.revokeObjectURL(pdfBlobUrl)
            }
        }
    }, [pdfBlobUrl])

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (
                event.target instanceof HTMLInputElement ||
                event.target instanceof HTMLTextAreaElement
            ) {
                return
            }

            switch (event.key) {
                case 'ArrowLeft':
                case 'ArrowUp':
                    if (pageNumber > 1) {
                        setPageNumber((prev) => prev - 1)
                        event.preventDefault()
                    }
                    break
                case 'ArrowRight':
                case 'ArrowDown':
                    if (pageNumber < numPages) {
                        setPageNumber((prev) => prev + 1)
                        event.preventDefault()
                    }
                    break
                case 'PageUp':
                    if (pageNumber > 1) {
                        setPageNumber((prev) => Math.max(prev - 5, 1))
                        event.preventDefault()
                    }
                    break
                case 'PageDown':
                    if (pageNumber < numPages) {
                        setPageNumber((prev) => Math.min(prev + 5, numPages))
                        event.preventDefault()
                    }
                    break
                case '+':
                case '=':
                    if (scale < 3.0) {
                        handleZoom(0.2)
                        event.preventDefault()
                    }
                    break
                case '-':
                    if (scale > 0.5) {
                        handleZoom(-0.2)
                        event.preventDefault()
                    }
                    break
                case 'Escape':
                    onClose()
                    event.preventDefault()
                    break
                case 'Home':
                    setPageNumber(1)
                    event.preventDefault()
                    break
                case 'End':
                    if (numPages > 0) {
                        setPageNumber(numPages)
                        event.preventDefault()
                    }
                    break
            }
        }

        const handleWheel = (event: WheelEvent) => {
            // Only handle wheel events when not in fullscreen
            if (document.fullscreenElement) return
            
            // Check if the modal content area is the target or contains it
            const target = event.target as HTMLElement
            if (contentRef.current && (contentRef.current === target || contentRef.current.contains(target))) {
                event.preventDefault()
                
                if (event.deltaY > 0 && pageNumber < numPages) {
                    setPageNumber((prev) => prev + 1)
                } else if (event.deltaY < 0 && pageNumber > 1) {
                    setPageNumber((prev) => prev - 1)
                }
            }
        }

        window.document.addEventListener('keydown', handleKeyDown)
        window.document.addEventListener('wheel', handleWheel, { passive: false })

        return () => {
            window.document.removeEventListener('keydown', handleKeyDown)
            window.document.removeEventListener('wheel', handleWheel)
        }
    }, [pageNumber, numPages, scale, onClose])

    const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
        setNumPages(numPages)
        setLoading(false)
    }

    // Scroll to top of content when page changes
    useEffect(() => {
        if (contentRef.current) {
            contentRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
    }, [pageNumber])

    const onDocumentLoadError = () => {
        setError('Failed to load PDF document')
        setLoading(false)
    }

    const handleZoom = (delta: number) => {
        setScale((prev) => Math.min(Math.max(prev + delta, 0.5), 3.0))
    }

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(
                'PDF content copied from document: ' + doc.filename
            )
        } catch {
            // Handle copy error silently
        }
    }

    const handleFullscreen = () => {
        if (contentRef.current) {
            if (document.fullscreenElement) {
                document.exitFullscreen()
            } else {
                contentRef.current.requestFullscreen()
            }
        }
    }

    if (loading) {
        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                <div
                    className="absolute inset-0 bg-slate-100/80 backdrop-blur-sm"
                    onClick={onClose}
                />
                <Card className="relative p-8 flex flex-col items-center justify-center bg-white shadow-xl max-w-md w-full">
                    <Loader2
                        className="animate-spin text-purple-600 mb-4"
                        size={48}
                    />
                    <p className="text-slate-700 font-medium">
                        Loading document...
                    </p>
                    <p className="text-slate-500 text-sm mt-2">
                        {doc.filename}
                    </p>
                </Card>
            </div>
        )
    }

    if (error) {
        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                <div
                    className="absolute inset-0 bg-slate-100/80 backdrop-blur-sm"
                    onClick={onClose}
                />
                <Card className="relative p-8 flex flex-col items-center justify-center bg-white shadow-xl max-w-md w-full">
                    <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
                        <FileText
                            className="text-red-600"
                            size={32}
                        />
                    </div>
                    <p className="text-slate-900 font-semibold text-lg mb-2 text-center">
                        Failed to Load Document
                    </p>
                    <p className="text-slate-600 text-center mb-6">
                        {error}
                    </p>
                    <div className="flex gap-3">
                        <Button variant="secondary" onClick={onClose}>
                            Close
                        </Button>
                        <Button
                            variant="primary"
                            onClick={() => window.location.reload()}
                        >
                            Retry
                        </Button>
                    </div>
                </Card>
            </div>
        )
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 md:p-4">
            <div
                className="absolute inset-0 bg-slate-100/80 backdrop-blur-sm"
                onClick={onClose}
            />
            <div className="relative w-full max-w-5xl animate-scale-in">
                <Card
                    className="flex flex-col h-[85vh] bg-white shadow-xl border-slate-200 overflow-hidden"
                    interactive={false}
                    hoverEffect={false}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white shrink-0 shadow-lg">
                                <FileText size={20} />
                            </div>
                            <div className="min-w-0">
                                <h2 className="font-semibold text-slate-900 truncate">
                                    {doc.filename}
                                </h2>
                                <p className="text-xs text-slate-500 truncate">
                                    {formatFileSize(doc.size_bytes)}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-4">
                            <div className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 rounded-lg">
                                <button
                                    onClick={() => handleZoom(-0.2)}
                                    className="p-1 hover:bg-slate-200 rounded transition-colors"
                                    title="Zoom out"
                                >
                                    <ZoomOut size={16} />
                                </button>
                                <span className="text-sm font-medium min-w-[3rem] text-center">
                                    {Math.round(scale * 100)}%
                                </span>
                                <button
                                    onClick={() => handleZoom(0.2)}
                                    className="p-1 hover:bg-slate-200 rounded transition-colors"
                                    title="Zoom in"
                                >
                                    <ZoomIn size={16} />
                                </button>
                            </div>
                            <button
                                onClick={handleCopy}
                                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                                title="Copy content"
                            >
                                <Copy size={18} />
                            </button>
                            <button
                                onClick={handleFullscreen}
                                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                                title="Fullscreen"
                            >
                                <Maximize2 size={18} />
                            </button>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-colors"
                                title="Close"
                            >
                                <X size={20} />
                            </button>
                        </div>
                    </div>

                    {/* Main Content */}
                    <div 
                        className="flex-1 overflow-auto bg-slate-100 scroll-smooth"
                        ref={contentRef}
                    >
                        <div
                            className="flex justify-center p-4 md:p-8 min-h-full"
                        >
                            {pdfBlobUrl ? (
                                <div className="shadow-lg">
                                    <Document
                                        file={pdfBlobUrl}
                                        onLoadSuccess={onDocumentLoadSuccess}
                                        onLoadError={onDocumentLoadError}
                                        loading={
                                            <div className="flex items-center justify-center p-8">
                                                <Loader2 className="animate-spin text-purple-600" />
                                            </div>
                                        }
                                    >
                                        <Page
                                            pageNumber={pageNumber}
                                            scale={scale}
                                            renderTextLayer={false}
                                            renderAnnotationLayer={false}
                                            loading={
                                                <div className="flex items-center justify-center p-8">
                                                    <Loader2 className="animate-spin text-purple-600" />
                                                </div>
                                            }
                                        />
                                    </Document>
                                </div>
                            ) : (
                                <div className="flex items-center justify-center">
                                    <div className="text-center">
                                        <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center mx-auto mb-4">
                                            <FileText
                                                className="text-slate-400"
                                                size={32}
                                            />
                                        </div>
                                        <p className="text-slate-600 font-medium">
                                            No preview available
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex flex-col sm:flex-row items-center justify-between p-3 md:p-4 border-t border-slate-200 bg-slate-50 text-xs text-slate-600 gap-2">
                        <div className="text-center sm:text-left">
                            Document ID: {doc.id} - Uploaded:{' '}
                            {new Date(doc.created_at).toLocaleDateString()}
                        </div>
                        <div className="flex items-center gap-4">
                            {/* Page navigation controls */}
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setPageNumber(1)}
                                    disabled={pageNumber === 1}
                                    className="p-1.5 hover:bg-slate-200 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                    title="First page"
                                >
                                    |←
                                </button>
                                <button
                                    onClick={() => setPageNumber(Math.max(1, pageNumber - 1))}
                                    disabled={pageNumber === 1}
                                    className="p-1.5 hover:bg-slate-200 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                    title="Previous page"
                                >
                                    ←
                                </button>
                                <div className="flex items-center gap-1 px-2 py-1 bg-white rounded border border-slate-200">
                                    <input
                                        ref={pageInputRef}
                                        type="number"
                                        min={1}
                                        max={numPages}
                                        value={pageNumber}
                                        onChange={(e) => {
                                            const newPage = parseInt(e.target.value)
                                            if (newPage >= 1 && newPage <= numPages) {
                                                setPageNumber(newPage)
                                            }
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                const newPage = parseInt((e.target as HTMLInputElement).value)
                                                if (newPage >= 1 && newPage <= numPages) {
                                                    setPageNumber(newPage)
                                                }
                                            }
                                        }}
                                        className="w-12 text-center text-sm font-medium border-none outline-none bg-transparent"
                                    />
                                    <span className="text-slate-400">/</span>
                                    <span className="text-slate-500">{numPages}</span>
                                </div>
                                <button
                                    onClick={() => setPageNumber(Math.min(numPages, pageNumber + 1))}
                                    disabled={pageNumber === numPages}
                                    className="p-1.5 hover:bg-slate-200 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                    title="Next page"
                                >
                                    →
                                </button>
                                <button
                                    onClick={() => setPageNumber(numPages)}
                                    disabled={pageNumber === numPages}
                                    className="p-1.5 hover:bg-slate-200 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                    title="Last page"
                                >
                                    →|
                                </button>
                            </div>
                            <span className="text-slate-400">|</span>
                            <span>Scale: {Math.round(scale * 100)}%</span>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    )
}

export default DocumentContentModal
