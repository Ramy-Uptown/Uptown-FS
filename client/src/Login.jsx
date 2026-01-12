import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { notifyError, notifySuccess } from './lib/notifications.js'
import LoginView from './ui/auth/LoginView.jsx'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function onSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const resp = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      const data = await resp.json()
      if (!resp.ok) {
        notifyError(data || { message: 'Login failed' })
        return
      }
      const access = data.accessToken || data.token
      if (!access) {
        notifyError('No access token in response')
        return
      }
      localStorage.setItem('auth_token', access)
      if (data.refreshToken) localStorage.setItem('refresh_token', data.refreshToken)
      if (data.user) localStorage.setItem('auth_user', JSON.stringify(data.user))
      notifySuccess('Logged in successfully')
      navigate('/')
    } catch (e) {
      notifyError(e, 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  function handleRegisterClick() {
    navigate('/register')
  }

  function handleForgotPasswordClick() {
    // Placeholder: backend supports /api/auth/request-password-reset,
    // but there is no dedicated UI route yet.
    notifyError(
      { message: 'Password reset UI is not wired yet. Please contact your System Admin.' },
      'Password reset'
    )
  }

  return (
    <LoginView
      email={email}
      password={password}
      rememberMe={rememberMe}
      loading={loading}
      onChangeEmail={setEmail}
      onChangePassword={setPassword}
      onChangeRememberMe={setRememberMe}
      onSubmit={onSubmit}
      onRegisterClick={handleRegisterClick}
      onForgotPasswordClick={handleForgotPasswordClick}
    />
  )
}