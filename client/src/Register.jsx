import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { notifyError, notifySuccess } from './lib/notifications.js'
import RegisterView from './ui/auth/RegisterView.jsx'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export default function Register() {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [department, setDepartment] = useState('')
  const [password, setPassword] = useState('')
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function onSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const body = {
        email,
        password
      }
      if (firstName) body.firstName = firstName
      if (lastName) body.lastName = lastName
      if (department) body.department = department

      const resp = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await resp.json()
      if (!resp.ok) {
        notifyError(data || { message: 'Registration failed' })
        return
      }
      const access = data.accessToken || data.token
      if (access) localStorage.setItem('auth_token', access)
      if (data.refreshToken) localStorage.setItem('refresh_token', data.refreshToken)
      if (data.user) localStorage.setItem('auth_user', JSON.stringify(data.user))
      notifySuccess('Account created')
      navigate('/')
    } catch (e) {
      notifyError(e, 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  function handleLoginClick() {
    navigate('/login')
  }

  return (
    <RegisterView
      firstName={firstName}
      lastName={lastName}
      email={email}
      department={department}
      password={password}
      termsAccepted={termsAccepted}
      loading={loading}
      onChangeFirstName={setFirstName}
      onChangeLastName={setLastName}
      onChangeEmail={setEmail}
      onChangeDepartment={setDepartment}
      onChangePassword={setPassword}
      onChangeTerms={setTermsAccepted}
      onSubmit={onSubmit}
      onLoginClick={handleLoginClick}
    />
  )
}