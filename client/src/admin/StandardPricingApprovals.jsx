import React, { useEffect, useState } from 'react';
import { fetchWithAuth, API_URL } from '../lib/apiClient.js';
import AdminSidebar from '../components/AdminSidebar.jsx';
import LoadingButton from '../components/LoadingButton.jsx';
import SkeletonRow from '../components/SkeletonRow.jsx';
import { notifyError, notifySuccess } from '../lib/notifications.js';

function fmt(n) {
  const v = Number(n || 0);
  return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function hasFeature(flag, area) {
  if (flag != null) return !!flag;
  const a = Number(area);
  return Number.isFinite(a) && a > 0;
}

export default function StandardPricingApprovals() {
    const [pendingPricings, setPendingPricings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [rowLoading, setRowLoading] = useState({});
    
    const user = JSON.parse(localStorage.getItem('auth_user') || '{}');

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
            const msg = err.message || 'Failed to load pending standard pricing approvals.';
            setError(msg);
            notifyError(err, msg);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPendingPricings();
    }, []);

    const handleAction = async (id, status) => {
        const actionText = status === 'approved' ? 'approve' : 'reject';
        if (window.confirm(`Are you sure you want to ${actionText} this pricing?`)) {
            try {
                setRowLoading(s => ({ ...s, [id]: true }));
                const response = await fetchWithAuth(`${API_URL}/api/pricing/unit-model/${id}/status`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status }),
                });
                if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data.error?.message || `Failed to ${actionText} pricing.`);
                }
                notifySuccess(`Pricing has been ${status}.`);
                fetchPendingPricings(); // Refresh the list
            } catch (err) {
                notifyError(err, err.message || `Failed to ${actionText} pricing.`);
            } finally {
                setRowLoading(s => ({ ...s, [id]: false }));
            }
        }
    };

    return (
        <div className="flex h-screen bg-gray-50">
            <AdminSidebar role={user?.role} />
            
            <main className="flex-1 overflow-y-auto ml-0 md:ml-64 p-6">
                <div className="w-full mx-auto space-y-6">

                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-3xl font-display font-bold text-primary tracking-wide">Pricing Approvals</h2>
                            <p className="text-sm text-gray-500 mt-1">Review and approve standard pricing proposals.</p>
                        </div>
                    </div>

                    {error && <div className="p-4 bg-red-50 text-red-700 rounded-md border border-red-100">{error}</div>}

                    <div className="bg-white shadow ring-1 ring-black ring-opacity-5 rounded-lg overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-300">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 sm:pl-6 sticky left-0 bg-gray-50 z-10">Model</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Code</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Area (m²)</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Base (EGP)</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Garden (EGP)</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Roof (EGP)</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Storage (EGP)</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Garage (EGP)</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Maint. (EGP)</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 font-bold bg-gray-100">Total (EGP)</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Price / m²</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Rate (%)</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Years</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Freq</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Calc. PV</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">By</th>
                                        <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6 sticky right-0 bg-gray-50 z-10"><span className="sr-only">Actions</span></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 bg-white">
                                    {loading && (
                                        Array.from({ length: 8 }).map((_, i) => (
                                            <tr key={i}><td colSpan={17} className="px-3 py-4"><SkeletonRow widths={['lg']} /></td></tr>
                                        ))
                                    )}
                                    {!loading && pendingPricings.map((item) => {
                                        const showGarden = hasFeature(item.has_garden, item.garden_area);
                                        const showRoof = hasFeature(item.has_roof, item.roof_area);
                                        const total = Number(item.price || 0)
                                          + (showGarden ? Number(item.garden_price || 0) : 0)
                                          + (showRoof ? Number(item.roof_price || 0) : 0)
                                          + Number(item.storage_price || 0)
                                          + Number(item.garage_price || 0);
                                        const area = Number(item.area || 0);
                                        const pricePerSqM = area > 0 ? (total / area) : 0;
                                        return (
                                        <tr key={item.id} className="hover:bg-gray-50 transition-colors group">
                                            <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6 sticky left-0 bg-white group-hover:bg-gray-50 z-10 border-r border-gray-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">{item.model_name}</td>
                                            <td className="whitespace-nowrap px-3 py-4 text-xs text-gray-500 font-mono">{item.model_code || ''}</td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{Number(item.area || 0).toLocaleString()}</td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900">{fmt(item.price)}</td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{showGarden ? fmt(item.garden_price) : <span className="text-gray-300">-</span>}</td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{showRoof ? fmt(item.roof_price) : <span className="text-gray-300">-</span>}</td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{fmt(item.storage_price)}</td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{fmt(item.garage_price)}</td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{fmt(item.maintenance_price)}</td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm font-bold text-gray-900 bg-gray-50 group-hover:bg-gray-100">{fmt(total)}</td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm text-blue-600 font-medium">{fmt(pricePerSqM)}</td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{Number(item.std_financial_rate_percent ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{Number(item.plan_duration_years ?? 0)}</td>
                                            <td className="whitespace-nowrap px-3 py-4 text-xs text-gray-500 uppercase">{String(item.installment_frequency || '').toLowerCase()}</td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 font-mono text-xs">{fmt(item.calculated_pv)}</td>
                                            <td className="whitespace-nowrap px-3 py-4 text-xs text-gray-500">{item.created_by_email}</td>
                                            <td className="whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6 sticky right-0 bg-white group-hover:bg-gray-50 z-10 border-l border-gray-100 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                                                <div className="flex gap-2 justify-end">
                                                    <LoadingButton
                                                        onClick={() => handleAction(item.id, 'approved')}
                                                        loading={rowLoading[item.id]}
                                                        className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-green-700 bg-green-100 hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 shadow-sm"
                                                    >
                                                        Approve
                                                    </LoadingButton>
                                                    <LoadingButton
                                                        onClick={() => handleAction(item.id, 'rejected')}
                                                        loading={rowLoading[item.id]}
                                                        className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 shadow-sm"
                                                    >
                                                        Reject
                                                    </LoadingButton>
                                                </div>
                                            </td>
                                        </tr>
                                    )})}
                                    {!loading && pendingPricings.length === 0 && (
                                        <tr><td colSpan={17} className="px-3 py-12 text-center text-sm text-gray-500">No items are currently waiting for approval.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    
                </div>
            </main>
        </div>
    );
}