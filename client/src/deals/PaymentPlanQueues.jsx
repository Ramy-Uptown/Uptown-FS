import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { fetchWithAuth } from '../lib/apiClient.js';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export default function UnitModelQueues() {
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchApprovals = async () => {
    setLoading(true);
    try {
      // This is the correct endpoint from your backend inventoryRoutes.js file
      const response = await fetchWithAuth(`${API_URL}/api/inventory/unit-models/changes`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to fetch data');
      }
      
      setApprovals(data.changes);
    } catch (err) {
      setError('Failed to load unit model approvals.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApprovals();
  }, []);

  const handleApprove = async (id) => {
    if (window.confirm('Are you sure you want to approve this change?')) {
      try {
        const response = await fetchWithAuth(`${API_URL}/api/inventory/unit-models/changes/${id}/approve`, { method: 'PATCH' });
         if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error?.message || 'Approval failed');
        }
        toast.success('Change approved successfully!');
        fetchApprovals(); // Refresh the list
      } catch (err) {
        toast.error(err.message || 'Failed to approve change.');
        console.error(err);
      }
    }
  };

  const handleReject = async (id) => {
    const reason = prompt('Please provide a reason for rejection:');
    if (reason) {
      try {
        const response = await fetchWithAuth(`${API_URL}/api/inventory/unit-models/changes/${id}/reject`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason })
        });
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error?.message || 'Rejection failed');
        }
        toast.warn('Change rejected.');
        fetchApprovals(); // Refresh the list
      } catch (err) {
        toast.error(err.message || 'Failed to reject change.');
        console.error(err);
      }
    }
  };

  const renderPayload = (payload) => (
    <ul className="list-disc pl-5 text-xs">
      {Object.entries(payload).map(([key, value]) => (
        <li key={key}>
          <strong>{key}:</strong> {JSON.stringify(value)}
        </li>
      ))}
    </ul>
  );

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Unit Model Approval Queue</h1>
      {loading && <p>Loading...</p>}
      {error && <p className="text-red-500">{error}</p>}
      {!loading && !error && (
        approvals.length === 0 ? <p>No items are currently waiting for approval.</p> :
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200 shadow-sm rounded-lg">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Requested By</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {approvals.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-4 whitespace-nowrap capitalize font-semibold">{item.action}</td>
                  <td className="px-4 py-4">{renderPayload(item.payload)}</td>
                  <td className="px-4 py-4 whitespace-nowrap">{item.requested_by_email}</td>
                  <td className="px-4 py-4 whitespace-nowrap space-x-2">
                    <button
                      onClick={() => handleApprove(item.id)}
                      className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-3 rounded text-sm"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleReject(item.id)}
                      className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-3 rounded text-sm"
                    >
                      Reject
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};