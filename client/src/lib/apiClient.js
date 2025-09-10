const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

async function refreshTokens() {
  const refreshToken = localStorage.getItem('refresh_token')
  if (!refreshToken) throw new Error('No refresh token')
  const resp = await fetch(`${API_URL}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken })
  })
  if (!resp.ok) throw new Error('Refresh failed')
  const data = await resp.json()
  const access = data.accessToken
  const newRefresh = data.refreshToken
  if (access) localStorage.setItem('auth_token', access)
  if (newRefresh) localStorage.setItem('refresh_token', newRefresh)
  return access
}

export async function fetchWithAuth(input, init = {}, retry = true) {
  const token = localStorage.getItem('auth_token')
  const headers = { ...(init.headers || {}) }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const resp = await fetch(input, { ...init, headers })
  if (resp.status === 401 && retry) {
    try {
      await refreshTokens()
      return fetchWithAuth(input, init, false)
    } catch (e) {
      // Refresh failed, force logout
      localStorage.removeItem('auth_token')
      localStorage.removeItem('refresh_token')
      localStorage.removeItem('auth_user')
      if (!location.pathname.startsWith('/login')) {
        location.href = '/login'
      }
      throw e
    }
  }
  return resp
}

export { API_URL }