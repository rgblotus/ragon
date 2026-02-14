import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import {
    User,
    Lock,
    Save,
    Loader2,
    Settings,
    Calendar,
    Shield,
    CheckCircle,
    XCircle,
    Camera,
    Sparkles,
    Bell,
    Moon,
    Sun,
    Edit3,
    Award,
    Activity,
    FileText,
    Database,
    CheckCheck,
    Mail,
    AtSign,
    Eye,
    EyeOff,
} from 'lucide-react'
import Layout from '../components/layout/Layout'

const Profile = () => {
    const { user, updateUser } = useAuth()

    const [fullName, setFullName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [currentPassword, setCurrentPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState<{
        type: 'success' | 'error'
        text: string
    } | null>(null)

    const [darkMode, setDarkMode] = useState(false)
    const [notifications, setNotifications] = useState(true)
    const [emailUpdates, setEmailUpdates] = useState(true)
    const [showPassword, setShowPassword] = useState(false)
    const [showCurrentPassword, setShowCurrentPassword] = useState(false)
    const [isEditingName, setIsEditingName] = useState(false)
    const [isEditingEmail, setIsEditingEmail] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (user) {
            setFullName(user.full_name || '')
            setEmail(user.email || '')
        }
    }, [user])

    const handleSubmit = async () => {
        setLoading(true)
        setMessage(null)
        try {
            const data: Record<string, string> = {}
            if (fullName !== user?.full_name) data.full_name = fullName
            if (email !== user?.email) data.email = email
            if (password) data.password = password
            if (Object.keys(data).length === 0) {
                setLoading(false)
                return
            }
            await updateUser(data)
            setMessage({ type: 'success', text: 'Profile updated successfully!' })
            setPassword('')
            setCurrentPassword('')
            setIsEditingName(false)
            setIsEditingEmail(false)
        } catch (error: unknown) {
            const errorMsg =
                (error as { response?: { data?: { detail?: string } } })
                    ?.response?.data?.detail || 'Failed to update profile.'
            setMessage({ type: 'error', text: errorMsg })
        } finally {
            setLoading(false)
        }
    }

    const hasChanges = () => {
        return fullName !== user?.full_name || 
               email !== user?.email || 
               (password && currentPassword)
    }

    const getInitials = (name: string) => {
        if (!name) return 'U'
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    }

    const getMemberDuration = () => {
        if (!user?.created_at) return 'N/A'
        const created = new Date(user.created_at)
        const now = new Date()
        const diffTime = Math.abs(now.getTime() - created.getTime())
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
        if (diffDays < 30) return `${diffDays} days`
        if (diffDays < 365) return `${Math.floor(diffDays / 30)} months`
        return `${Math.floor(diffDays / 365)} years`
    }

    return (
        <Layout currentPage="profile" className="container mx-auto px-4 pb-8 max-w-5xl pt-6">
            {/* Animated Background Hero */}
            <div className="relative mb-8 overflow-hidden rounded-3xl">
                {/* Background with animated gradient */}
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500">
                    <div className="absolute inset-0 bg-[url(&quot;data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E&quot;)] opacity-30" />
                </div>
                
                {/* Floating decorative elements */}
                <div className="absolute top-4 right-8 w-24 h-24 bg-white/10 rounded-full blur-2xl animate-pulse" />
                <div className="absolute bottom-4 left-8 w-32 h-32 bg-pink-500/20 rounded-full blur-3xl" />
                
                {/* Profile Header Content */}
                <div className="relative p-8 md:p-10">
                    <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
                        {/* Avatar with upload */}
                        <div className="relative group">
                            <div className="w-28 h-28 md:w-32 md:h-32 rounded-3xl bg-gradient-to-br from-white/20 to-white/5 backdrop-blur-sm border-2 border-white/30 flex items-center justify-center text-white text-4xl font-bold shadow-2xl transition-transform duration-300 group-hover:scale-105">
                                {getInitials(user?.full_name || 'User')}
                            </div>
                            <button 
                                onClick={() => fileInputRef.current?.click()}
                                className="absolute -bottom-2 -right-2 w-10 h-10 bg-white rounded-xl shadow-lg flex items-center justify-center text-purple-600 hover:bg-purple-50 transition-all duration-300 hover:scale-110"
                            >
                                <Camera size={20} />
                            </button>
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                className="hidden" 
                                accept="image/*"
                            />
                        </div>
                        
                        {/* User Info */}
                        <div className="flex-1 text-center md:text-left">
                            <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
                                <h1 className="text-3xl md:text-4xl font-bold text-white">
                                    {user?.full_name || 'User'}
                                </h1>
                                <div className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-white text-sm font-medium border border-white/30">
                                    <span className="flex items-center gap-1.5">
                                        <CheckCircle size={14} />
                                        Active
                                    </span>
                                </div>
                            </div>
                            <p className="text-white/80 text-lg mb-4">{user?.email}</p>
                            
                            {/* Quick Stats */}
                            <div className="flex flex-wrap justify-center md:justify-start gap-3">
                                <div className="px-4 py-2 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20">
                                    <div className="flex items-center gap-2 text-white/90">
                                        <Calendar size={16} />
                                        <span className="text-sm">Member for {getMemberDuration()}</span>
                                    </div>
                                </div>
                                <div className="px-4 py-2 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20">
                                    <div className="flex items-center gap-2 text-white/90">
                                        <Shield size={16} />
                                        <span className="text-sm">Verified Account</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Success/Error Message */}
            {message && (
                <div className={`mb-6 p-4 rounded-2xl border text-sm animate-fade-in flex items-center gap-3 ${
                    message.type === 'success' 
                        ? 'bg-emerald-50/80 backdrop-blur border-emerald-200 text-emerald-800' 
                        : 'bg-red-50/80 backdrop-blur border-red-200 text-red-800'
                }`}>
                    {message.type === 'success' ? (
                        <CheckCheck size={20} className="text-emerald-600" />
                    ) : (
                        <XCircle size={20} className="text-red-600" />
                    )}
                    <span className="font-medium">{message.text}</span>
                    <button 
                        onClick={() => setMessage(null)}
                        className="ml-auto p-1 hover:bg-black/5 rounded-lg transition-colors"
                    >
                        <XCircle size={16} />
                    </button>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column - Main Settings */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Profile Information Card */}
                    <Card className="p-6 bg-white border border-slate-200/60 shadow-xl shadow-slate-200/50 rounded-2xl overflow-hidden relative">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400" />
                        
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/30">
                                    <User size={24} className="text-white" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-slate-800">Profile Information</h2>
                                    <p className="text-sm text-slate-500">Manage your personal details</p>
                                </div>
                            </div>
                            <Sparkles size={20} className="text-purple-400" />
                        </div>
                        
                        <div className="space-y-5">
                            {/* Full Name Field */}
                            <div className="group">
                                <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                                    <User size={14} className="text-purple-500" />
                                    Full Name
                                </label>
                                <div className="relative">
                                    <Input 
                                        value={fullName} 
                                        onChange={(e) => setFullName(e.target.value)} 
                                        placeholder="Enter your full name"
                                        className="pr-10 transition-all duration-300 focus:ring-2 focus:ring-purple-500/20"
                                    />
                                    <button 
                                        onClick={() => setIsEditingName(!isEditingName)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-all duration-300"
                                    >
                                        <Edit3 size={16} />
                                    </button>
                                </div>
                            </div>
                            
                            {/* Email Field */}
                            <div className="group">
                                <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                                    <Mail size={14} className="text-purple-500" />
                                    Email Address
                                </label>
                                <div className="relative">
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                                        <AtSign size={16} />
                                    </div>
                                    <Input 
                                        value={email} 
                                        onChange={(e) => setEmail(e.target.value)} 
                                        type="email" 
                                        placeholder="Enter your email"
                                        className="pl-10 pr-10 transition-all duration-300 focus:ring-2 focus:ring-purple-500/20"
                                    />
                                    <button 
                                        onClick={() => setIsEditingEmail(!isEditingEmail)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-all duration-300"
                                    >
                                        <Edit3 size={16} />
                                    </button>
                                </div>
                            </div>
                            
                            {/* Save Button */}
                            {hasChanges() && (
                                <div className="pt-2 animate-fade-in">
                                    <Button 
                                        onClick={handleSubmit} 
                                        disabled={loading}
                                        className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold rounded-xl shadow-lg shadow-purple-500/30 transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/40"
                                        icon={loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                                    >
                                        {loading ? 'Saving Changes...' : 'Save Changes'}
                                    </Button>
                                </div>
                            )}
                        </div>
                    </Card>

                    {/* Security Card */}
                    <Card className="p-6 bg-white border border-slate-200/60 shadow-xl shadow-slate-200/50 rounded-2xl overflow-hidden relative">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-red-500" />
                        
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
                                    <Lock size={24} className="text-white" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-slate-800">Security</h2>
                                    <p className="text-sm text-slate-500">Update your password</p>
                                </div>
                            </div>
                            <Shield size={20} className="text-amber-400" />
                        </div>
                        
                        <div className="space-y-5">
                            {/* Current Password */}
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    Current Password
                                </label>
                                <div className="relative">
                                    <Input 
                                        value={currentPassword} 
                                        onChange={(e) => setCurrentPassword(e.target.value)} 
                                        type={showCurrentPassword ? "text" : "password"}
                                        placeholder="Enter current password"
                                        className="pr-10"
                                    />
                                    <button
                                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 transition-colors"
                                    >
                                        {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>
                            
                            {/* New Password */}
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    New Password
                                </label>
                                <div className="relative">
                                    <Input 
                                        value={password} 
                                        onChange={(e) => setPassword(e.target.value)} 
                                        type={showPassword ? "text" : "password"}
                                        placeholder="Enter new password"
                                        className="pr-10"
                                    />
                                    <button
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 transition-colors"
                                    >
                                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>
                            
                            {/* Password Requirements */}
                            {password && (
                                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                                    <p className="text-xs font-semibold text-slate-600 mb-2">Password requirements:</p>
                                    <div className="space-y-1.5">
                                        <div className={`flex items-center gap-2 text-xs ${password.length >= 8 ? 'text-emerald-600' : 'text-slate-400'}`}>
                                            <CheckCircle size={12} />
                                            <span>At least 8 characters</span>
                                        </div>
                                        <div className={`flex items-center gap-2 text-xs ${/[A-Z]/.test(password) ? 'text-emerald-600' : 'text-slate-400'}`}>
                                            <CheckCircle size={12} />
                                            <span>One uppercase letter</span>
                                        </div>
                                        <div className={`flex items-center gap-2 text-xs ${/[0-9]/.test(password) ? 'text-emerald-600' : 'text-slate-400'}`}>
                                            <CheckCircle size={12} />
                                            <span>One number</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                            
                            <Button 
                                onClick={handleSubmit} 
                                disabled={loading || (!password || !currentPassword)}
                                variant="secondary"
                                className="w-full"
                                icon={loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                            >
                                {loading ? 'Updating...' : 'Update Password'}
                            </Button>
                        </div>
                    </Card>
                </div>

                {/* Right Column - Preferences & Stats */}
                <div className="space-y-6">
                    {/* Preferences Card */}
                    <Card className="p-6 bg-white border border-slate-200/60 shadow-xl shadow-slate-200/50 rounded-2xl overflow-hidden relative">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-cyan-500 to-teal-500" />
                        
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
                                <Settings size={20} className="text-white" />
                            </div>
                            <h2 className="text-lg font-bold text-slate-800">Preferences</h2>
                        </div>
                        
                        <div className="space-y-4">
                            {/* Dark Mode Toggle */}
                            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-slate-50 to-slate-100/50 rounded-xl border border-slate-200/50 hover:border-purple-300 transition-all duration-300 group">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${darkMode ? 'bg-indigo-100' : 'bg-amber-100'}`}>
                                        {darkMode ? <Moon size={20} className="text-indigo-600" /> : <Sun size={20} className="text-amber-600" />}
                                    </div>
                                    <div>
                                        <p className="font-semibold text-slate-800">Dark Mode</p>
                                        <p className="text-xs text-slate-500">Switch appearance</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setDarkMode(!darkMode)}
                                    className={`relative w-14 h-8 rounded-full transition-all duration-300 ${darkMode ? 'bg-gradient-to-r from-indigo-500 to-purple-600' : 'bg-slate-300'}`}
                                >
                                    <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-all duration-300 ${darkMode ? 'left-7' : 'left-1'}`}>
                                        {darkMode && <Moon size={14} className="absolute inset-0 m-auto text-indigo-600" />}
                                    </div>
                                </button>
                            </div>
                            
                            {/* Notifications Toggle */}
                            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-slate-50 to-slate-100/50 rounded-xl border border-slate-200/50 hover:border-emerald-300 transition-all duration-300 group">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${notifications ? 'bg-emerald-100' : 'bg-slate-200'}`}>
                                        <Bell size={20} className={notifications ? 'text-emerald-600' : 'text-slate-500'} />
                                    </div>
                                    <div>
                                        <p className="font-semibold text-slate-800">Notifications</p>
                                        <p className="text-xs text-slate-500">Push notifications</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setNotifications(!notifications)}
                                    className={`relative w-14 h-8 rounded-full transition-all duration-300 ${notifications ? 'bg-gradient-to-r from-emerald-500 to-teal-600' : 'bg-slate-300'}`}
                                >
                                    <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-all duration-300 ${notifications ? 'left-7' : 'left-1'}`} />
                                </button>
                            </div>
                            
                            {/* Email Updates Toggle */}
                            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-slate-50 to-slate-100/50 rounded-xl border border-slate-200/50 hover:border-blue-300 transition-all duration-300 group">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${emailUpdates ? 'bg-blue-100' : 'bg-slate-200'}`}>
                                        <Mail size={20} className={emailUpdates ? 'text-blue-600' : 'text-slate-500'} />
                                    </div>
                                    <div>
                                        <p className="font-semibold text-slate-800">Email Updates</p>
                                        <p className="text-xs text-slate-500">Weekly digest</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setEmailUpdates(!emailUpdates)}
                                    className={`relative w-14 h-8 rounded-full transition-all duration-300 ${emailUpdates ? 'bg-gradient-to-r from-blue-500 to-cyan-600' : 'bg-slate-300'}`}
                                >
                                    <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-all duration-300 ${emailUpdates ? 'left-7' : 'left-1'}`} />
                                </button>
                            </div>
                        </div>
                    </Card>

                    {/* Account Stats Card */}
                    <Card className="p-6 bg-gradient-to-br from-violet-500 via-purple-600 to-pink-500 border-0 rounded-2xl overflow-hidden relative shadow-xl shadow-purple-500/30">
                        {/* Background pattern */}
                        <div className="absolute inset-0 opacity-10">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full blur-3xl" />
                            <div className="absolute bottom-0 left-0 w-24 h-24 bg-pink-400 rounded-full blur-2xl" />
                        </div>
                        
                        <div className="relative">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                                    <Activity size={20} className="text-white" />
                                </div>
                                <h3 className="font-bold text-white text-lg">Account Activity</h3>
                            </div>
                            
                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-3 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20">
                                    <div className="flex items-center gap-3">
                                        <Calendar size={18} className="text-white/80" />
                                        <span className="text-white/80 text-sm">Member Since</span>
                                    </div>
                                    <span className="text-white font-semibold">
                                        {user?.created_at 
                                            ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                                            : 'N/A'}
                                    </span>
                                </div>
                                
                                <div className="flex items-center justify-between p-3 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20">
                                    <div className="flex items-center gap-3">
                                        <Award size={18} className="text-white/80" />
                                        <span className="text-white/80 text-sm">Account Type</span>
                                    </div>
                                    <span className="text-white font-semibold">Standard</span>
                                </div>
                                
                                <div className="flex items-center justify-between p-3 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20">
                                    <div className="flex items-center gap-3">
                                        <Shield size={18} className="text-white/80" />
                                        <span className="text-white/80 text-sm">Security Status</span>
                                    </div>
                                    <span className="flex items-center gap-1.5 text-emerald-300 font-semibold text-sm">
                                        <CheckCircle size={14} />
                                        Secure
                                    </span>
                                </div>
                            </div>
                            
                            <div className="mt-6 pt-4 border-t border-white/20">
                                <div className="flex items-center justify-center gap-2 text-white/60 text-xs">
                                    <Sparkles size={12} />
                                    <span>Last updated: Just now</span>
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* Quick Actions */}
                    <Card className="p-5 bg-white border border-slate-200/60 shadow-lg rounded-2xl">
                        <h3 className="font-semibold text-slate-800 mb-4 text-sm">Quick Actions</h3>
                        <div className="space-y-2">
                            <button className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-all duration-300 group text-left">
                                <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                                    <FileText size={18} className="text-blue-600" />
                                </div>
                                <div>
                                    <p className="font-medium text-slate-700 text-sm">Export Data</p>
                                    <p className="text-xs text-slate-400">Download your information</p>
                                </div>
                            </button>
                            <button className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-all duration-300 group text-left">
                                <div className="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                                    <Database size={18} className="text-purple-600" />
                                </div>
                                <div>
                                    <p className="font-medium text-slate-700 text-sm">Storage Usage</p>
                                    <p className="text-xs text-slate-400">Manage your storage</p>
                                </div>
                            </button>
                        </div>
                    </Card>
                </div>
            </div>
        </Layout>
    )
}

export default Profile
