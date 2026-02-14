import React, { useState, useRef, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Brain, MessageSquare, FileText, Settings, User, LogOut, ChevronDown, Sparkles, Menu, X } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

interface LayoutProps {
    children: React.ReactNode
    currentPage?: 'dashboard' | 'documents' | 'chat' | 'profile'
    className?: string
}

const Layout: React.FC<LayoutProps> = ({ children, className = '' }) => {
    const location = useLocation()
    const { user, logout } = useAuth()
    const [showUserMenu, setShowUserMenu] = useState(false)
    const [showMobileMenu, setShowMobileMenu] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)
    const mobileMenuRef = useRef<HTMLDivElement>(null)

    const navItems = [
        { id: 'dashboard', label: 'Dashboard', href: '/dashboard', icon: Sparkles },
        { id: 'documents', label: 'Documents', href: '/documents', icon: FileText },
        { id: 'chat', label: 'Chat', href: '/chat', icon: MessageSquare },
    ]

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowUserMenu(false)
            }
            if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node)) {
                setShowMobileMenu(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const isActive = (path: string) => location.pathname === path

    return (
        <div className="min-h-screen bg-slate-50">
            <header className="fixed top-0 left-0 right-0 h-16 bg-white/80 backdrop-blur-xl border-b border-slate-200/50 z-50">
                <div className="h-full px-4 md:px-6 lg:px-8 max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4 lg:gap-8">
                        <Link to="/dashboard" className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 via-fuchsia-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/30">
                                <Brain className="w-5 h-5 text-white" />
                            </div>
                            <span className="text-xl font-bold bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 bg-clip-text text-transparent hidden sm:block">
                                Olivia
                            </span>
                        </Link>

                        <nav className="hidden md:flex items-center gap-1 h-16">
                            {navItems.map((item) => {
                                const Icon = item.icon
                                const active = isActive(item.href)
                                return (
                                    <Link
                                        key={item.id}
                                        to={item.href}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                                            active
                                                ? 'bg-gradient-to-r from-purple-500/10 to-pink-500/10 text-purple-700 shadow-sm'
                                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                                        }`}
                                    >
                                        <Icon className={`w-4 h-4 ${active ? 'text-purple-500' : ''}`} />
                                        {item.label}
                                    </Link>
                                )
                            })}
                        </nav>
                    </div>

                    <div className="flex items-center gap-2 md:gap-4">
                        <div className="relative" ref={dropdownRef}>
                            <button
                                onClick={() => setShowUserMenu(!showUserMenu)}
                                className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                            >
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-sm font-semibold text-white shadow-md">
                                    {user?.full_name?.charAt(0).toUpperCase() || 'U'}
                                </div>
                                <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform hidden sm:block ${showUserMenu ? 'rotate-180' : ''}`} />
                            </button>

                            {showUserMenu && (
                                <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200/50 py-2 z-50 overflow-hidden">
                                    <div className="px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-purple-50/50 to-pink-50/50">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-semibold shadow-lg">
                                                {user?.full_name?.charAt(0).toUpperCase() || 'U'}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-slate-800 truncate">{user?.full_name || 'User'}</p>
                                                <p className="text-xs text-slate-500 truncate">{user?.email || 'user@example.com'}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="py-2">
                                        <Link
                                            to="/profile"
                                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-gradient-to-r hover:from-purple-50/50 hover:to-pink-50/50 hover:text-purple-700 transition-all"
                                            onClick={() => setShowUserMenu(false)}
                                        >
                                            <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                                                <User className="w-4 h-4 text-purple-600" />
                                            </div>
                                            Profile
                                        </Link>
                                        <Link
                                            to="/settings"
                                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-gradient-to-r hover:from-purple-50/50 hover:to-pink-50/50 hover:text-purple-700 transition-all"
                                            onClick={() => setShowUserMenu(false)}
                                        >
                                            <div className="w-8 h-8 rounded-lg bg-pink-100 flex items-center justify-center">
                                                <Settings className="w-4 h-4 text-pink-600" />
                                            </div>
                                            Settings
                                        </Link>
                                    </div>
                                    <div className="border-t border-slate-100 pt-2">
                                        <button
                                            onClick={() => {
                                                logout()
                                                setShowUserMenu(false)
                                            }}
                                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors w-full"
                                        >
                                            <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                                                <LogOut className="w-4 h-4 text-red-600" />
                                            </div>
                                            Sign Out
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <button
                            className="md:hidden p-2 rounded-lg hover:bg-slate-100 transition-colors"
                            onClick={() => setShowMobileMenu(!showMobileMenu)}
                        >
                            {showMobileMenu ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                        </button>
                    </div>
                </div>

                {showMobileMenu && (
                    <div ref={mobileMenuRef} className="md:hidden absolute top-full left-0 right-0 bg-white border-b border-slate-200 shadow-xl z-40">
                        <nav className="px-4 py-4 space-y-2">
                            {navItems.map((item) => {
                                const Icon = item.icon
                                const active = isActive(item.href)
                                return (
                                    <Link
                                        key={item.id}
                                        to={item.href}
                                        className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                                            active
                                                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg'
                                                : 'text-slate-600 hover:bg-slate-100'
                                        }`}
                                        onClick={() => setShowMobileMenu(false)}
                                    >
                                        <Icon className="w-5 h-5" />
                                        {item.label}
                                    </Link>
                                )
                            })}
                        </nav>
                    </div>
                )}
            </header>

            <main className={`pt-16 ${className}`}>
                {children}
            </main>
        </div>
    )
}

export default Layout
