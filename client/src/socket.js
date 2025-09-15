import { useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'

// Build API URL from Vite env (fallback to localhost)
const API_URL = (import.meta?.env?.VITE_API_URL || 'http://localhost:3000').replace(/\/+$/, '')

let sharedSocket = null

export function initSocket(userId) {
  // Initialize a shared Socket.IO connection with optional user room join via query
  if (!sharedSocket) {
    sharedSocket = io(API_URL, {
      transports: ['websocket'],
      query: userId ? { userId: String(userId) } : {}
    })
  } else if (userId) {
    // emit join event if already connected
    sharedSocket.emit('join', String(userId))
  }
  return sharedSocket
}

export const useNotifications = (userId) => {
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const socketRef = useRef(null)

  useEffect(() => {
    socketRef.current = initSocket(userId)

    const onNotification = (notif) => {
      setNotifications(prev => [notif, ...prev])
      setUnreadCount(prev => prev + 1)
    }

    socketRef.current.on('notification', onNotification)

    return () => {
      if (socketRef.current) {
        socketRef.current.off('notification', onNotification)
      }
    }
  }, [userId])

  return { socket: socketRef.current, notifications, unreadCount }
}