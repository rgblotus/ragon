// Chat header component for better code organization
import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import Button from '../ui/Button'
import {
    Brain,
    Database,
    User,
    Settings,
    ChevronDown,
    PanelLeft,
    PanelRight,
    LogOut,
    Home,
} from 'lucide-react'

interface ChatHeaderProps {
    userEmail: string
    onToggleLeftPanel: () => void
    onToggleRightPanel: () => void
    isLeftCollapsed: boolean
    isRightCollapsed: boolean
}

const ChatHeader: React.FC<ChatHeaderProps> = ({
    userEmail,
    onToggleLeftPanel,
    onToggleRightPanel,
    isLeftCollapsed,
    isRightCollapsed,
}) => {
    const navigate = useNavigate()
    const { user, logout } = useAuth()
    const [showDropdown, setShowDropdown] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node)
            ) {
                setShowDropdown(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () =>
            document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    return (
        <header className="h-12 md:h-14 lg:h-16 border-b border-slate-200 bg-white flex items-center justify-between px-1 md:px-2 lg:px-4 shrink-0 z-50">
            <div className="flex items-center gap-2 md:gap-3">
                <button
                    onClick={onToggleLeftPanel}
                    className="p-2 hover:bg-slate-100 rounded-lg transition-all text-slate-600 hover:text-slate-900"
                    aria-label="Toggle left panel"
                >
                    {isLeftCollapsed ? (
                        <PanelRight size={18} />
                    ) : (
                        <PanelLeft size={18} />
                    )}
                </button>
                <div
                    className="flex items-center gap-2 md:gap-3 cursor-pointer"
                    onClick={() => navigate('/dashboard')}
                >
                    <div className="w-7 h-7 md:w-8 md:h-8 lg:w-9 lg:h-9 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                        <Brain className="text-white" size={16} />
                    </div>
                    <span className="text-base md:text-lg font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent hidden sm:inline">
                        Olivia
                    </span>
                </div>
            </div>

            <div className="flex items-center gap-1 md:gap-2 lg:gap-4">
                {/* Home Icon */}
                <button
                    onClick={() => navigate('/dashboard')}
                    className="p-2 hover:bg-slate-100 rounded-lg transition-all text-slate-600 hover:text-slate-900"
                    aria-label="Home"
                >
                    <Home size={18} />
                </button>

                {/* Documents Button */}
                <Button
                    variant="secondary"
                    onClick={() => navigate('/documents')}
                    className="hidden md:flex items-center gap-2 h-9 px-4 text-xs bg-slate-100 hover:bg-slate-200 border-slate-200 transition-all text-slate-700"
                >
                    <Database size={14} />
                    Documents
                </Button>

                {/* Divider */}
                <div className="h-8 w-px bg-slate-200 mx-1 hidden md:block" />

                {/* User Profile with Dropdown */}
                <div className="relative shrink-0" ref={dropdownRef}>
                    <button
                        onClick={() => setShowDropdown(!showDropdown)}
                        className="flex items-center gap-2 md:gap-3 px-2 md:px-3 py-1.5 bg-slate-50 hover:bg-slate-100 rounded-full border border-slate-200 cursor-pointer transition-all group shrink-0"
                    >
                        <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center text-[9px] md:text-[10px] font-bold text-white shadow-lg">
                            {userEmail[0].toUpperCase()}
                        </div>
                        <span className="text-sm text-slate-700 max-w-[80px] md:max-w-[120px] truncate hidden sm:inline">
                            {user?.full_name || userEmail}
                        </span>
                        <ChevronDown
                            size={12}
                            className={`text-slate-500 group-hover:text-slate-700 transition-all ${
                                showDropdown ? 'rotate-180' : ''
                            }`}
                        />
                    </button>

                    {/* Dropdown Menu */}
                    {showDropdown && (
                        <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-lg border border-slate-200 z-[9999] overflow-hidden">
                            <div className="p-3 border-b border-slate-100">
                                <p className="text-xs font-bold text-slate-800 truncate">
                                    {user?.full_name || 'User'}
                                </p>
                                <p className="text-[10px] text-slate-500 truncate">
                                    {userEmail}
                                </p>
                            </div>
                            <div className="py-2">
                                <button
                                    onClick={() => {
                                        navigate('/profile')
                                        setShowDropdown(false)
                                    }}
                                    className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 transition-all flex items-center gap-3"
                                >
                                    <User size={16} />
                                    Profile
                                </button>
                                <button
                                    onClick={() => {
                                        setShowDropdown(false)
                                    }}
                                    className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 transition-all flex items-center gap-3"
                                >
                                    <Settings size={16} />
                                    Settings
                                </button>
                                <div className="border-t border-slate-100 my-2" />
                                <button
                                    onClick={() => {
                                        logout()
                                        setShowDropdown(false)
                                    }}
                                    className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-3"
                                >
                                    <LogOut size={16} />
                                    Sign Out
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Panel Toggle */}
                <button
                    onClick={onToggleRightPanel}
                    className="p-2 hover:bg-slate-100 rounded-lg transition-all text-slate-600 hover:text-slate-900"
                    aria-label="Toggle right panel"
                >
                    {isRightCollapsed ? (
                        <PanelLeft size={18} />
                    ) : (
                        <PanelRight size={18} />
                    )}
                </button>
            </div>
        </header>
    )
}

export default ChatHeader
