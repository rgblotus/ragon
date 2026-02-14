import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Layout from '../components/layout/Layout'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import {
    FileText,
    Upload,
    MessageCircle,
    Brain,
    ChevronRight,
    Clock,
    CheckCircle,
    AlertCircle,
    Layers,
    File,
    Bot,
    Wand2,
    Folder,
    FileStack,
    Activity,
    Plus,
    Sparkles,
} from 'lucide-react'
import { collectionApi, documentApi } from '../services/api'
import type { Collection, Document } from '../types/api'

const Dashboard = () => {
    const { user } = useAuth()
    const navigate = useNavigate()
    const [stats, setStats] = useState({
        collections: 0,
        documents: 0,
        processed: 0,
        pending: 0,
    })
    const [recentDocuments, setRecentDocuments] = useState<Document[]>([])
    const [recentCollections, setRecentCollections] = useState<Collection[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                setLoading(true)
                setError(null)

                const [collectionsResponse, documentsResponse] =
                    await Promise.all([
                        collectionApi.getAll(),
                        user ? documentApi.getAll() : Promise.resolve([]),
                    ])

                const processedDocs = documentsResponse.filter(
                    (doc: Document) => doc.processed,
                )
                const pendingDocs = documentsResponse.filter(
                    (doc: Document) => !doc.processed,
                )

                setStats({
                    collections: collectionsResponse.length,
                    documents: documentsResponse.length,
                    processed: processedDocs.length,
                    pending: pendingDocs.length,
                })

                setRecentDocuments(
                    (documentsResponse as Document[])
                        .sort(
                            (a, b) =>
                                new Date(b.created_at).getTime() -
                                new Date(a.created_at).getTime(),
                        )
                        .slice(0, 5),
                )

                setRecentCollections(
                    (collectionsResponse as Collection[])
                        .sort(
                            (a, b) =>
                                new Date(b.created_at).getTime() -
                                new Date(a.created_at).getTime(),
                        )
                        .slice(0, 4),
                )
            } catch (err) {
                console.error('Failed to fetch dashboard data:', err)
                setError('Failed to load dashboard data')
            } finally {
                setLoading(false)
            }
        }

        if (user) {
            fetchDashboardData()
        }
    }, [user])

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    }

    const isDataEmpty = stats.documents === 0 && stats.collections === 0

    const getTimeAgo = (dateString: string) => {
        const date = new Date(dateString)
        const now = new Date()
        const diffMs = now.getTime() - date.getTime()
        const diffMins = Math.floor(diffMs / 60000)
        const diffHours = Math.floor(diffMs / 3600000)
        const diffDays = Math.floor(diffMs / 86400000)

        if (diffMins < 1) return 'Just now'
        if (diffMins < 60) return `${diffMins}m ago`
        if (diffHours < 24) return `${diffHours}h ago`
        if (diffDays < 7) return `${diffDays}d ago`
        return date.toLocaleDateString()
    }

    const getFileIcon = (contentType: string) => {
        if (contentType === 'pdf')
            return {
                icon: FileText,
                color: 'text-rose-600 bg-rose-100',
            }
        if (contentType === 'txt')
            return {
                icon: FileStack,
                color: 'text-blue-600 bg-blue-100',
            }
        if (['png', 'jpg', 'jpeg', 'gif'].includes(contentType))
            return {
                icon: FileText,
                color: 'text-emerald-600 bg-emerald-100',
            }
        return {
            icon: File,
            color: 'text-slate-600 bg-slate-100',
        }
    }

    const StatCard = ({
        icon: Icon,
        label,
        value,
        gradient,
        iconBg,
    }: {
        icon: React.ElementType
        label: string
        value: number
        gradient: string
        iconBg: string
    }) => (
        <Card className="relative overflow-hidden group hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <div className={`absolute inset-0 ${gradient} opacity-5`} />
            <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl ${iconBg} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                    <Icon size={24} className="text-white" />
                </div>
                <div className="flex-1">
                    <p className="text-sm text-slate-500 font-medium">{label}</p>
                    <p className="text-3xl font-bold text-slate-900 mt-1">{value}</p>
                </div>
            </div>
            <div className={`absolute bottom-0 left-0 right-0 h-1 ${gradient.replace('from-', 'bg-').split(' ')[0]} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
        </Card>
    )

    const ActionCard = ({
        icon: Icon,
        title,
        description,
        gradient,
        iconBg,
        onClick,
        hoverEffect,
    }: {
        icon: React.ElementType
        title: string
        description: string
        gradient: string
        iconBg: string
        onClick: () => void
        hoverEffect: string
    }) => (
        <button
            onClick={onClick}
            className="relative overflow-hidden rounded-2xl text-left transition-all duration-300 hover:shadow-xl hover:-translate-y-1 group"
        >
            <div className={`${gradient} p-5`}>
                <div className={`w-12 h-12 rounded-xl ${iconBg} flex items-center justify-center shadow-lg mb-3 group-hover:scale-110 transition-transform duration-300`}>
                    <Icon size={24} className="text-white" />
                </div>
                <h3 className="font-semibold text-white text-lg mb-1">{title}</h3>
                <p className="text-white/70 text-sm">{description}</p>
            </div>
            <div className={`absolute inset-0 ${hoverEffect} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
        </button>
    )

    return (
        <Layout currentPage="dashboard" className="container mx-auto px-6 py-8 max-w-6xl">
            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 flex items-center gap-3">
                    <AlertCircle size={20} />
                    {error}
                </div>
            )}

            {/* Page Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 mb-1">
                        Welcome back, {user?.full_name?.split(' ')[0] || 'User'} 👋
                    </h1>
                    <p className="text-slate-500">Here's what's happening with your knowledge base today.</p>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <StatCard
                    icon={FileStack}
                    label="Total Documents"
                    value={stats.documents}
                    gradient="from-blue-500 to-cyan-500"
                    iconBg="bg-gradient-to-br from-blue-500 to-cyan-500"
                />
                <StatCard
                    icon={CheckCircle}
                    label="Indexed"
                    value={stats.processed}
                    gradient="from-emerald-500 to-green-500"
                    iconBg="bg-gradient-to-br from-emerald-500 to-green-500"
                />
                <StatCard
                    icon={Folder}
                    label="Collections"
                    value={stats.collections}
                    gradient="from-violet-500 to-purple-500"
                    iconBg="bg-gradient-to-br from-violet-500 to-purple-500"
                />
                <StatCard
                    icon={Clock}
                    label="Processing"
                    value={stats.pending}
                    gradient="from-amber-500 to-orange-500"
                    iconBg="bg-gradient-to-br from-amber-500 to-orange-500"
                />
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-32">
                    <div className="text-center">
                        <div className="relative inline-block">
                            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-200 to-fuchsia-200" />
                            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-purple-500 animate-spin" />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Brain size={28} className="text-purple-500" />
                            </div>
                        </div>
                        <p className="mt-4 text-slate-500 font-medium">Loading your dashboard...</p>
                    </div>
                </div>
            ) : isDataEmpty ? (
                <Card className="relative overflow-hidden p-10 text-center max-w-xl mx-auto">
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-50 via-white to-fuchsia-50" />
                    <div className="relative">
                        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-purple-500 to-fuchsia-500 flex items-center justify-center shadow-xl shadow-purple-500/30 animate-float">
                            <Wand2 size={40} className="text-white" />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-900 mb-3">
                            Get Started with Olivia
                        </h2>
                        <p className="text-slate-500 mb-8 max-w-md mx-auto">
                            Upload your first document to build your intelligent knowledge base and start chatting with AI.
                        </p>
                        <div className="flex flex-wrap gap-4 justify-center">
                            <Button
                                variant="primary"
                                onClick={() => navigate('/documents')}
                                icon={<Upload size={20} />}
                                className="shadow-lg shadow-purple-500/30"
                            >
                                Upload Document
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => navigate('/chat')}
                                icon={<MessageCircle size={20} />}
                            >
                                Try Demo Chat
                            </Button>
                        </div>
                    </div>
                </Card>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main Content */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Quick Actions */}
                        <div className="grid grid-cols-2 gap-4">
                            <ActionCard
                                icon={Bot}
                                title="AI Assistant"
                                description="Chat with your documents"
                                gradient="bg-gradient-to-br from-purple-500 via-purple-600 to-fuchsia-600"
                                iconBg="bg-white/20"
                                onClick={() => navigate('/chat')}
                                hoverEffect="bg-gradient-to-br from-white/10 to-transparent"
                            />
                            <ActionCard
                                icon={Upload}
                                title="Upload Files"
                                description="Add documents to your library"
                                gradient="bg-gradient-to-br from-blue-500 via-cyan-500 to-emerald-500"
                                iconBg="bg-white/20"
                                onClick={() => navigate('/documents')}
                                hoverEffect="bg-gradient-to-br from-white/10 to-transparent"
                            />
                        </div>

                        {/* Recent Documents */}
                        <Card className="overflow-hidden">
                            <div className="flex items-center justify-between p-5 border-b border-slate-100">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-100 to-cyan-100 flex items-center justify-center">
                                        <FileText size={20} className="text-blue-600" />
                                    </div>
                                    <div>
                                        <h2 className="font-semibold text-slate-900">Recent Documents</h2>
                                        <p className="text-sm text-slate-500">Your latest uploads</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => navigate('/documents')}
                                    className="text-sm font-medium text-purple-600 hover:text-purple-700 flex items-center gap-1 transition-colors"
                                >
                                    View all <ChevronRight size={16} />
                                </button>
                            </div>
                            <div className="divide-y divide-slate-50">
                                {recentDocuments.length > 0 ? (
                                    recentDocuments.map((doc) => {
                                        const { icon: Icon, color } = getFileIcon(doc.content_type)
                                        return (
                                            <button
                                                key={doc.id}
                                                onClick={() => navigate('/documents')}
                                                className="w-full flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors text-left"
                                            >
                                                <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center flex-shrink-0`}>
                                                    <Icon size={20} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-slate-900 truncate">{doc.filename}</p>
                                                    <p className="text-sm text-slate-500">
                                                        {formatFileSize(doc.size_bytes)} • {getTimeAgo(doc.created_at)}
                                                    </p>
                                                </div>
                                                {doc.processed ? (
                                                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                                                        <CheckCircle size={16} className="text-emerald-600" />
                                                    </div>
                                                ) : (
                                                    <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                                                        <Clock size={16} className="text-amber-600 animate-pulse" />
                                                    </div>
                                                )}
                                            </button>
                                        )
                                    })
                                ) : (
                                    <div className="p-8 text-center text-slate-500">
                                        No documents yet
                                    </div>
                                )}
                            </div>
                        </Card>
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        {/* Collections */}
                        <Card className="overflow-hidden">
                            <div className="flex items-center justify-between p-5 border-b border-slate-100">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center">
                                        <Layers size={20} className="text-violet-600" />
                                    </div>
                                    <h2 className="font-semibold text-slate-900">Collections</h2>
                                </div>
                                <button
                                    onClick={() => navigate('/documents')}
                                    className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600 hover:bg-purple-100 transition-colors"
                                >
                                    <Plus size={18} />
                                </button>
                            </div>
                            <div className="divide-y divide-slate-50">
                                {recentCollections.length > 0 ? (
                                    recentCollections.map((col) => (
                                        <button
                                            key={col.id}
                                            onClick={() => navigate('/documents')}
                                            className="w-full flex items-center gap-3 p-4 hover:bg-slate-50 transition-colors text-left"
                                        >
                                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-purple-500/30">
                                                <Folder size={18} className="text-white" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-slate-900 truncate">{col.name}</p>
                                                <p className="text-sm text-slate-500">{col.document_count || 0} documents</p>
                                            </div>
                                            <ChevronRight size={18} className="text-slate-400" />
                                        </button>
                                    ))
                                ) : (
                                    <div className="p-6 text-center text-slate-500">
                                        No collections yet
                                    </div>
                                )}
                            </div>
                        </Card>

                        {/* Processing Status */}
                        {stats.pending > 0 && (
                            <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-amber-100">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
                                        <Activity size={20} className="text-white" />
                                    </div>
                                    <div>
                                        <p className="font-semibold text-slate-900">Processing</p>
                                        <p className="text-sm text-slate-500">{stats.pending} document{stats.pending > 1 ? 's' : ''}</p>
                                    </div>
                                </div>
                                <div className="flex gap-1">
                                    {[1, 2, 3, 4, 5].map((i) => (
                                        <div
                                            key={i}
                                            className="h-2 flex-1 bg-gradient-to-r from-amber-300 to-orange-400 rounded-full animate-bounce"
                                            style={{ animationDelay: `${i * 0.1}s` }}
                                        />
                                    ))}
                                </div>
                            </Card>
                        )}

                        {/* Quick Tips */}
                        <Card className="bg-gradient-to-br from-slate-900 to-slate-800 text-white overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-500/20 to-transparent rounded-full -mr-16 -mt-16" />
                            <div className="relative">
                                <div className="flex items-center gap-2 mb-4">
                                    <Sparkles size={18} className="text-amber-400" />
                                    <h3 className="font-semibold">Quick Tips</h3>
                                </div>
                                <ul className="space-y-3">
                                    <li className="flex items-start gap-3">
                                        <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                                            <span className="text-xs font-bold text-purple-300">1</span>
                                        </div>
                                        <span className="text-sm text-slate-300">Upload PDFs for best search results</span>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                                            <span className="text-xs font-bold text-purple-300">2</span>
                                        </div>
                                        <span className="text-sm text-slate-300">Create collections to organize by topic</span>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                                            <span className="text-xs font-bold text-purple-300">3</span>
                                        </div>
                                        <span className="text-sm text-slate-300">Ask specific questions for better answers</span>
                                    </li>
                                </ul>
                            </div>
                        </Card>
                    </div>
                </div>
            )}
        </Layout>
    )
}

export default Dashboard
