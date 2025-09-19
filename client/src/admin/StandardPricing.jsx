import React, { useState, useEffect } from 'react';
import { fetchWithAuth } from '../lib/apiClient.js';
import { th, td, ctrl, btnPrimary, btnSuccess, btnDanger, tableWrap, table, pageContainer, pageTitle, errorText, metaText } from '../lib/ui.js';
import BrandHeader from '../lib/BrandHeader.jsx';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export default function StandardPricing() {
  const [pricings, setPricings] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const user = JSON.parse(localStorage.getItem('auth_user') || '{}');
  const role = user?.role;

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const [pricingsRes, unitsRes] = await Promise.all([
          fetchWithAuth(`${API_URL}/api/pricing/standard`),
          fetchWithAuth(`${API_URL}/api/units`)
        ]);

        if (!pricingsRes.ok || !unitsRes.ok) {
          throw new Error('Failed to fetch data');
        }

        const pricingsData = await pricingsRes.json();
        const unitsData = await unitsRes.json();

        setPricings(pricingsData.pricings);
        setUnits(unitsData.units);
      } catch (e) {
        setError(e.message || 'An error occurred');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const [newPrice, setNewPrice] = useState('');
  const [selectedUnit, setSelectedUnit] = useState('');

  const handleCreatePricing = async (e) => {
    e.preventDefault();
    try {
      const res = await fetchWithAuth(`${API_URL}/api/pricing/standard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unit_id: selectedUnit, price: newPrice }),
      });
      if (!res.ok) throw new Error('Failed to create pricing');
      const data = await res.json();
      setPricings([data.pricing, ...pricings]);
      setNewPrice('');
      setSelectedUnit('');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleUpdateStatus = async (id, status) => {
    try {
      const res = await fetchWithAuth(`${API_URL}/api/pricing/standard/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Failed to update status');
      const data = await res.json();
      setPricings(pricings.map(p => p.id === id ? data.pricing : p));
    } catch (err) {
      setError(err.message);
    }
  };

  const handleLogout = async () => {
    try {
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

  if (loading) {
    return (
      <div>
        <BrandHeader onLogout={handleLogout} />
        <div style={pageContainer}>Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <BrandHeader onLogout={handleLogout} />
        <div style={pageContainer}><p style={errorText}>Error: {error}</p></div>
      </div>
    );
  }

  return (
    <div>
      <BrandHeader onLogout={handleLogout} />
      <div style={pageContainer}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={pageTitle}>Standard Pricing</h2>
          {role === 'financial_manager' ? (
            <a href="/admin/unit-models" style={{ ...btnPrimary, textDecoration: 'none', display: 'inline-block' }}>
              Manage Unit Models
            </a>
          ) : null}
        </div>

        {role === 'financial_manager' && (
          <form onSubmit={handleCreatePricing} style={{ border: '1px solid #e6eaf0', borderRadius: 12, padding: 16, marginBottom: 16, boxShadow: '0 2px 6px rgba(21,24,28,0.04)' }}>
            <h3 style={{ marginTop: 0, marginBottom: 8 }}>Create New Standard Price</h3>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <select
                value={selectedUnit}
                onChange={(e) => setSelectedUnit(e.target.value)}
                required
                style={ctrl}
              >
                <option value="">Select a Unit</option>
                {units.map(unit => (
                  <option key={unit.id} value={unit.id}>{unit.code} - {unit.description}</option>
                ))}
              </select>
              <input
                type="number"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                placeholder="Price"
                required
                style={ctrl}
              />
              <button type="submit" style={btnPrimary}>Create</button>
            </div>
          </form>
        )}

        <div style={tableWrap}>
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>Unit</th>
                <th style={th}>Price</th>
                <th style={th}>Status</th>
                <th style={th}>Created By</th>
                <th style={th}>Approved By</th>
                <th style={th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pricings.map(p => (
                <tr key={p.id}>
                  <td style={td}>{p.unit_code}</td>
                  <td style={td}>{p.price}</td>
                  <td style={td}>{p.status}</td>
                  <td style={td}>{p.created_by_email}</td>
                  <td style={td}>{p.approved_by_email || 'N/A'}</td>
                  <td style={td}>
                    {role === 'ceo' && p.status === 'pending_approval' && (
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button onClick={() => handleUpdateStatus(p.id, 'approved')} style={btnSuccess}>Approve</button>
                        <button onClick={() => handleUpdateStatus(p.id, 'rejected')} style={btnDanger}>Reject</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {pricings.length === 0 && (
                <tr>
                  <td style={td} colSpan={6}>No standard pricing entries.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
