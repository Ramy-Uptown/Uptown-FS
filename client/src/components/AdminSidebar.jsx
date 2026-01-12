import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { API_URL } from '../lib/apiClient.js'

export default function AdminSidebar() {
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = async () => {
    try {
      const rt = localStorage.getItem('refresh_token')
      if (rt) {
        await fetch(`${API_URL}/api/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: rt })
        }).catch(() => {})
      }
    } finally {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('refresh_token')
      localStorage.removeItem('auth_user')
      window.location.href = '/login'
    }
  }

  const isActive = (path) => location.pathname.startsWith(path)

  return (
    <aside className="hidden lg:flex flex-col w-72 xl:w-80 bg-sidebar-pattern border-r border-gray-800 relative flex-shrink-0 z-20 text-white">
      <div className="absolute inset-0 bg-gradient-to-b from-[#1F2124]/90 to-[#151719]/95 pointer-events-none z-0" />
      <div className="relative z-10 flex flex-col h-full p-6 xl:p-8">
        <div className="mb-8 cursor-pointer" onClick={() => navigate('/admin/superadmin-home')}>
          <div className="text-primary tracking-[0.25em] font-light text-3xl mb-2 uppercase">
            UPTOWN
          </div>
          <div className="flex items-center gap-3">
            <div className="h-px w-6 bg-primary" />
            <div className="text-gray-400 text-[10px] tracking-[0.3em] uppercase font-bold">
              Financial System
            </div>
          </div>
        </div>

        <div className="h-px w-full bg-gray-800 mb-8" />

        <nav className="flex-1 space-y-4">
          <button
            onClick={() => navigate('/admin/users')}
            className={`w-full group flex items-start gap-4 p-4 rounded-xl border transition-all duration-200 text-left ${
              isActive('/admin/users') 
                ? 'bg-white/10 border-primary/30' 
                : 'bg-white/5 border-transparent hover:bg-white/10 hover:border-primary/30'
            }`}
          >
            <div className={`flex-shrink-0 p-2 rounded-lg transition-colors ${
              isActive('/admin/users') 
                ? 'bg-primary text-white' 
                : 'bg-[#2A2D32] text-primary group-hover:bg-primary group-hover:text-white'
            }`}>
              <span className="material-symbols-outlined text-[20px]">group</span>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white tracking-wide">Users</h3>
              <p className="text-[11px] text-gray-500 mt-0.5 group-hover:text-gray-300 transition-colors">
                Manage access & roles
              </p>
            </div>
          </button>

          <button
            onClick={() => navigate('/admin/teams')}
            className={`w-full group flex items-start gap-4 p-4 rounded-xl border transition-all duration-200 text-left ${
              isActive('/admin/teams') 
                ? 'bg-white/10 border-primary/30' 
                : 'bg-white/5 border-transparent hover:bg-white/10 hover:border-primary/30'
            }`}
          >
            <div className={`flex-shrink-0 p-2 rounded-lg transition-colors ${
              isActive('/admin/teams') 
                ? 'bg-primary text-white' 
                : 'bg-[#2A2D32] text-primary group-hover:bg-primary group-hover:text-white'
            }`}>
              <span className="material-symbols-outlined text-[20px]">diversity_3</span>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white tracking-wide">Teams</h3>
              <p className="text-[11px] text-gray-500 mt-0.5 group-hover:text-gray-300 transition-colors">
                Assign team members
              </p>
            </div>
          </button>
        </nav>

        <div className="mt-auto">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 text-gray-400 hover:text-white transition-colors mb-8 group w-full px-2"
          >
            <span className="material-symbols-outlined text-[20px] group-hover:text-primary transition-colors">
              logout
            </span>
            <span className="text-sm font-medium tracking-wide">Logout</span>
          </button>
          <div className="pt-6 border-t border-gray-800 flex flex-col gap-1 text-[10px] text-gray-600 uppercase tracking-widest font-medium">
            <span className="text-gray-500">V 2.4.0</span>
            <span>© 2024 Uptown Financial</span>
          </div>
        </div>
      </div>
    </aside>
  )
}
