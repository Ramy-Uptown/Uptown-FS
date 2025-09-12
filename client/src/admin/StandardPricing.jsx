import React, { useState, useEffect } from 'react';
import { fetchWithAuth } from '../lib/apiClient.js';

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

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

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

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Standard Pricing</h1>

      {role === 'financial_manager' && (
        <form onSubmit={handleCreatePricing} className="mb-8 p-4 border rounded shadow">
          <h2 className="text-xl font-bold mb-2">Create New Standard Price</h2>
          <div className="flex gap-4">
            <select
              value={selectedUnit}
              onChange={(e) => setSelectedUnit(e.target.value)}
              required
              className="p-2 border rounded"
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
              className="p-2 border rounded"
            />
            <button type="submit" className="px-4 py-2 bg-blue-500 text-white rounded">Create</button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full bg-white">
          <thead>
            <tr>
              <th className="py-2 px-4 border-b">Unit</th>
              <th className="py-2 px-4 border-b">Price</th>
              <th className="py-2 px-4 border-b">Status</th>
              <th className="py-2 px-4 border-b">Created By</th>
              <th className="py-2 px-4 border-b">Approved By</th>
              <th className="py-2 px-4 border-b">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pricings.map(p => (
              <tr key={p.id}>
                <td className="py-2 px-4 border-b">{p.unit_code}</td>
                <td className="py-2 px-4 border-b">{p.price}</td>
                <td className="py-2 px-4 border-b">{p.status}</td>
                <td className="py-2 px-4 border-b">{p.created_by_email}</td>
                <td className="py-2 px-4 border-b">{p.approved_by_email || 'N/A'}</td>
                <td className="py-2 px-4 border-b">
                  {role === 'ceo' && p.status === 'pending_approval' && (
                    <div className="flex gap-2">
                      <button onClick={() => handleUpdateStatus(p.id, 'approved')} className="px-2 py-1 bg-green-500 text-white rounded">Approve</button>
                      <button onClick={() => handleUpdateStatus(p.id, 'rejected')} className="px-2 py-1 bg-red-500 text-white rounded">Reject</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
