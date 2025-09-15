import { Server } from 'socket.io'
import { createNotification } from './notificationService.js'

let io = null

export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: (process.env.CORS_ORIGINS || 'http://localhost:5173').split(',').map(s => s.trim())
    }
  })

  io.on('connection', (socket) => {
    // Optional: support joining a per-user room if client supplies userId
    const { userId } = socket.handshake.query || {}
    if (userId) {
      socket.join(String(userId))
    }

    socket.on('join', (room) => {
      if (room) socket.join(String(room))
    })

    socket.on('leave', (room) => {
      if (room) socket.leave(String(room))
    })

    socket.on('disconnect', () => {
      // no-op; log if needed
    })
  })

  return io
}

export const emitNotification = async (type, userId, refTable, refId, message) => {
  if (!io) return
  const notification = await createNotification(type, userId, refTable, refId, message)
  // emit to the user-specific room
  io.to(String(userId)).emit('notification', notification)
}

export const getIo = () => io