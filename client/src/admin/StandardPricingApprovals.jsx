import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { fetchWithAuth, API_URL } from '../lib/apiClient.js';
import { Link } from 'react-router-dom';
import BrandHeader from '../lib/BrandHeader.jsx';

export default function StandardPricingApprovals() {
    const [pendingPricings, setPendingPricings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchPendingPricings = async () => {
        setLoading(true);
        try {
            const response = await fetchWithAuth(`${API_URL}/api/pricing/unit-model/pending`);
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error?.message || 'Failed to fetch data');
            }
            setPendingPricings(data.pendingPricings || []);
        } catch (err) {
            setError('Failed to load pending standard pricing approvals.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPendingPricings();
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
        toast.info('You have been logged out.');
        window.location.href = '/login';
    };

    const handleAction = async (id, status) => {
        const actionText = status === 'approved' ? 'approve' : 'reject';
        if (window.confirm(`Are you sure you want to ${actionText} this pricing?`)) {
            try {
                const response = await fetchWithAuth(`${API_URL}/api/pricing/unit-model/${id}/status`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status }),
                });
                if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data.error?.message || `Failed to ${actionText} pricing.`);
                }
                toast.success(`Pricing has been ${status}.`);
                fetchPendingPricings(); // Refresh the list
            } catch (err) {
                toast.error(err.message);
                console.error(err);
            }
        }
    };

    return (
        <div>
            <BrandHeader onLogout={handleLogout} />
            <div className="container mx-auto p-4">
                <h1 className="text-2xl font-bold mb-4">Standard Pricing Approval Queue</h1>
                {loading && <p>Loading...</p>}
                {error && <p className="text-red-500">{error}</p>}
                {!loading && !error && (
                    pendingPricings.length === 0 ? <p>No items are currently waiting for approval.</p> :
                    <div className="overflow-x-auto">
                        <table className="min-w-full bg-white border border-gray-200 shadow-sm rounded-lg">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Model Name</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Model Code</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price (EGP)</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Requested By</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {pendingPricings.map((item) => (
                                    <tr key={item.id}>
                                        <td className="px-4 py-4 whitespace-nowrap font-semibold">{item.model_name}</td>
                                        <td className="px-4 py-4 whitespace-nowrap">{item.model_code}</td>
                                        <td className="px-4 py-4 whitespace-nowrap">{Number(item.price).toLocaleString()}</td>
                                        <td className="px-4 py-4 whitespace-nowrap">{item.created_by_email}</td>
                                        <td className="px-4 py-4 whitespace-nowrap space-x-2">
                                            <button
                                                onClick={() => handleAction(item.id, 'approved')}
                                                className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-3 rounded text-sm"
                                            >
                                                Approve
                                            </button>
                                            <button
                                                onClick={() => handleAction(item.id, 'rejected')}
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
        </div>
    );
}