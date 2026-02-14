import { useState, useEffect } from 'react'
import { ragApi } from '../services/api'
import Layout from '../components/layout/Layout'
import { Search, Database, FileText, AlertCircle, CheckCircle, Loader2, RefreshCw } from 'lucide-react'

const DebugRAG = () => {
    const [loading, setLoading] = useState(false)
    const [debugData, setDebugData] = useState<any>(null)
    const [error, setError] = useState<string | null>(null)
    const [collectionId, setCollectionId] = useState<string>('')
    const [testQuery, setTestQuery] = useState('Arjuna')

    const runDebug = async () => {
        setLoading(true)
        setError(null)
        try {
            const data = await ragApi.debugDocuments(collectionId ? parseInt(collectionId) : undefined)
            setDebugData(data)
        } catch (err: any) {
            setError(err.message || 'Failed to run debug')
        } finally {
            setLoading(false)
        }
    }

    return (
        <Layout className="container mx-auto px-4 pb-8 max-w-6xl">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-slate-900 mb-2">RAG Debug Tool</h1>
                <p className="text-slate-600">Diagnose why document queries aren't returning results</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                        <div className="flex flex-col sm:flex-row gap-4 mb-6">
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Collection ID (optional)
                                </label>
                                <input
                                    type="text"
                                    value={collectionId}
                                    onChange={(e) => setCollectionId(e.target.value)}
                                    placeholder="Leave empty for all collections"
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                />
                            </div>
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Test Query
                                </label>
                                <input
                                    type="text"
                                    value={testQuery}
                                    onChange={(e) => setTestQuery(e.target.value)}
                                    placeholder="Search term"
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                />
                            </div>
                            <div className="flex items-end">
                                <button
                                    onClick={runDebug}
                                    disabled={loading}
                                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                                >
                                    {loading ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />}
                                    Run Debug
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-2">
                                <AlertCircle size={20} />
                                {error}
                            </div>
                        )}

                        {debugData && (
                            <div className="space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-slate-50 rounded-lg p-4">
                                        <div className="text-sm text-slate-500 mb-1">Total Docs in Store</div>
                                        <div className="text-2xl font-bold text-slate-900">
                                            {debugData.total_docs_in_store || 0}
                                        </div>
                                    </div>
                                    <div className="bg-slate-50 rounded-lg p-4">
                                        <div className="text-sm text-slate-500 mb-1">Arjuna Search Results</div>
                                        <div className="text-2xl font-bold text-slate-900">
                                            {debugData.arjuna_search_results || 0}
                                        </div>
                                    </div>
                                </div>

                                {debugData.docs_for_user_collection !== undefined && (
                                    <div className={`p-4 rounded-lg border ${
                                        debugData.docs_for_user_collection > 0 
                                            ? 'bg-green-50 border-green-200' 
                                            : 'bg-red-50 border-red-200'
                                    }`}>
                                        <div className="flex items-center gap-2 mb-2">
                                            {debugData.docs_for_user_collection > 0 ? (
                                                <CheckCircle size={20} className="text-green-600" />
                                            ) : (
                                                <AlertCircle size={20} className="text-red-600" />
                                            )}
                                            <span className={`font-medium ${
                                                debugData.docs_for_user_collection > 0 
                                                    ? 'text-green-800' 
                                                    : 'text-red-800'
                                            }`}>
                                                Docs for User/Collection: {debugData.docs_for_user_collection}
                                            </span>
                                        </div>
                                        {debugData.docs_for_user_collection === 0 && (
                                            <p className="text-sm text-red-700">
                                                No documents found for this user and collection. 
                                                This means the vector store doesn't have your documents, 
                                                or they're stored under different user_id/collection_id.
                                            </p>
                                        )}
                                    </div>
                                )}

                                {debugData.sample_docs && debugData.sample_docs.length > 0 && (
                                    <div>
                                        <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                                            <Database size={18} />
                                            Sample Documents in Store
                                        </h3>
                                        <div className="space-y-3">
                                            {debugData.sample_docs.map((doc: any, i: number) => (
                                                <div key={i} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="font-medium text-slate-900 flex items-center gap-2">
                                                            <FileText size={16} />
                                                            {doc.source}
                                                        </span>
                                                        <span className="text-xs bg-slate-200 px-2 py-1 rounded">
                                                            score: {doc.score?.toFixed(3) || 'N/A'}
                                                        </span>
                                                    </div>
                                                    <div className="text-xs text-slate-500 mb-2">
                                                        user_id: {doc.user_id} | collection_id: {doc.collection_id}
                                                    </div>
                                                    <div className="text-sm text-slate-600 italic">
                                                        "{doc.content_preview}..."
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {debugData.arjuna_samples && debugData.arjuna_samples.length > 0 && (
                                    <div>
                                        <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                                            <Search size={18} />
                                            "Arjuna" Search Results
                                        </h3>
                                        <div className="space-y-3">
                                            {debugData.arjuna_samples.map((doc: any, i: number) => (
                                                <div key={i} className={`rounded-lg p-4 border ${
                                                    doc.user_id === debugData.user_id && doc.collection_id == collectionId
                                                        ? 'bg-green-50 border-green-200'
                                                        : 'bg-slate-50 border-slate-200'
                                                }`}>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="font-medium text-slate-900 flex items-center gap-2">
                                                            <FileText size={16} />
                                                            {doc.source}
                                                        </span>
                                                        <span className="text-xs bg-slate-200 px-2 py-1 rounded">
                                                            score: {doc.score?.toFixed(3) || 'N/A'}
                                                        </span>
                                                    </div>
                                                    <div className="text-xs text-slate-500 mb-2">
                                                        user_id: {doc.user_id} | collection_id: {doc.collection_id}
                                                        {doc.user_id === debugData.user_id && doc.collection_id == collectionId && (
                                                            <span className="ml-2 text-green-600 font-medium">✓ MATCH</span>
                                                        )}
                                                    </div>
                                                    <div className="text-sm text-slate-600 italic">
                                                        "{doc.content_preview}..."
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {debugData.error_fetching_docs && (
                                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                                        <div className="text-red-800 font-medium mb-1">Error Fetching Docs</div>
                                        <div className="text-sm text-red-600">{debugData.error_fetching_docs}</div>
                                    </div>
                                )}

                                {debugData.error_searching_arjuna && (
                                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                                        <div className="text-red-800 font-medium mb-1">Error Searching Arjuna</div>
                                        <div className="text-sm text-red-600">{debugData.error_searching_arjuna}</div>
                                    </div>
                                )}
                            </div>
                        )}

                        {!loading && !debugData && !error && (
                            <div className="text-center py-12 text-slate-500">
                                <Database size={48} className="mx-auto mb-4 text-slate-300" />
                                <p>Click "Run Debug" to check what's in the vector store</p>
                            </div>
                        )}
                    </div>
                </div>

                <div>
                    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                        <h3 className="font-semibold text-slate-900 mb-4">Troubleshooting Steps</h3>
                        <div className="space-y-4 text-sm">
                            <div className="flex gap-3">
                                <span className="flex-shrink-0 w-6 h-6 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center font-medium">1</span>
                                <div>
                                    <p className="font-medium text-slate-900">Check Total Docs</p>
                                    <p className="text-slate-600">If 0, documents weren't embedded properly</p>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <span className="flex-shrink-0 w-6 h-6 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center font-medium">2</span>
                                <div>
                                    <p className="font-medium text-slate-900">Check User/Collection Match</p>
                                    <p className="text-slate-600">Docs must have matching user_id and collection_id</p>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <span className="flex-shrink-0 w-6 h-6 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center font-medium">3</span>
                                <div>
                                    <p className="font-medium text-slate-900">Check "Arjuna" Results</p>
                                    <p className="text-slate-600">If empty, embeddings don't contain your content</p>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <span className="flex-shrink-0 w-6 h-6 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center font-medium">4</span>
                                <div>
                                    <p className="font-medium text-slate-900">Milvus Running?</p>
                                    <p className="text-slate-600">Ensure Milvus is accessible at {debugData?.milvus_host || 'localhost'}:{debugData?.milvus_port || '19530'}</p>
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 pt-6 border-t border-slate-200">
                            <h4 className="font-medium text-slate-900 mb-3">Quick Actions</h4>
                            <div className="space-y-2">
                                <button 
                                    onClick={() => {
                                        setCollectionId('')
                                        runDebug()
                                    }}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                                >
                                    <RefreshCw size={16} />
                                    Refresh All Collections
                                </button>
                                <a 
                                    href="/documents"
                                    className="block w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors"
                                >
                                    <FileText size={16} />
                                    Go to Documents Page
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    )
}

export default DebugRAG
