import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import App from './App.jsx'
import Login from './Login.jsx'
import DealsApp from './deals/App.jsx'
import Users from './admin/Users.jsx'
import Units from './admin/Units.jsx'
import SalesTeam from './admin/SalesTeam.jsx'
import CommissionPolicies from './admin/CommissionPolicies.jsx'
import CommissionsReport from './admin/CommissionsReport.jsx'
import StandardPricing from './admin/StandardPricing.jsx'

function RoleBasedRoute({ children, allowedRoles }) {
  const token = localStorage.getItem('auth_token');
  const user = JSON.parse(localStorage.getItem('auth_user') || '{}');
  const location = useLocation();

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!allowedRoles.includes(user?.role)) {
    return <Navigate to="/deals" replace />;
  }

  return children;
}

function PrivateRoute({ children }) {
  const token = localStorage.getItem('auth_token')
  const location = useLocation()
  if (!token) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }
  return children
}

function AdminRoute({ children }) {
  return <RoleBasedRoute allowedRoles={['admin']}>{children}</RoleBasedRoute>;
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
          path="/admin/standard-pricing"
          element={
            <RoleBasedRoute allowedRoles={['financial_manager', 'ceo']}>
              <StandardPricing />
            </RoleBasedRoute>
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
        <Route
          path="/admin/sales"
          element={
            <AdminRoute>
              <SalesTeam />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/commission-policies"
          element={
            <AdminRoute>
              <CommissionPolicies />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/commissions"
          element={
            <AdminRoute>
              <CommissionsReport />
            </AdminRoute>
          }
        />
        <Route path="/" element={<Navigate to="/deals" replace />} />
        <Route path="*" element={<Navigate to="/deals" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
)