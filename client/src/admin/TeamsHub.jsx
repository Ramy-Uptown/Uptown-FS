import React from 'react'
import { useNavigate } from 'react-router-dom'
import { API_URL } from '../lib/apiClient.js'
import AdminSidebar from '../components/AdminSidebar.jsx'

export default function TeamsHub() {
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

  const cards = [
    {
      title: 'Sales Team',
      description: 'Assign sales managers to property consultants.',
      icon: 'groups',
      onClick: () => navigate('/admin/sales')
    },
    {
      title: 'Finance Team',
      description: 'Associate financial admins with financial managers.',
      icon: 'account_balance',
      onClick: () => navigate('/admin/finance-team')
    },
    {
      title: 'Contracts Team',
      description: 'Link contract people to contract managers.',
      icon: 'description',
      onClick: () => navigate('/admin/contracts-team')
    },
    {
      title: 'Sales Manager View',
      description: 'Read-only overview of sales manager pairs.',
      icon: 'supervisor_account',
      onClick: () => navigate('/admin/sales-team')
    }
  ]

  return (
    <div className="flex h-screen w-full bg-background-light font-sans overflow-hidden">
      <AdminSidebar />
      
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-background-light relative">
        <div className="lg:hidden bg-[#1F2124] text-white p-4 flex justify-between items-center shadow-md">
           <span className="font-light tracking-widest uppercase">Uptown</span>
           <button className="text-white" onClick={handleLogout}><span className="material-symbols-outlined">logout</span></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
            <div className="w-full mx-auto">
                <header className="mb-10">
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
                    Teams
                  </h1>
                  <p className="mt-2 text-sm text-gray-500">
                    Central hub for managing team structures and hierarchy.
                  </p>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
                  {cards.map(card => (
                    <div
                      key={card.title}
                      onClick={card.onClick}
                      className="group relative bg-white rounded-xl p-6 border border-gray-200 shadow-sm hover:shadow-lg hover:border-primary/30 transition-all cursor-pointer"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="p-2.5 bg-primary/10 rounded-lg text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                          <span className="material-symbols-outlined text-[24px]">{card.icon}</span>
                        </div>
                        <span className="material-symbols-outlined text-gray-300 group-hover:text-primary transition-colors">
                          arrow_forward
                        </span>
                      </div>
                      <h2 className="text-lg font-bold text-gray-900 mb-2">
                        {card.title}
                      </h2>
                      <p className="text-sm text-gray-500 group-hover:text-gray-600 transition-colors">
                        {card.description}
                      </p>
                    </div>
                  ))}
                </div>
            </div>
        </div>
      </main>
    </div>
  )
}
