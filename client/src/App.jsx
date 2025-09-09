import React, { useEffect, useState } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export default function App() {
  const [message, setMessage] = useState('Loading...')
  const [health, setHealth] = useState(null)

  useEffect(() => {
    async function load() {
      try {
        const [healthRes, msgRes] = await Promise.all([
          fetch(`${API_URL}/api/health`).then(r => r.json()),
          fetch(`${API_URL}/api/message`).then(r => r.json())
        ])
        setHealth(healthRes)
        setMessage(msgRes.message)
      } catch (err) {
        setMessage('Failed to reach API. Is Docker running?')
      }
    }
    load()
  }, [])

  return (
    <div style={{ fontFamily: 'system-ui, Arial, sans-serif', lineHeight: 1.4, padding: 24 }}>
      <h1>Vite + React + Express</h1>
      <p style={{ color: '#666' }}>
        Client is running in Docker on port 5173. Server on port 3000.
      </p>

      <section style={{ marginTop: 16 }}>
        <h2>API Connectivity</h2>
        <pre style={{ background: '#f6f8fa', padding: 12, borderRadius: 8, overflow: 'auto' }}>
{JSON.stringify(health, null, 2)}
        </pre>
        <p><strong>Message from API:</strong> {message}</p>
      </section>
    </div>
  )
}