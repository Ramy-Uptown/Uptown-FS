import React from 'react'
import { useNavigate } from 'react-router-dom'
import BrandHeader from '../lib/BrandHeader.jsx'
import { API_URL } from '../lib/apiClient.js'

/**
 * TeamsHub
 * Simple hub for team membership pages (Sales, Finance, Contracts).
 * Intended primarily for superadmin (and admin) to jump into each team console.
 */
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
      icon: 'group',
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
      description: 'Read-only overview of sales manager → consultant pairs.',
      icon: 'supervisor_account',
      onClick: () => navigate('/admin/sales-team')
    }
  ]

  return (
    <div className="min-h-screen bg-background-light text-gray-900">
      <BrandHeader onLogout={handleLogout} />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <header className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Teams
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Central place to manage team membership for Sales, Finance, and
            Contracts without opening detailed financial or contract consoles.
          </p>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {cards.map(card => (
            <button
              key={card.title}
              type="button"
              onClick={card.onClick}
              className="group flex flex-col items-start gap-4 rounded-xl bg-white border border-gray-200 px-6 py-5 text-left shadow-sm hover:shadow-md hover:border-primary/40 transition-all"
            >
              <div className="flex items-center justify-between w-full mb-1">
                <div className="inline-flex items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-colors p-2.5">
                  <span className="material-symbols-outlined text-[24px]">
                    {card.icon}
                  </span>
                </div>
                <span className="material-symbols-outlined text-gray-300 group-hover:text-primary transition-colors">
                  arrow_forward
                </span>
              </div>
              <h2 className="text-lg font-semibold text-gray-900">
                {card.title}
              </h2>
              <p className="text-sm text-gray-500">
                {card.description}
              </p>
            </button>
          ))}
        </section>
      </main>
    </div>
  )
}