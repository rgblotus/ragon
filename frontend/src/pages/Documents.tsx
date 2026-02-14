// Enhanced Documents page with modern UI design
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useProgress } from '../contexts/ProgressContext'
import { documentApi, collectionApi, ragApi } from '../services/api'
import Layout from '../components/layout/Layout'
import Button from '../components/ui/Button'
import {
    Upload,
    File,
    CheckCircle,
    AlertCircle,
    Trash2,
    Loader2,
    Plus,
    Search,
    X,
    ChevronLeft,
    ChevronRight,
    Info,
    Grid,
    List,
    HardDrive,
    FileText,
    Filter,
    SortAsc,
    SortDesc,
    Layers,
    Brain,
    Eye
} from 'lucide-react'
import type { Collection, Document } from '../types/api'
import DocumentDetailsModal from '../components/documents/DocumentDetailsModal'
import DocumentPreview from '../components/documents/DocumentPreview'
import DocumentStatus from '../components/documents/DocumentStatus'
import VectorVisualizationModal from '../components/documents/VectorVisualizationModal'
import DocumentContentModal from '../components/documents/DocumentContentModal'

type ViewMode = 'grid' | 'list'
type SortField = 'created_at' | 'filename' | 'size_bytes'
type SortOrder = 'asc' | 'desc'

