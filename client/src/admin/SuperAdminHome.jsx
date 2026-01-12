import React from 'react'
import { useNavigate } from 'react-router-dom'
import { API_URL } from '../lib/apiClient.js'
import AdminSidebar from '../components/AdminSidebar.jsx'

export default function SuperAdminHome() {
  const navigate = useNavigate()

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

  return (
    <div className="flex h-screen w-full bg-background-light font-sans overflow-hidden">
      <AdminSidebar />

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-background-light relative">
        {/* Mobile Header */}
        <div className="lg:hidden bg-[#1F2124] text-white p-4 flex justify-between items-center shadow-md">
          <span className="font-light tracking-widest uppercase">Uptown</span>
          <button className="text-white" onClick={handleLogout}>
            <span className="material-symbols-outlined">logout</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 lg:p-12">
          <div className="w-full mx-auto">
            <div className="mb-10">
              <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
                Administration Home
              </h1>
              <p className="text-gray-500 mt-2 text-sm">
                Choose a management area to get started.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
              {/* Users Card */}
              <div
                onClick={() => navigate('/admin/users')}
                className="bg-white rounded-xl p-6 border border-gray-200 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] hover:shadow-lg hover:border-primary/30 transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="p-2.5 bg-primary/10 rounded-lg text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                    <span className="material-symbols-outlined text-[24px]">group</span>
                  </div>
                  <span className="material-symbols-outlined text-gray-300 group-hover:text-primary transition-colors">
                    arrow_forward
                  </span>
                </div>
                <h2 className="text-lg font-bold text-gray-900 mb-4">Users</h2>
                <div className="space-y-3">
                  <p className="text-sm text-gray-500">
                    Create and manage employee accounts, roles, and activation status.
                  </p>
                </div>
              </div>

              {/* Teams Card */}
              <div
                onClick={() => navigate('/admin/teams')}
                className="bg-white rounded-xl p-6 border border-gray-200 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] hover:shadow-lg hover:border-primary/30 transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="p-2.5 bg-primary/10 rounded-lg text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                    <span className="material-symbols-outlined text-[24px]">diversity_3</span>
                  </div>
                  <span className="material-symbols-outlined text-gray-300 group-hover:text-primary transition-colors">
                    arrow_forward
                  </span>
                </div>
                <h2 className="text-lg font-bold text-gray-900 mb-4">Teams</h2>
                <div className="space-y-3">
                  <p className="text-sm text-gray-500">
                    Configure sales, finance, and contracts team membership.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}