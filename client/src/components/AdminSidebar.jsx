import React, { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'

export default function AdminSidebar() {
  const [user, setUser] = useState(null)
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()
  const path = location.pathname

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem('auth_user') || '{}')
      setUser(u)
    } catch {}
  }, [])

  const handleLogout = async () => {
    try {
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'
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

  const role = user?.role
  const isSuper = role === 'superadmin'

  // Define menu structure
  const menus = []

  // SUPERADMIN
  if (isSuper) {
    menus.push({ label: 'Home', to: '/admin/superadmin-home', icon: 'admin_panel_settings' })
    menus.push({ label: 'Users', to: '/admin/users', icon: 'group' })
    menus.push({ label: 'Teams', to: '/admin/teams', icon: 'diversity_3' })
    menus.push({ label: 'Inventory', to: '/admin/units', icon: 'apartment' })
    menus.push({ label: 'Contracts', to: '/contracts', icon: 'gavel' })
    menus.push({ label: 'Finance', to: '/admin/finance-team', icon: 'payments' })
    menus.push({ label: 'Logs', to: '/admin/workflow-logs', icon: 'history' })
  }

  // ADMIN (General Admin)
  if (role === 'admin') {
     menus.push({ label: 'Users', to: '/admin/users', icon: 'group' })
     menus.push({ label: 'Teams', to: '/admin/teams', icon: 'diversity_3' })
     menus.push({ label: 'Contracts', to: '/contracts', icon: 'gavel' })
     menus.push({ label: 'Inventory', to: '/admin/inventory-drafts', icon: 'apartment' })
  }

  // SALES (Consultant & Manager)
  if (role === 'property_consultant' || role === 'sales_manager') {
      menus.push({ label: 'Dashboard', to: '/deals', icon: 'dashboard' }) // Deals Dashboard
      if (role === 'property_consultant') {
          menus.push({ label: 'Create Deal', to: '/deals/create', icon: 'add_circle' })
          menus.push({ label: 'My Proposals', to: '/deals/my-proposals', icon: 'description' })
      }
      if (role === 'sales_manager') {
          menus.push({ label: 'Queue', to: '/deals/queues', icon: 'schedule' })
          menus.push({ label: 'Team Proposals', to: '/deals/team-proposals', icon: 'groups' })
          menus.push({ label: 'Blocks', to: '/deals/block-requests', icon: 'block' })
      }
      menus.push({ label: 'Inventory', to: '/deals/inventory', icon: 'building' })
  }

  // FINANCIAL MANAGER
  if (role === 'financial_manager') {
      menus.push({ label: 'Standard Pricing', to: '/admin/standard-pricing', icon: 'price_check' })
      menus.push({ label: 'Unit Models', to: '/admin/unit-models', icon: 'table_view' })
      menus.push({ label: 'Thresholds', to: '/admin/payment-thresholds', icon: 'tune' })
      menus.push({ label: 'Holds', to: '/admin/holds', icon: 'pause_circle' })
      menus.push({ label: 'Rejected', to: '/admin/standard-pricing/rejected', icon: 'cancel' })
  }

  // FINANCIAL ADMIN
  if (role === 'financial_admin') {
      menus.push({ label: 'Standard Pricing', to: '/admin/standard-pricing', icon: 'price_check' })
      menus.push({ label: 'Inventory History', to: '/admin/inventory-change-history', icon: 'history' })
  }

  // CONTRACT MANAGER & PERSON
  if (role === 'contract_manager' || role === 'contract_person') {
       menus.push({ label: 'Contracts', to: '/contracts', icon: 'gavel' })
       if (role === 'contract_manager') {
           menus.push({ label: 'Holds', to: '/admin/holds', icon: 'pause_circle' })
           menus.push({ label: 'Unlock Req.', to: '/contracts/settings-unlock-requests', icon: 'lock_open' })
       }
  }

  // CRM ADMIN
  if (role === 'crm_admin') {
      menus.push({ label: 'Inventory', to: '/admin/inventory', icon: 'apartment' })
      menus.push({ label: 'Drafts', to: '/admin/draft-units', icon: 'edit_note' })
      menus.push({ label: 'History', to: '/admin/inventory-change-history', icon: 'history' })
  }

  // CEO / CHAIRMAN / TOP MANAGEMENT
  if (['ceo', 'chairman', 'vice_chairman', 'top_management'].includes(role)) {
      menus.push({ label: 'Dashboard', to: '/deals/queues', icon: 'dashboard' })
      menus.push({ label: 'Approvals', to: '/admin/standard-pricing-approvals', icon: 'check_circle' })
      menus.push({ label: 'Contracts', to: '/contracts', icon: 'gavel' })
      menus.push({ label: 'Inventory', to: '/admin/inventory', icon: 'apartment' })
      menus.push({ label: 'Logs', to: '/admin/workflow-logs', icon: 'history' })
  }


  return (
    <>
      {/* Mobile Header (Visible only on small screens) */}
      <div className="lg:hidden bg-[#16181b] text-white p-4 flex justify-between items-center shadow-md sticky top-0 z-50">
           <span className="font-display font-bold text-xl tracking-wider text-[#B08D47]">UPTOWN</span>
           <button onClick={() => setCollapsed(!collapsed)} className="text-white">
             <span className="material-symbols-outlined">menu</span>
           </button>
      </div>

      {/* Sidebar Container */}
      <aside className={`
        bg-sidebar-dark text-gray-300 w-64 flex-shrink-0 flex flex-col h-screen fixed lg:relative z-40 transition-transform duration-300
        ${collapsed ? '-translate-x-full' : 'translate-x-0'}
        lg:translate-x-0
        bg-sidebar-pattern border-r border-gray-800
      `}>
          {/* Logo Area */}
          <div className="h-16 flex items-center px-6 border-b border-gray-800 bg-[#16181b]/50 backdrop-blur-sm">
             <span className="font-display font-bold text-2xl tracking-widest text-[#B08D47]">UPTOWN</span>
          </div>

          {/* User Info */}
          <div className="px-6 py-6">
              <div className="flex items-center gap-3 mb-1">
                 <div className="w-10 h-10 rounded-full bg-[#B08D47]/20 flex items-center justify-center text-[#B08D47] border border-[#B08D47]/30">
                    <span className="material-symbols-outlined text-[20px]">person</span>
                 </div>
                 <div className="overflow-hidden">
                    <p className="text-white font-medium text-sm truncate">{user?.meta?.full_name || 'User'}</p>
                    <p className="text-xs text-gray-500 truncate capitalize">{role?.replace('_', ' ') || 'Guest'}</p>
                 </div>
              </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 overflow-y-auto px-4 py-2 space-y-1">
             {menus.map((m, i) => {
                 const isActive = path === m.to || path.startsWith(m.to + '/')
                 return (
                     <Link 
                        key={i} 
                        to={m.to} 
                        onClick={() => setCollapsed(true)} // Close on mobile on click
                        className={`group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200
                        ${isActive 
                           ? 'bg-[#B08D47]/10 text-[#B08D47] border border-[#B08D47]/20 shadow-[0_0_15px_rgba(176,141,71,0.1)]' 
                           : 'text-gray-400 hover:bg-white/5 hover:text-white'
                        }`}
                     >
                        <span className={`material-symbols-outlined mr-3 text-[20px] transition-colors ${isActive ? 'text-[#B08D47]' : 'text-gray-500 group-hover:text-white'}`}>
                            {m.icon}
                        </span>
                        {m.label}
                     </Link>
                 )
             })}
          </nav>

          {/* Footer / Logout */}
          <div className="p-4 border-t border-gray-800 bg-[#16181b]/30">
             <button 
                onClick={handleLogout}
                className="flex items-center w-full px-3 py-2 text-sm font-medium text-gray-400 rounded-lg hover:bg-red-500/10 hover:text-red-400 transition-colors"
                title="Sign out"
             >
                <span className="material-symbols-outlined mr-3 text-[20px]">logout</span>
                Sign Out
             </button>
          </div>
      </aside>

      {/* Mobile Overlay */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div 
         className={`fixed inset-0 bg-black/50 z-30 lg:hidden transition-opacity ${collapsed ? 'hidden' : 'block'}`}
         onClick={() => setCollapsed(true)}
      />
    </>
  )
}
