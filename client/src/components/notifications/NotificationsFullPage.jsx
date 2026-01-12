import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminSidebar from '../AdminSidebar.jsx' // Assuming we wrap it or main layout wraps it. Main.jsx suggests we route to components directly.
// Main.jsx routes usually don't include Sidebar in the component itself if they are top level? 
// Wait, client/deals/App.jsx includes Sidebar. client/admin/*.jsx usually includes Sidebar?
// Let's check AdminSidebar usage.
// Actually, `client/src/deals/App.jsx` wraps content with `AdminSidebar`.
// `client/src/main.jsx` routes to components. Those components likely include AdminSidebar if they are pages.
// I should check `client/src/admin/Users.jsx` to see if it includes Sidebar.

const NotificationsFullPage = () => {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    fetchNotifications()
  }, [])

  const fetchNotifications = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/notifications')
      const data = await response.json()
      if (data.ok) {
        setNotifications(data.notifications || [])
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  const markAsRead = async (notificationId) => {
    try {
      await fetch(`/api/notifications/${notificationId}/read`, { method: 'PATCH' })
      setNotifications(prev => 
        prev.map(notif => 
          notif.id === notificationId ? { ...notif, is_read: true } : notif
        )
      )
    } catch (error) {
      console.error('Failed to mark as read:', error)
    }
  }

  const markAllAsRead = async () => {
    try {
      await fetch('/api/notifications/mark-all-read', { method: 'PATCH' })
      setNotifications(prev => prev.map(notif => ({ ...notif, is_read: true })))
    } catch (error) {
      console.error('Failed to mark all as read:', error)
    }
  }

  const handleItemClick = (item) => {
    if (!item.is_read) markAsRead(item.id)
    if (item.ref_table && item.ref_id) {
        // Handle specific routing logic if needed
        // For deals: /deals/:id
        if (item.ref_table === 'deals') {
            window.location.href = `/deals/${item.ref_id}`
        } else {
             window.location.href = `/${item.ref_table}/${item.ref_id}`
        }
    }
  }

  const getIcon = (type) => {
    const icons = {
      offer_submitted: '📄',
      offer_approved: '✅',
      offer_rejected: '❌',
      block_request: '🏢',
      block_request_pending: '🏢',
      block_approved: '✅',
      block_expired: '⏰',
      reservation_created: '📋',
      reservation_approved: '✅',
      contract_ready: '📝'
    }
    return icons[type] || '📢'
  }

  const getColor = (type) => {
      const colors = {
        offer_submitted: 'bg-blue-100 text-blue-800',
        offer_approved: 'bg-green-100 text-green-800',
        offer_rejected: 'bg-red-100 text-red-800',
        block_request: 'bg-orange-100 text-orange-800',
        block_request_pending: 'bg-orange-100 text-orange-800',
        block_approved: 'bg-green-100 text-green-800',
        block_expired: 'bg-gray-100 text-gray-800',
        reservation_created: 'bg-purple-100 text-purple-800',
        reservation_approved: 'bg-green-100 text-green-800',
        contract_ready: 'bg-blue-100 text-blue-800'
      }
      return colors[type] || 'bg-gray-100 text-gray-800'
  }

  return (
    <div className="flex h-screen bg-gray-50 font-sans overflow-hidden">
        <AdminSidebar />
        <main className="flex-1 flex flex-col h-full overflow-hidden relative">
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
                <div className="max-w-4xl mx-auto">
                    <div className="flex justify-between items-center mb-6">
                        <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
                        {notifications.some(n => !n.is_read) && (
                            <button 
                                onClick={markAllAsRead}
                                className="text-sm font-medium text-primary hover:text-primary-dark"
                            >
                                Mark all as read
                            </button>
                        )}
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden min-h-[400px]">
                        {loading ? (
                            <div className="p-8 text-center text-gray-500">Loading...</div>
                        ) : notifications.length === 0 ? (
                            <div className="p-12 text-center">
                                <span className="text-4xl block mb-4">🔕</span>
                                <p className="text-gray-500">No notifications yet</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-100">
                                {notifications.map(item => (
                                    <div 
                                        key={item.id}
                                        onClick={() => handleItemClick(item)}
                                        className={`p-4 hover:bg-gray-50 transition-colors cursor-pointer flex items-start gap-4 ${!item.is_read ? 'bg-blue-50/50' : ''}`}
                                    >
                                        <div className="flex-shrink-0 text-2xl mt-1">
                                            {getIcon(item.type)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start gap-2">
                                                <p className={`text-sm font-medium ${!item.is_read ? 'text-gray-900' : 'text-gray-700'}`}>
                                                    {item.message}
                                                </p>
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getColor(item.type)}`}>
                                                    {String(item.type || '').replace(/_/g, ' ')}
                                                </span>
                                            </div>
                                            <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                                                <span>{new Date(item.created_at).toLocaleString()}</span>
                                                {item.ref_title && (
                                                    <>
                                                        <span>•</span>
                                                        <span>Related: {item.ref_title}</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        {!item.is_read && (
                                            <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </main>
    </div>
  )
}

export default NotificationsFullPage
