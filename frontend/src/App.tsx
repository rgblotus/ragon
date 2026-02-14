// Modernized App component with ErrorBoundary and consistent routing
import React, { Suspense, lazy } from 'react'
import {
    BrowserRouter as Router,
    Routes,
    Route,
    Navigate,
} from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ProgressProvider } from './contexts/ProgressContext'
import ErrorBoundary from './components/ui/ErrorBoundary'

// Lazy load page components
const Landing = lazy(() => import('./pages/Landing'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Profile = lazy(() => import('./pages/Profile'))
const Documents = lazy(() => import('./pages/Documents'))
const Chat = lazy(() => import('./pages/Chat'))
const DebugRAG = lazy(() => import('./pages/DebugRAG'))

// Loading component for Suspense
const PageLoader = () => (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
            <div className="w-12 h-12 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-600 italic animate-pulse">Loading experience...</p>
        </div>
    </div>
)

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    const { isAuthenticated, isLoading } = useAuth()

    // Show loading while checking authentication
    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-600">Checking authentication...</p>
                </div>
            </div>
        )
    }

    // Redirect to landing if not authenticated
    if (!isAuthenticated) {
        return <Navigate to="/" replace />
    }

    return <>{children}</>
}

function App() {
    return (
        <ErrorBoundary>
            <Router>
                <AuthProvider>
                    <ProgressProvider>
                        <Suspense fallback={<PageLoader />}>
                            <Routes>
                                {/* Public Routes */}
                                <Route path="/" element={<Landing />} />

                                {/* Protected Routes */}
                                <Route
                                    path="/dashboard"
                                    element={
                                        <ProtectedRoute>
                                            <Dashboard />
                                        </ProtectedRoute>
                                    }
                                />
                                <Route
                                    path="/profile"
                                    element={
                                        <ProtectedRoute>
                                            <Profile />
                                        </ProtectedRoute>
                                    }
                                />
                                <Route
                                    path="/documents"
                                    element={
                                        <ProtectedRoute>
                                            <Documents />
                                        </ProtectedRoute>
                                    }
                                />
                                <Route
                                    path="/chat"
                                    element={
                                        <ProtectedRoute>
                                            <Chat />
                                        </ProtectedRoute>
                                    }
                                />
                                <Route
                                    path="/debug"
                                    element={
                                        <ProtectedRoute>
                                            <DebugRAG />
                                        </ProtectedRoute>
                                    }
                                />

                                {/* Catch-all redirect */}
                                <Route
                                    path="*"
                                    element={<Navigate to="/" replace />}
                                />
                            </Routes>
                        </Suspense>
                    </ProgressProvider>
                </AuthProvider>
            </Router>
        </ErrorBoundary>
    )
}

export default App
