import React, { useEffect, useState } from 'react';
import AdminSidebar from '../components/AdminSidebar.jsx';
import { fetchWithAuth, API_URL } from '../lib/apiClient.js';
import LoadingButton from '../components/LoadingButton.jsx';
import SkeletonRow from '../components/SkeletonRow.jsx';
import { notifyError, notifySuccess } from '../lib/notifications.js';
import ConfirmModal from '../components/ConfirmModal.jsx';

export default function RejectedPricings() {
  const user = JSON.parse(localStorage.getItem('auth_user') || '{}');
  const role = user?.role;
  const [pricings, setPricings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [rowLoading, setRowLoading] = useState({});

  // editable form state (for resubmission)
  const [price, setPrice] = useState('');
  const [maintenance_price, setMaintenancePrice] = useState('');
  const [garage_price, setGaragePrice] = useState('');
  const [garden_price, setGardenPrice] = useState('');
  const [roof_price, setRoofPrice] = useState('');
  const [storage_price, setStoragePrice] = useState('');
  const [dpPercent, setDpPercent] = useState(20);
  const [years, setYears] = useState(5);
  const [frequency, setFrequency] = useState('monthly');
  const [annualRate, setAnnualRate] = useState(12);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError('');
        const res = await fetchWithAuth(`${API_URL}/api/pricing/unit-model`);
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error?.message || 'Failed to load pricings');
        setPricings((data.pricings || []).filter(p => p.status === 'rejected'));
      } catch (e) {
        const msg = e.message || String(e);
        setError(msg);
        notifyError(e, 'Failed to load rejected pricings');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function startEdit(p) {
    setEditing(p);
    setPrice(String(p.price ?? ''));
    setMaintenancePrice(String(p.maintenance_price ?? ''));
    setGaragePrice(String(p.garage_price ?? ''));
    setGardenPrice(String(p.garden_price ?? ''));
    setRoofPrice(String(p.roof_price ?? ''));
    setStoragePrice(String(p.storage_price ?? ''));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const [confirmDelete, setConfirmDelete] = useState(null);

  async function performDelete(p) {
    const key = `delete:${p.id}`;
    try {
      setRowLoading(s => ({ ...s, [key]: true }));
      const res = await fetchWithAuth(`${API_URL}/api/pricing/unit-model/${p.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || 'Delete failed');
      setPricings(pricings => pricings.filter(x => x.id !== p.id));
      if (editing?.id === p.id) setEditing(null);
      notifySuccess('Rejected pricing request deleted successfully.');
    } catch (e) {
      notifyError(e, 'Delete failed');
    } finally {
      setRowLoading(s => ({ ...s, [key]: false }));
    }
  }

  async function resubmit(e) {
    e && e.preventDefault();
    if (!editing) return;
    try {
      // Enforce garden/roof constraints
      const hasGarden = !!editing.has_garden || (editing.garden_area != null ? Number(editing.garden_area) > 0 : false);
      const hasRoof = !!editing.has_roof || (editing.roof_area != null ? Number(editing.roof_area) > 0 : false);
      if (!hasGarden && Number(garden_price || 0) > 0) {
        throw new Error('This unit model has no garden. Garden price must be N.A or empty.');
      }
      if (!hasRoof && Number(roof_price || 0) > 0) {
        throw new Error('This unit model has no roof. Roof price must be N.A or empty.');
      }

      const body = {
        model_id: Number(editing.model_id || editing.model_id_fk || editing.model?.id || editing.modelId),
        price: Number(price),
        maintenance_price: maintenance_price === '' ? 0 : Number(maintenance_price),
        garage_price: garage_price === '' ? 0 : Number(garage_price),
        garden_price: garden_price === '' ? 0 : Number(garden_price),
        roof_price: roof_price === '' ? 0 : Number(roof_price),
        storage_price: storage_price === '' ? 0 : Number(storage_price),
        // carry calculation terms (optional, server may ignore)
        dp_percent: Number(dpPercent),
        plan_years: Number(years),
        installment_frequency: frequency,
        annual_financial_rate_percent: Number(annualRate),
      };

      const res = await fetchWithAuth(`${API_URL}/api/pricing/unit-model`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || 'Resubmission failed');

      // Remove old rejected from local list and optionally add newly created request
      setPricings(prev => prev.filter(x => x.id !== editing.id));
      setEditing(null);
      notifySuccess('Resubmitted for approval');
    } catch (e) {
      notifyError(e, 'Resubmission failed');
    }
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <AdminSidebar role={user?.role} />
      
      <main className="flex-1 overflow-y-auto ml-0 md:ml-64 lg:ml-0 p-6">
        <div className="w-full mx-auto space-y-6">

            <div className="flex items-center justify-between">
                <div>
                     <h2 className="text-3xl font-display font-bold text-primary tracking-wide">Rejected Pricings</h2>
                     <p className="text-sm text-gray-500 mt-1">Review, Edit, and Resubmit rejected pricing proposals.</p>
                </div>
                <a href="/admin/standard-pricing" className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary">
                   &larr; Back to Standard Pricing
                </a>
            </div>

            {role !== 'financial_manager' && (
                <div className="bg-red-50 p-4 rounded-md text-red-700 border border-red-200">
                    Only Financial Managers can access this page.
                </div>
            )}

            {editing && (
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 transition-all">
                    <h3 className="text-lg font-medium text-gray-900 mb-4 pb-2 border-b border-gray-100">Edit & Resubmit: <span className="text-primary">{editing.model_name}</span></h3>
                    <form onSubmit={resubmit} className="space-y-6">
                         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                             <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Base Unit Price (EGP)</label>
                                <input type="number" value={price} onChange={e => setPrice(e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm" />
                             </div>
                             <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Garden Price (EGP)</label>
                                <input
                                  type="number"
                                  value={garden_price}
                                  onChange={e => setGardenPrice(e.target.value)}
                                  placeholder={editing?.has_garden ? 'e.g. 120,000' : 'N.A (no garden)'}
                                  disabled={!editing?.has_garden}
                                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm disabled:bg-gray-50 disabled:text-gray-400"
                                />
                             </div>
                             <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Roof Price (EGP)</label>
                                <input
                                  type="number"
                                  value={roof_price}
                                  onChange={e => setRoofPrice(e.target.value)}
                                  placeholder={editing?.has_roof ? 'e.g. 180,000' : 'N.A (no roof)'}
                                  disabled={!editing?.has_roof}
                                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm disabled:bg-gray-50 disabled:text-gray-400"
                                />
                             </div>
                             <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Storage Price (EGP)</label>
                                <input type="number" value={storage_price} onChange={e => setStoragePrice(e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm" />
                             </div>
                             <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Garage Price (EGP)</label>
                                <input type="number" value={garage_price} onChange={e => setGaragePrice(e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm" />
                             </div>
                             <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Maintenance Price (EGP)</label>
                                <input type="number" value={maintenance_price} onChange={e => setMaintenancePrice(e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm" />
                             </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 bg-gray-50 p-4 rounded-md border border-gray-200">
                             <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Down Payment (%)</label>
                                <input type="number" value={dpPercent} onChange={e => setDpPercent(e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm" />
                             </div>
                             <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Duration (years)</label>
                                <input type="number" value={years} onChange={e => setYears(e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm" />
                             </div>
                             <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
                                <select value={frequency} onChange={e => setFrequency(e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm">
                                  <option value="monthly">monthly</option>
                                  <option value="quarterly">quarterly</option>
                                  <option value="bi-annually">bi-annually</option>
                                  <option value="annually">annually</option>
                                </select>
                             </div>
                             <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Annual Rate (%)</label>
                                <input type="number" value={annualRate} onChange={e => setAnnualRate(e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm" />
                             </div>
                        </div>

                        <div className="flex gap-3 justify-end pt-4">
                             <LoadingButton type="button" onClick={() => setEditing(null)} className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 shadow-sm">
                                Cancel
                             </LoadingButton>
                             <LoadingButton type="submit" className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary/90 shadow-sm">
                                Resubmit Proposal
                             </LoadingButton>
                        </div>
                    </form>
                </div>
            )}

            {error && <div className="p-4 bg-red-50 text-red-700 rounded-md border border-red-100">{error}</div>}

            <div className="bg-white shadow ring-1 ring-black ring-opacity-5 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-300">
                        <thead className="bg-gray-50">
                            <tr>
                                <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 sm:pl-6 sticky left-0 bg-gray-50 z-10">ID</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Model</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Code</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Area</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Price</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Garden</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Roof</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Storage</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Garage</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Maint</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Rejected By</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Reason</th>
                                <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6 sticky right-0 bg-gray-50 z-10"><span className="sr-only">Actions</span></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                            {loading && Array.from({ length: 5 }).map((_, i) => (
                                <tr key={i}><td colSpan={13} className="px-3 py-4"><SkeletonRow widths={['lg']} /></td></tr>
                            ))}
                            {!loading && pricings.map(p => (
                                <tr key={p.id} className="hover:bg-gray-50 transition-colors group">
                                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6 sticky left-0 bg-white group-hover:bg-gray-50 z-10 border-r border-gray-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">{p.id}</td>
                                    <td className="whitespace-nowrap px-3 py-4 text-sm font-medium text-gray-900">{p.model_name}</td>
                                    <td className="whitespace-nowrap px-3 py-4 text-xs text-gray-500 font-mono">{p.model_code || ''}</td>
                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{Number(p.area || 0).toLocaleString()}</td>
                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900">{Number(p.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{
                                        (() => {
                                        const hasGarden = p.has_garden ?? (p.garden_area != null ? Number(p.garden_area) > 0 : null);
                                        const val = Number(p.garden_price || 0);
                                        if (hasGarden === false) return <span className="text-gray-300">N.A</span>;
                                        return val ? val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : (hasGarden === false ? 'N.A' : '0.00');
                                        })()
                                    }</td>
                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{
                                        (() => {
                                        const hasRoof = p.has_roof ?? (p.roof_area != null ? Number(p.roof_area) > 0 : null);
                                        const val = Number(p.roof_price || 0);
                                        if (hasRoof === false) return <span className="text-gray-300">N.A</span>;
                                        return val ? val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : (hasRoof === false ? 'N.A' : '0.00');
                                        })()
                                    }</td>
                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{Number(p.storage_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{Number(p.garage_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{Number(p.maintenance_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{p.approved_by_email || ''}</td>
                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-red-600 italic">{p.reject_reason || p.reason || ''}</td>
                                    <td className="whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6 sticky right-0 bg-white group-hover:bg-gray-50 z-10 border-l border-gray-100 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                                         <div className="flex gap-2 justify-end">
                                            <LoadingButton 
                                                onClick={() => startEdit(p)}
                                                className="inline-flex items-center px-2.5 py-1.5 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary shadow-sm"
                                            >
                                                Edit
                                            </LoadingButton>
                                            <LoadingButton
                                                onClick={() => setConfirmDelete(p)}
                                                loading={rowLoading[`delete:${p.id}`]}
                                                className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 shadow-sm"
                                            >
                                                Delete
                                            </LoadingButton>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {!loading && pricings.length === 0 && (
                                <tr><td colSpan={13} className="px-3 py-8 text-center text-sm text-gray-500">No rejected requests found.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
      </main>

      <ConfirmModal
        open={!!confirmDelete}
        title="Delete Rejected Pricing"
        message="Are you sure you want to delete this rejected pricing request?"
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={() => {
          const p = confirmDelete;
          setConfirmDelete(null);
          performDelete(p);
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}