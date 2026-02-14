import { useState } from 'react'
import Card from '../components/ui/Card'
import AuthModal from '../components/ui/AuthModal'
import {
    Database,
    Brain,
    Layers,
    Shield,
    Zap,
    Search,
    ChevronRight,
    Computer,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const Landing = () => {
    const [isAuthOpen, setIsAuthOpen] = useState(false)
    const { isAuthenticated } = useAuth()
    const navigate = useNavigate()

    const handleGetStarted = () => {
        if (isAuthenticated) {
            navigate('/dashboard')
        } else {
            setIsAuthOpen(true)
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 font-sans overflow-x-hidden relative">
            {/* Navigation */}
            <header className="fixed top-0 inset-x-0 z-50 p-4">
                <div className="container mx-auto">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
                                <Brain className="text-white" size={18} />
                            </div>
                            <span className="text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                                Olivia
                            </span>
                        </div>

                        <div className="flex items-center gap-4">
                            {!isAuthenticated ? (
                                <>
                                    <button
                                        onClick={() => setIsAuthOpen(true)}
                                        className="text-sm font-medium text-slate-600 hover:text-purple-600 transition-colors"
                                    >
                                        Sign In
                                    </button>
                                    <button
                                        onClick={() => setIsAuthOpen(true)}
                                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
                                    >
                                        Get Started
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={() => navigate('/dashboard')}
                                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
                                >
                                    Go to Dashboard
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            {/* Hero Section */}
            <section className="relative pt-20 md:pt-24 lg:pt-32 pb-12 md:pb-16 lg:pb-20 px-4">
                <div className="container mx-auto text-center max-w-4xl relative z-10">
                    <div className="inline-flex items-center gap-2 px-2 md:px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs md:text-sm font-medium mb-4 md:mb-6 lg:mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                        Private Local RAG Stack
                    </div>

                    <h1 className="text-2xl md:text-4xl lg:text-6xl xl:text-7xl font-bold tracking-tight mb-4 md:mb-6 lg:mb-8 leading-tight animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
                        Chat with your Data, <br />
                        <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                            Completely Private.
                        </span>
                    </h1>

                    <p className="text-sm md:text-base lg:text-xl text-muted-foreground mb-6 md:mb-8 lg:mb-10 max-w-2xl mx-auto leading-relaxed animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
                        Leverage the power of <b>Ollama</b> LLMs, <b>Milvus</b>{' '}
                        vector storage, and <b>LangChain</b> orchestration to
                        build a secure, local knowledge base.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-2 md:gap-3 lg:gap-4 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300">
                        <button
                            onClick={handleGetStarted}
                            className="flex items-center justify-center px-4 md:px-6 lg:px-8 py-2 md:py-3 lg:py-4 bg-purple-600 hover:bg-purple-700 text-white shadow-xl hover:shadow-2xl transition-all duration-300 border-0 rounded-lg text-sm md:text-base lg:text-lg font-semibold w-full sm:w-auto"
                        >
                            Start Building Free
                            <ChevronRight className="ml-2 w-4 h-4" />
                        </button>
                        <button className="flex items-center justify-center px-6 md:px-8 py-3 md:py-4 bg-orange-500 hover:bg-orange-600 text-white shadow-lg hover:shadow-xl transition-all duration-300 border-0 rounded-lg text-base md:text-lg font-semibold w-full sm:w-auto">
                            <Computer className="mr-2 w-4 h-4" />
                            View on GitHub
                        </button>
                    </div>
                </div>

                {/* Ambient Background Elements */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] md:w-[800px] h-[600px] md:h-[800px] bg-primary/20 rounded-full blur-[80px] md:blur-[120px] -z-10 pointer-events-none opacity-50 mix-blend-screen" />
            </section>

            {/* Tech Stack Grid */}
            <section className="py-16 md:py-20 px-4">
                <div className="container mx-auto">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                        <Card
                            variant="elevated"
                            className="hover:border-purple-400/50 group bg-gradient-to-br from-purple-50 to-purple-100/50 hover:from-purple-100 hover:to-purple-200/50 transition-all duration-300 border-2 hover:border-purple-300 p-4 md:p-6"
                        >
                            <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-gradient-to-r from-purple-500 to-purple-600 flex items-center justify-center mb-4 border-2 border-white shadow-lg">
                                <Brain className="text-white" size={20} />
                            </div>
                            <h3 className="text-lg md:text-xl font-bold mb-2 bg-gradient-to-r from-purple-700 to-purple-800 bg-clip-text text-transparent">
                                Ollama Powered
                            </h3>
                            <p className="text-purple-700/80 text-sm md:text-base">
                                Run Llama 3, Mistral, and other open-source
                                models locally without sending data to the
                                cloud.
                            </p>
                        </Card>

                        <Card
                            variant="elevated"
                            className="hover:border-blue-400/50 group bg-gradient-to-br from-blue-50 to-blue-100/50 hover:from-blue-100 hover:to-blue-200/50 transition-all duration-300 border-2 hover:border-blue-300 p-4 md:p-6"
                        >
                            <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center mb-4 border-2 border-white shadow-lg">
                                <Database className="text-white" size={20} />
                            </div>
                            <h3 className="text-lg md:text-xl font-bold mb-2 bg-gradient-to-r from-blue-700 to-blue-800 bg-clip-text text-transparent">
                                Milvus Vector DB
                            </h3>
                            <p className="text-blue-700/80 text-sm md:text-base">
                                High-performance vector database built for
                                scale. Store millions of embeddings efficiently.
                            </p>
                        </Card>

                        <Card
                            variant="elevated"
                            className="hover:border-cyan-400/50 group bg-gradient-to-br from-cyan-50 to-cyan-100/50 hover:from-cyan-100 hover:to-cyan-200/50 transition-all duration-300 border-2 hover:border-cyan-300 p-4 md:p-6"
                        >
                            <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-600 flex items-center justify-center mb-4 border-2 border-white shadow-lg">
                                <Layers className="text-white" size={20} />
                            </div>
                            <h3 className="text-lg md:text-xl font-bold mb-2 bg-gradient-to-r from-cyan-700 to-cyan-800 bg-clip-text text-transparent">
                                LangChain Orchestration
                            </h3>
                            <p className="text-cyan-700/80 text-sm md:text-base">
                                Advanced chain management, memory integration,
                                and document processing pipeline.
                            </p>
                        </Card>
                    </div>
                </div>
            </section>

            {/* Feature Section */}
            <section className="py-16 md:py-20 px-4 relative">
                <div className="container mx-auto max-w-5xl">
                    <div className="text-center mb-12 md:mb-16">
                        <h2 className="text-2xl md:text-3xl lg:text-5xl font-bold mb-4 md:mb-6 text-foreground">
                            Why Choose Local RAG?
                        </h2>
                        <p className="text-muted-foreground max-w-2xl mx-auto text-sm md:text-base">
                            Stop sending sensitive documents to external APIs.
                            Keep your knowledge base secure and sovereign.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12 text-left">
                        <div className="space-y-6 md:space-y-8">
                            <div className="flex gap-4">
                                <div className="mt-1 w-8 h-8 md:w-10 md:h-10 rounded-lg bg-gradient-to-r from-emerald-400 to-green-500 flex items-center justify-center shrink-0 shadow-lg border-2 border-white">
                                    <Shield className="text-white" size={16} />
                                </div>
                                <div>
                                    <h4 className="text-lg md:text-xl font-semibold mb-2 bg-gradient-to-r from-emerald-700 to-green-800 bg-clip-text text-transparent">
                                        Enterprise Grade Security
                                    </h4>
                                    <p className="text-emerald-700/80 text-sm md:text-base">
                                        Your data never leaves your
                                        infrastructure. Full compliance with
                                        strict privacy regulations.
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <div className="mt-1 w-8 h-8 md:w-10 md:h-10 rounded-lg bg-gradient-to-r from-orange-400 to-red-500 flex items-center justify-center shrink-0 shadow-lg border-2 border-white">
                                    <Zap className="text-white" size={16} />
                                </div>
                                <div>
                                    <h4 className="text-lg md:text-xl font-semibold mb-2 bg-gradient-to-r from-orange-700 to-red-800 bg-clip-text text-transparent">
                                        Low Latency Retrieval
                                    </h4>
                                    <p className="text-orange-700/80 text-sm md:text-base">
                                        Milvus optimized indexing provides
                                        millisecond retrieval times for instant
                                        answers.
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <div className="mt-1 w-8 h-8 md:w-10 md:h-10 rounded-lg bg-gradient-to-r from-indigo-400 to-purple-500 flex items-center justify-center shrink-0 shadow-lg border-2 border-white">
                                    <Search className="text-white" size={16} />
                                </div>
                                <div>
                                    <h4 className="text-lg md:text-xl font-semibold mb-2 bg-gradient-to-r from-indigo-700 to-purple-800 bg-clip-text text-transparent">
                                        Semantic Search
                                    </h4>
                                    <p className="text-indigo-700/80 text-sm md:text-base">
                                        Understand context beyond keywords using
                                        advanced embedding models.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="relative">
                            <div className="absolute inset-0 gradient-primary/20 rounded-3xl blur-2xl" />
                            <div className="relative h-full card-elevated border-purple-200 rounded-3xl p-8 flex flex-col gap-4 bg-gradient-to-br from-purple-50/50 to-pink-50/50">
                                {/* Chat Interface Mockup */}
                                <div className="flex items-start gap-4">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center text-xs font-bold text-white shadow-lg">
                                        AI
                                    </div>
                                    <div className="bg-white border-2 border-purple-200 rounded-2xl rounded-tl-sm p-4 text-sm text-purple-800 shadow-md">
                                        Based on your documents, the
                                        implementation of Milvus requires Docker
                                        Compose. Here is the configuration...
                                    </div>
                                </div>
                                <div className="flex items-start gap-4 flex-row-reverse mt-4">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-pink-500 flex items-center justify-center text-xs font-bold text-white shadow-lg">
                                        U
                                    </div>
                                    <div className="bg-white border-2 border-blue-200 rounded-2xl rounded-tr-sm p-4 text-sm text-blue-800 shadow-md">
                                        How do I scale the vector database?
                                    </div>
                                </div>
                                <div className="flex items-start gap-4 mt-4">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center text-xs font-bold text-white shadow-lg">
                                        AI
                                    </div>
                                    <div className="bg-white border-2 border-purple-200 rounded-2xl rounded-tl-sm p-4 text-sm text-purple-800 shadow-md">
                                        Milvus supports horizontal scaling by
                                        separating storage and compute nodes...
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t-2 border-purple-200 bg-gradient-to-r from-purple-50/50 to-pink-50/50 py-6 mt-8 md:mt-12 backdrop-blur-sm">
                <div className="container mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-5 h-5 md:w-6 md:h-6 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center border-2 border-white shadow-lg">
                            <Brain className="text-white" size={14} />
                        </div>
                        <span className="text-sm md:text-base font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                            Olivia AI
                        </span>
                    </div>

                    <div className="flex gap-4 md:gap-6 text-xs">
                        <a
                            href="#"
                            className="text-purple-700 hover:text-cyan-600 transition-colors font-medium hover:underline"
                        >
                            Documentation
                        </a>
                        <a
                            href="#"
                            className="text-purple-700 hover:text-cyan-600 transition-colors font-medium hover:underline"
                        >
                            Privacy
                        </a>
                        <a
                            href="#"
                            className="text-purple-700 hover:text-pink-600 transition-colors font-medium hover:underline"
                        >
                            Terms
                        </a>
                    </div>

                    <div className="text-xs text-purple-700 font-medium text-center md:text-right">
                        &copy; 2025 Olivia AI RAG System
                    </div>
                </div>
            </footer>

            {/* Auth Modal */}
            <AuthModal
                isOpen={isAuthOpen}
                onClose={() => setIsAuthOpen(false)}
            />
        </div>
    )
}

export default Landing
