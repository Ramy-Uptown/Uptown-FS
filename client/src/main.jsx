import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import App from './App.jsx'
import Login from './Login.jsx'
import DealsApp from './deals/App.jsx'
import Users from './admin/Users.jsx'
import Units from './admin/Units.jsx'

function PrivateRoute({ children }) {
  const token = localStorage.getItem('auth_token')
  const location = useLocation()
  if (!token) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }
  return children
}

function AdminRoute({ children }) {
  const token = localStorage.getItem('auth_token')
  const user = JSON.parse(localStorage.getItem('auth_user') || '{}')
  const location = useLocation()
  if (!token) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }
  if (user?.role !== 'admin') {
    return <Navigate to="/deals" replace />
  }
  return children
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/calculator"
          element={
            <PrivateRoute>
              <App />
            </PrivateRoute>
          }
        />
        <Route
          path="/deals/*"
          element={
            <PrivateRoute>
              <DealsApp />
            </PrivateRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <AdminRoute>
              <Users />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/units"
          element={
            <AdminRoute>
              <Units />
            </AdminRoute>
          }
        />
        <Route path="/" element={<Navigate to="/deals" replace />} />
        <Route path="*" element={<Navigate to="/deals" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
)