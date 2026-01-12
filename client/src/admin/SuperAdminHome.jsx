import React from 'react'
import { useNavigate } from 'react-router-dom'
import BrandHeader from '../lib/BrandHeader.jsx'
import { API_URL } from '../lib/apiClient.js'

/**
 * SuperAdminHome
 * Landing page for the superadmin role.
 * Shows only two primary entry points: Users and Teams, plus logout via BrandHeader.
 */
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
    <div className="min-h-screen bg-background-light text-gray-900">
      <BrandHeader onLogout={handleLogout} />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <header className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Super Admin Home
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Manage system users and team assignments. Financial and contract
            detail consoles remain with their respective domain roles.
          </p>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <button
            type="button"
            onClick={() => navigate('/admin/users')}
            className="group relative flex flex-col items-start gap-4 rounded-xl bg-white border border-gray-200 px-6 py-5 text-left shadow-sm hover:shadow-md hover:border-primary/40 transition-all"
          >
            <div className="flex items-center justify-between w-full mb-1">
              <div className="inline-flex items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-colors p-2.5">
                <span className="material-symbols-outlined text-[24px]">
                  group
                </span>
              </div>
              <span className="material-symbols-outlined text-gray-300 group-hover:text-primary transition-colors">
                arrow_forward
              </span>
            </div>
            <h2 className="text-lg font-semibold text-gray-900">
              Users
            </h2>
            <p className="text-sm text-gray-500">
              Create and manage employee accounts, roles, and activation status.
            </p>
          </button>

          <button
            type="button"
            onClick={() => navigate('/admin/teams')}
            className="group relative flex flex-col items-start gap-4 rounded-xl bg-white border border-gray-200 px-6 py-5 text-left shadow-sm hover:shadow-md hover:border-primary/40 transition-all"
          >
            <div className="flex items-center justify-between w-full mb-1">
              <div className="inline-flex items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-colors p-2.5">
                <span className="material-symbols-outlined text-[24px]">
                  diversity_3
                </span>
              </div>
              <span className="material-symbols-outlined text-gray-300 group-hover:text-primary transition-colors">
                arrow_forward
              </span>
            </div>
            <h2 className="text-lg font-semibold text-gray-900">
              Teams
            </h2>
            <p className="text-sm text-gray-500">
              Configure sales, finance, and contracts team membership without
              exposing deal, pricing, or contract financial details.
            </p>
          </button>
        </section>
      </main>
    </div>
  )
}