const Documents = () => {
    const { user } = useAuth()
    const { progressMap, connect } = useProgress()
    const fileInputRef = useRef<HTMLInputElement>(null)
    const dragDropRef = useRef<HTMLDivElement>(null)

    // State
    const [collections, setCollections] = useState<Collection[]>([])
    const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null)
    const [documents, setDocuments] = useState<Document[]>([])
    const [loading, setLoading] = useState(true)
    const [uploading, setUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({})
    const [error, setError] = useState<string | null>(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [currentPage, setCurrentPage] = useState(1)
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [newColName, setNewColName] = useState('')
    const [newColDesc, setNewColDesc] = useState('')
    const [creating, setCreating] = useState(false)
    const [viewMode, setViewMode] = useState<ViewMode>('grid')
    const [sortField, setSortField] = useState<SortField>('created_at')
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
    const [filterType, setFilterType] = useState<string>('all')
    const [filterStatus, setFilterStatus] = useState<string>('all')
    const [showFilters, setShowFilters] = useState(false)
    const [isDragging, setIsDragging] = useState(false)

    // Modal states
    const [selectedDocument, setSelectedDocument] = useState<Document | null>(null)
    const [showDetailModal, setShowDetailModal] = useState(false)
    const [showVectorModal, setShowVectorModal] = useState(false)
    const [showContentModal, setShowContentModal] = useState(false)

    // Pagination
    const itemsPerPage = 12

    // Sorting and filtering
    const filteredDocs = documents
        .filter((doc) => {
            const matchesSearch = doc.filename.toLowerCase().includes(searchTerm.toLowerCase())
            const matchesType = filterType === 'all' || doc.content_type === filterType
            const matchesStatus = filterStatus === 'all' || 
                (filterStatus === 'processed' && doc.processed) ||
                (filterStatus === 'processing' && !doc.processed)
            return matchesSearch && matchesType && matchesStatus
        })
        .sort((a, b) => {
            let comparison = 0
            if (sortField === 'created_at') {
                comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            } else if (sortField === 'filename') {
                comparison = a.filename.localeCompare(b.filename)
            } else if (sortField === 'size_bytes') {
                comparison = a.size_bytes - b.size_bytes
            }
            return sortOrder === 'asc' ? comparison : -comparison
        })

    const totalPages = Math.ceil(filteredDocs.length / itemsPerPage)
    const startIndex = (currentPage - 1) * itemsPerPage
    const paginatedDocs = filteredDocs.slice(startIndex, startIndex + itemsPerPage)

    // Reset on filter change
    useEffect(() => {
        setCurrentPage(1)
    }, [searchTerm, selectedCollection, filterType, filterStatus, sortField, sortOrder])

    // Data loading
    useEffect(() => {
        if (!user) {
            setCollections([])
            setDocuments([])
            setSelectedCollection(null)
            return
        }
        loadCollections()
    }, [user])

    useEffect(() => {
        if (selectedCollection) {
            loadDocuments(selectedCollection.id)
        }
    }, [selectedCollection])

    useEffect(() => {
        if (user) connect()
    }, [user, connect])

    // Auto-refresh when processing completes
    useEffect(() => {
        if (!selectedCollection || documents.length === 0) return
        const processingDocs = documents.filter((doc) => !doc.processed)
        if (processingDocs.length === 0) return
        const hasCompletedTask = processingDocs.some((doc) => {
            const task = progressMap[doc.id.toString()]
            return task && task.progress === 100
        })
        if (hasCompletedTask) {
            loadDocuments(selectedCollection.id)
        }
    }, [progressMap, documents, selectedCollection])

    const loadCollections = async () => {
        try {
            const response = await collectionApi.getAll()
            setCollections(response)
            if (response.length > 0 && !selectedCollection) {
                const def = response.find((c) => c.is_default) || response[0]
                setSelectedCollection(def)
            }
        } catch (err) {
            console.error('Failed to load collections:', err)
            setError('Failed to load collections')
        }
    }

    const loadDocuments = async (collectionId: number) => {
        setLoading(true)
        try {
            const response = await documentApi.getAll(collectionId)
            setDocuments(response)
        } catch (err) {
            console.error('Failed to load documents:', err)
            setError('Failed to load documents')
        } finally {
            setLoading(false)
        }
    }

    // Drag and drop handlers
    const handleDragEnter = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(true)
    }, [])

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        if (e.currentTarget === dragDropRef.current) {
            setIsDragging(false)
        }
    }, [])

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
    }, [])

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(false)
        const files = e.dataTransfer.files
        if (files.length > 0 && selectedCollection) {
            handleFileUpload(files)
        }
    }, [selectedCollection])

    // File upload
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (files && files.length > 0 && selectedCollection) {
            handleFileUpload(files)
        }
    }

    const handleFileUpload = async (files: FileList) => {
        setUploading(true)
        setError(null)
        const newProgress: Record<string, number> = {}
        
        for (let i = 0; i < files.length; i++) {
            newProgress[files[i].name] = 0
        }
        setUploadProgress(newProgress)

        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i]
                newProgress[file.name] = 50
                setUploadProgress({ ...newProgress })
                await documentApi.upload(file, selectedCollection!.id)
                newProgress[file.name] = 100
                setUploadProgress({ ...newProgress })
            }
            await loadCollections()
            if (selectedCollection) {
                await loadDocuments(selectedCollection.id)
            }
        } catch (err) {
            console.error('Upload failed:', err)
            setError(`Failed to upload: ${err instanceof Error ? err.message : 'Unknown error'}`)
        } finally {
            setUploading(false)
            setUploadProgress({})
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    const handleDeleteDocument = async (docId: number) => {
        if (!window.confirm('Delete this document?')) return
        try {
            await documentApi.delete(docId)
            if (selectedCollection) {
                await loadDocuments(selectedCollection.id)
                await loadCollections()
            }
        } catch {
            setError('Failed to delete document')
        }
    }

    const handleCreateCollection = async () => {
        if (!newColName.trim()) return
        setCreating(true)
        try {
            await collectionApi.create({ name: newColName.trim() })
            await loadCollections()
            setShowCreateModal(false)
            setNewColName('')
            setNewColDesc('')
        } catch {
            setError('Failed to create collection')
        } finally {
            setCreating(false)
        }
    }

    const handleDeleteCollection = async (col: Collection) => {
        if (!window.confirm(`Delete collection "${col.name}"? This cannot be undone.`)) return
        try {
            await collectionApi.delete(col.id)
            if (selectedCollection?.id === col.id) {
                const def = collections.find((c) => c.is_default && c.id !== col.id)
                setSelectedCollection(def || null)
            }
            await loadCollections()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete collection')
        }
    }

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    }

    const getCollectionStats = () => {
        const totalSize = documents.reduce((acc, doc) => acc + doc.size_bytes, 0)
        const processed = documents.filter(d => d.processed).length
        return { totalSize, processed, total: documents.length }
    }

    const stats = getCollectionStats()

    return (
        <Layout currentPage="documents" className="container mx-auto px-4 pb-10 pt-6">
            {error && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-600 flex items-center gap-2 backdrop-blur-sm">
                    <AlertCircle size={20} />
                    {error}
                    <button onClick={() => setError(null)} className="ml-auto">
                        <X size={16} />
                    </button>
                </div>
            )}

            {/* Page Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Documents</h1>
                    <p className="text-slate-500 text-sm">Manage your documents and collections</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mt-2">
                    {/* Collections Sidebar */}
                    <div className="lg:col-span-1 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wider">
                                Collections
                            </h3>
                            <button
                                onClick={() => setShowCreateModal(true)}
                                className="p-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                            >
                                <Plus size={16} />
                            </button>
                        </div>

                        <div className="space-y-2">
                            {collections.map((col) => (
                                <div
                                    key={col.id}
                                    onClick={() => setSelectedCollection(col)}
                                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                                        selectedCollection?.id === col.id
                                            ? 'bg-blue-500/10 border-blue-300 ring-2 ring-blue-200'
                                            : 'bg-white/50 border-slate-200 hover:bg-white hover:border-blue-300'
                                    }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                            selectedCollection?.id === col.id
                                                ? 'bg-blue-500 text-white'
                                                : 'bg-slate-100 text-slate-600'
                                        }`}>
                                            <Layers size={16} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-medium text-sm truncate">{col.name}</h4>
                                            <p className="text-xs text-slate-500">{col.document_count} docs</p>
                                        </div>
                                        {!col.is_default && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    handleDeleteCollection(col)
                                                }}
                                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Delete collection"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Main Content */}
                    <div className="lg:col-span-4 space-y-6">
                        {selectedCollection ? (
                            <>
                                {/* Header Card */}
                                <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200 p-6 shadow-lg">
                                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                        <div>
                                            <h2 className="text-2xl font-bold text-slate-800 leading-tight">{selectedCollection.name}</h2>
                                            <p className="text-sm text-slate-500 mt-1">{selectedCollection.description || 'No description'}</p>
                                            
                                            {/* Stats Row */}
                                            <div className="flex items-center gap-6 mt-4">
                                                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                                                    <File size={14} />
                                                    <span>{stats.total} documents</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                                                    <HardDrive size={14} />
                                                    <span>{formatFileSize(stats.totalSize)}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-xs text-green-600">
                                                    <CheckCircle size={14} />
                                                    <span>{stats.processed} indexed</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <input
                                                type="file"
                                                ref={fileInputRef}
                                                className="hidden"
                                                accept=".txt,.pdf,.doc,.docx"
                                                multiple
                                                onChange={handleFileSelect}
                                            />
                                            <Button
                                                variant="primary"
                                                onClick={() => fileInputRef.current?.click()}
                                                disabled={uploading}
                                                className="gap-2"
                                            >
                                                {uploading ? (
                                                    <Loader2 className="animate-spin" size={18} />
                                                ) : (
                                                    <Upload size={18} />
                                                )}
                                                Upload Files
                                            </Button>
                                        </div>
                                    </div>
                                </div>

                                {/* Search & Filters Bar */}
                                <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200 p-4 shadow-sm">
                                    <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                                        <div className="relative flex-1 w-full">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                            <input
                                                type="text"
                                                placeholder="Search documents..."
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                                            />
                                            {searchTerm && (
                                                <button
                                                    onClick={() => setSearchTerm('')}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                                >
                                                    <X size={16} />
                                                </button>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-3">
                                            {/* Filter Toggle */}
                                            <button
                                                onClick={() => setShowFilters(!showFilters)}
                                                className={`p-2.5 rounded-xl border transition-colors ${
                                                    showFilters
                                                        ? 'bg-blue-500 text-white border-blue-500'
                                                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                                }`}
                                            >
                                                <Filter size={18} />
                                            </button>

                                            {/* Sort */}
                                            <select
                                                value={sortField}
                                                onChange={(e) => setSortField(e.target.value as SortField)}
                                                className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            >
                                                <option value="created_at">Date</option>
                                                <option value="filename">Name</option>
                                                <option value="size_bytes">Size</option>
                                            </select>

                                            <button
                                                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                                                className="p-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                                            >
                                                {sortOrder === 'asc' ? <SortAsc size={18} /> : <SortDesc size={18} />}
                                            </button>

                                            {/* View Toggle */}
                                            <div className="flex items-center bg-slate-100 rounded-xl p-1">
                                                <button
                                                    onClick={() => setViewMode('grid')}
                                                    className={`p-2 rounded-lg transition-colors ${
                                                        viewMode === 'grid' ? 'bg-white shadow text-blue-500' : 'text-slate-500'
                                                    }`}
                                                >
                                                    <Grid size={18} />
                                                </button>
                                                <button
                                                    onClick={() => setViewMode('list')}
                                                    className={`p-2 rounded-lg transition-colors ${
                                                        viewMode === 'list' ? 'bg-white shadow text-blue-500' : 'text-slate-500'
                                                    }`}
                                                >
                                                    <List size={18} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Filter Panel */}
                                    {showFilters && (
                                        <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-slate-200">
                                            <select
                                                value={filterType}
                                                onChange={(e) => setFilterType(e.target.value)}
                                                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                                            >
                                                <option value="all">All Types</option>
                                                <option value="pdf">PDF</option>
                                                <option value="txt">TXT</option>
                                                <option value="doc">DOC</option>
                                            </select>
                                            <select
                                                value={filterStatus}
                                                onChange={(e) => setFilterStatus(e.target.value)}
                                                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                                            >
                                                <option value="all">All Status</option>
                                                <option value="processed">Indexed</option>
                                                <option value="processing">Processing</option>
                                            </select>
                                        </div>
                                    )}
                                </div>

                                {/* Drag & Drop Zone */}
                                <div
                                    ref={dragDropRef}
                                    onDragEnter={handleDragEnter}
                                    onDragLeave={handleDragLeave}
                                    onDragOver={handleDragOver}
                                    onDrop={handleDrop}
                                    className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
                                        isDragging
                                            ? 'border-blue-500 bg-blue-500/10'
                                            : 'border-slate-300 bg-white/50'
                                    }`}
                                >
                                    <div className={`transition-opacity ${isDragging ? 'opacity-0' : 'opacity-100'}`}>
                                        <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
                                            <Upload className="text-blue-500" size={32} />
                                        </div>
                                        <p className="text-slate-600 mb-2">
                                            Drag & drop files here, or{' '}
                                            <button
                                                onClick={() => fileInputRef.current?.click()}
                                                className="text-blue-500 font-medium hover:underline"
                                            >
                                                browse
                                            </button>
                                        </p>
                                        <p className="text-xs text-slate-400">PDF, TXT, DOC, DOCX up to 50MB</p>
                                    </div>
                                    
                                    {isDragging && (
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <div className="bg-blue-500 text-white px-6 py-3 rounded-xl font-medium">
                                                Drop files to upload
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Upload Progress */}
                                {Object.keys(uploadProgress).length > 0 && (
                                    <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200 p-4">
                                        <h4 className="text-sm font-medium text-slate-700 mb-3">Uploading...</h4>
                                        <div className="space-y-2">
                                            {Object.entries(uploadProgress).map(([name, progress]) => (
                                                <div key={name} className="flex items-center gap-3">
                                                    <File size={16} className="text-slate-400" />
                                                    <div className="flex-1">
                                                        <div className="flex justify-between text-xs mb-1">
                                                            <span className="text-slate-600 truncate">{name}</span>
                                                            <span className="text-slate-500">{progress}%</span>
                                                        </div>
                                                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full bg-blue-500 rounded-full transition-all duration-300"
                                                                style={{ width: `${progress}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Documents Grid/List */}
                                {loading ? (
                                    <div className="flex items-center justify-center py-20">
                                        <Loader2 className="animate-spin text-blue-500" size={40} />
                                    </div>
                                ) : documents.length === 0 ? (
                                    <div className="text-center py-20 bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200">
                                        <div className="w-20 h-20 mx-auto mb-4 bg-slate-100 rounded-full flex items-center justify-center">
                                            <File className="text-slate-400" size={40} />
                                        </div>
                                        <h3 className="text-lg font-medium text-slate-700 mb-2">No documents yet</h3>
                                        <p className="text-sm text-slate-500">Upload your first document to get started</p>
                                    </div>
                                ) : viewMode === 'grid' ? (
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                        {paginatedDocs.map((doc) => (
                                            <div
                                                key={doc.id}
                                                className="bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200 p-4 hover:shadow-lg hover:border-blue-300 transition-all"
                                            >
                                                <div
                                                    className="group aspect-[3/4] bg-slate-100 rounded-lg mb-3 flex items-center justify-center overflow-hidden relative cursor-pointer"
                                                    onClick={() => {
                                                        setSelectedDocument(doc)
                                                        setShowDetailModal(true)
                                                    }}
                                                >
                                                    <DocumentPreview document={doc} />
                                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                setSelectedDocument(doc)
                                                                setShowContentModal(true)
                                                            }}
                                                            className="p-2 bg-white rounded-lg text-slate-700 hover:bg-blue-500 hover:text-white transition-colors"
                                                            title="Preview Document"
                                                        >
                                                            <Eye size={18} />
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                setSelectedDocument(doc)
                                                                setShowDetailModal(true)
                                                            }}
                                                            className="p-2 bg-white rounded-lg text-slate-700 hover:bg-slate-600 hover:text-white transition-colors"
                                                            title="View Details"
                                                        >
                                                            <Info size={18} />
                                                        </button>
                                                        {doc.processed && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    setSelectedDocument(doc)
                                                                    setShowVectorModal(true)
                                                                }}
                                                                className="p-2 bg-white rounded-lg text-slate-700 hover:bg-purple-500 hover:text-white transition-colors"
                                                                title="Vector Visualization"
                                                            >
                                                                <Brain size={18} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center justify-between mb-1">
                                                    <h4 className="font-medium text-sm text-slate-700 truncate flex-1">
                                                        {doc.filename}
                                                    </h4>
                                                    {doc.processed && (
                                                        <button
                                                            onClick={() => {
                                                                setSelectedDocument(doc)
                                                                setShowVectorModal(true)
                                                            }}
                                                            className="p-1.5 text-purple-500 hover:bg-purple-50 rounded-lg transition-colors"
                                                            title="View Vector Visualization"
                                                        >
                                                            <Brain size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="flex items-center justify-between text-xs text-slate-500">
                                                    <span>{formatFileSize(doc.size_bytes)}</span>
                                                    <DocumentStatus doc={doc} progressMap={progressMap} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200 overflow-hidden">
                                        <table className="w-full">
                                            <thead className="bg-slate-50 border-b border-slate-200">
                                                <tr>
                                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Name</th>
                                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Size</th>
                                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Status</th>
                                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Date</th>
                                                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {paginatedDocs.map((doc) => (
                                                    <tr
                                                        key={doc.id}
                                                        className="hover:bg-slate-50 transition-colors cursor-pointer"
                                                        onClick={() => {
                                                            setSelectedDocument(doc)
                                                            setShowDetailModal(true)
                                                        }}
                                                    >
                                                        <td className="px-4 py-3">
                                                            <div className="flex items-center gap-3">
                                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                                                    doc.content_type === 'pdf' ? 'bg-red-100' :
                                                                    doc.content_type === 'txt' ? 'bg-blue-100' :
                                                                    ['png', 'jpg', 'jpeg', 'gif'].includes(doc.content_type) ? 'bg-green-100' :
                                                                    'bg-slate-200'
                                                                }`}>
                                                                    <FileText size={16} className={
                                                                        doc.content_type === 'pdf' ? 'text-red-600' :
                                                                        doc.content_type === 'txt' ? 'text-blue-600' :
                                                                        ['png', 'jpg', 'jpeg', 'gif'].includes(doc.content_type) ? 'text-green-600' :
                                                                        'text-slate-500'
                                                                    } />
                                                                </div>
                                                                <span className="font-medium text-sm text-slate-700">{doc.filename}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-slate-600">
                                                            {formatFileSize(doc.size_bytes)}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <DocumentStatus doc={doc} progressMap={progressMap} />
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-slate-600">
                                                            {new Date(doc.created_at).toLocaleDateString()}
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            <div className="flex items-center justify-end gap-2">
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        setSelectedDocument(doc)
                                                                        setShowContentModal(true)
                                                                    }}
                                                                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                                                                    title="Preview Document"
                                                                >
                                                                    <Eye size={16} />
                                                                </button>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        setSelectedDocument(doc)
                                                                        setShowVectorModal(true)
                                                                    }}
                                                                    className="p-2 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg"
                                                                    title="Vector Visualization"
                                                                >
                                                                    <Brain size={16} />
                                                                </button>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        handleDeleteDocument(doc.id)
                                                                    }}
                                                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                                                                    title="Delete Document"
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {/* Pagination */}
                                {totalPages > 1 && (
                                    <div className="flex items-center justify-center gap-2">
                                        <button
                                            disabled={currentPage === 1}
                                            onClick={() => setCurrentPage(p => p - 1)}
                                            className="p-2 rounded-lg bg-white border border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
                                        >
                                            <ChevronLeft size={18} />
                                        </button>
                                        <span className="text-sm text-slate-600 px-4">
                                            Page {currentPage} of {totalPages}
                                        </span>
                                        <button
                                            disabled={currentPage === totalPages}
                                            onClick={() => setCurrentPage(p => p + 1)}
                                            className="p-2 rounded-lg bg-white border border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
                                        >
                                            <ChevronRight size={18} />
                                        </button>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="text-center py-20">
                                <div className="w-20 h-20 mx-auto mb-4 bg-slate-100 rounded-full flex items-center justify-center">
                                    <Layers className="text-slate-400" size={40} />
                                </div>
                                <h3 className="text-lg font-medium text-slate-700 mb-2">No collection selected</h3>
                                <p className="text-sm text-slate-500">Select or create a collection to manage documents</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Modals */}
                {showDetailModal && selectedDocument && (
                    <DocumentDetailsModal
                        document={selectedDocument}
                        collection={selectedCollection}
                        onClose={() => {
                            setShowDetailModal(false)
                            setSelectedDocument(null)
                        }}
                        onShowVectorVisualization={() => setShowVectorModal(true)}
                        formatFileSize={formatFileSize}
                    />
                )}

                {showVectorModal && selectedDocument && (
                    <VectorVisualizationModal
                        document={selectedDocument}
                        collection={null}
                        onClose={() => {
                            setShowVectorModal(false)
                            setSelectedDocument(null)
                        }}
                        onShowDocumentDetails={() => {
                            setShowVectorModal(false)
                        }}
                    />
                )}

                {showContentModal && selectedDocument && (
                    <DocumentContentModal
                        document={selectedDocument}
                        onClose={() => {
                            setShowContentModal(false)
                            setSelectedDocument(null)
                        }}
                        formatFileSize={formatFileSize}
                    />
                )}

                {/* Create Collection Modal */}
                {showCreateModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-2xl p-6 w-full max-w-md">
                            <h3 className="text-lg font-bold text-slate-800 mb-4">Create Collection</h3>
                            <input
                                type="text"
                                placeholder="Collection name"
                                value={newColName}
                                onChange={(e) => setNewColName(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <textarea
                                placeholder="Description (optional)"
                                value={newColDesc}
                                onChange={(e) => setNewColDesc(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                rows={3}
                            />
                            <div className="flex gap-3 justify-end">
                                <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
                                    Cancel
                                </Button>
                                <Button variant="primary" onClick={handleCreateCollection} disabled={creating || !newColName.trim()}>
                                    {creating ? <Loader2 className="animate-spin" size={18} /> : 'Create'}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </Layout>
    )
}

export default Documents
