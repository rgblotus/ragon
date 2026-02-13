import React, { useState, useEffect } from 'react'
import { CheckCircle, Loader2, Database, Brain } from 'lucide-react'
import Card from '../ui/Card'
import Button from '../ui/Button'
import type { Document, Collection } from '../../types/api'
import DocumentContentModal from './DocumentContentModal'
import { api } from '../../services/api'

interface DocumentDetailsModalProps {
    document: Document
    collection: Collection | null
    onClose: () => void
    onShowVectorVisualization: () => void
    formatFileSize: (bytes: number) => string
}

const DocumentDetailsModal: React.FC<DocumentDetailsModalProps> = ({
    document,
    collection,
    onClose,
    onShowVectorVisualization,
    formatFileSize,
}) => {
    const [showContentModal, setShowContentModal] = React.useState(false)
    const [vectorInfo, setVectorInfo] = React.useState<{vector_count: number, dimensions: number} | null>(null)
    const [loadingVectors, setLoadingVectors] = React.useState(false)

    useEffect(() => {
        const fetchVectorInfo = async () => {
            if (!document.processed) return

            setLoadingVectors(true)
            try {
                const response = await api.get<{count: number, vectorPoints: Array<unknown>, original_dimensions?: number}>(`/documents/${document.id}/vectors`)
                console.log('Vector response:', response)
                if (response) {
                    setVectorInfo({
                        vector_count: response.count || (response.vectorPoints?.length || 0),
                        dimensions: response.original_dimensions || 384
                    })
                }
            } catch (err) {
                console.error('Failed to fetch vectors:', err)
                setVectorInfo({ vector_count: 0, dimensions: 384 })
            } finally {
                setLoadingVectors(false)
            }
        }

        fetchVectorInfo()
    }, [document.id, document.processed])

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-slate-100/80 backdrop-blur-sm"
                onClick={onClose}
            />
            <div className="relative w-full max-w-3xl animate-scale-in">
                <Card
                    className="p-3 md:p-4 border-slate-200 shadow-xl bg-white overflow-y-auto max-h-[85vh] backdrop-blur-sm"
                    interactive={false}
                    hoverEffect={false}
                >
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center border border-blue-200">
                            <Database className="text-white" size={16} />
                        </div>
                        <h2 className="text-lg md:text-xl font-bold text-slate-900">
                            Document Details
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* File Information */}
                        <div className="space-y-4">
                            <h3 className="text-base font-semibold text-slate-900 border-b border-slate-200 pb-1.5 flex items-center gap-2 mb-3">
                                <Database className="text-blue-600" size={16} />
                                File Information
                            </h3>
                            <div className="grid grid-cols-1 gap-3">
                                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-3 border border-blue-200/50 shadow-sm">
                                    <div className="text-xs font-bold text-blue-700 uppercase tracking-widest mb-1">
                                        Filename
                                    </div>
                                    <div className="text-slate-900 font-medium text-sm break-all">
                                        {document.filename}
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-3 border border-green-200/50 shadow-sm">
                                        <div className="text-xs font-bold text-green-700 uppercase tracking-widest mb-1">
                                            File Size
                                        </div>
                                        <div className="text-slate-900 font-medium text-sm">
                                            {formatFileSize(
                                                document.size_bytes,
                                            )}
                                        </div>
                                    </div>
                                    <div className="bg-gradient-to-r from-purple-50 to-violet-50 rounded-lg p-3 border border-purple-200/50 shadow-sm">
                                        <div className="text-xs font-bold text-purple-700 uppercase tracking-widest mb-1">
                                            Upload Date
                                        </div>
                                        <div className="text-slate-900 font-medium text-sm">
                                            {new Date(
                                                document.created_at,
                                            ).toLocaleDateString()}
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-gradient-to-r from-slate-50 to-gray-50 rounded-lg p-3 border border-slate-200/50 shadow-sm">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="text-xs font-bold text-slate-700 uppercase tracking-widest mb-1">
                                                Status
                                            </div>
                                            <div className="text-slate-900 font-medium">
                                                {document.processed ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 border border-green-200 uppercase tracking-tighter">
                                                        <CheckCircle
                                                            size={10}
                                                        />
                                                        Processed
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold bg-gradient-to-r from-yellow-100 to-orange-100 text-yellow-800 border border-yellow-200 uppercase tracking-tighter">
                                                        <Loader2
                                                            size={10}
                                                            className="animate-spin"
                                                        />
                                                        Processing
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Vector Database Information */}
                        <div className="space-y-4">
                            <h3 className="text-base font-semibold text-slate-900 border-b border-slate-200 pb-1.5 flex items-center gap-2 mb-3">
                                <Database
                                    className="text-purple-600"
                                    size={16}
                                />
                                Vector Database Information
                            </h3>
                            <div className="bg-gradient-to-br from-slate-50 to-gray-50 rounded-lg p-4 border border-slate-200/50 shadow-sm">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="bg-white rounded-lg p-4 border border-slate-100">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="text-sm font-bold text-slate-900 mb-1">
                                                    Status
                                                </div>
                                                <div className="text-sm font-semibold text-green-600">
                                                    {document.processed ? 'Indexed' : 'Processing'}
                                                </div>
                                            </div>
                                            <CheckCircle
                                                className="text-green-400"
                                                size={20}
                                            />
                                        </div>
                                    </div>
                                    <div className="bg-white rounded-lg p-4 border border-slate-100">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="text-sm font-bold text-slate-900 mb-1">
                                                    Dimensions
                                                </div>
                                                <div className="text-sm font-semibold text-blue-600">
                                                    384
                                                </div>
                                            </div>
                                            <Brain
                                                className="text-blue-400"
                                                size={20}
                                            />
                                        </div>
                                    </div>
                                    <div className="bg-white rounded-lg p-4 border border-slate-100">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="text-sm font-bold text-slate-900 mb-1">
                                                    Vector Count
                                                </div>
                                                <div className="text-sm font-semibold text-purple-600">
                                                    {loadingVectors ? (
                                                        <Loader2 size={14} className="animate-spin inline" />
                                                    ) : (
                                                        vectorInfo?.vector_count || 0
                                                    )}
                                                </div>
                                            </div>
                                            <Database
                                                className="text-purple-400"
                                                size={20}
                                            />
                                        </div>
                                    </div>
                                    <div className="bg-white rounded-lg p-4 border border-slate-100">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="text-sm font-bold text-slate-900 mb-1">
                                                    Collection
                                                </div>
                                                <div className="text-sm font-semibold text-slate-600">
                                                    {collection?.name || 'Default'}
                                                </div>
                                            </div>
                                                <Database
                                                    className="text-slate-400"
                                                    size={20}
                                                />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3 pt-4 mt-4 border-t border-slate-200">
                        {document.processed && (
                            <Button
                                variant="secondary"
                                className="flex-1 bg-purple-50 hover:bg-purple-100 border-purple-200 hover:border-purple-300 text-purple-700"
                                onClick={onShowVectorVisualization}
                            >
                                <Brain size={16} className="mr-2" />
                                View Vector Visualization
                            </Button>
                        )}
                        <Button
                            variant="secondary"
                            className="flex-1 bg-slate-100 hover:bg-slate-200 border-slate-300 hover:border-slate-400"
                            onClick={onClose}
                        >
                            Close
                        </Button>
                    </div>
                </Card>
            </div>

            {/* Document Content Modal */}
            {showContentModal && (
                <DocumentContentModal
                    document={document}
                    onClose={() => setShowContentModal(false)}
                    formatFileSize={formatFileSize}
                />
            )}
        </div>
    )
}

export default DocumentDetailsModal
