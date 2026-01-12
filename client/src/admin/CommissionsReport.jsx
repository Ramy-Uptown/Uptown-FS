import React, { useEffect, useState } from 'react';
import AdminSidebar from '../components/AdminSidebar.jsx';
import { fetchWithAuth, API_URL } from '../lib/apiClient.js';
import LoadingButton from '../components/LoadingButton.jsx';
import { notifyError, notifySuccess } from '../lib/notifications.js';
import * as XLSX from 'xlsx';
import { useLoader } from '../lib/loaderContext.jsx';
import SkeletonRow from '../components/SkeletonRow.jsx';

/**
 * CommissionsReport Component
 * Displays a filterable report of sales commissions.
 */
export default function CommissionsReport() {
    const user = JSON.parse(localStorage.getItem('auth_user') || '{}');
    
    // State for the commission data, total, and loading/error status
    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    // State for populating the filter dropdowns
    const [salesPeople, setSalesPeople] = useState([]);
    const [policies, setPolicies] = useState([]);

    // State for the currently selected filter values
    const [filters, setFilters] = useState({
        sales_person_id: '',
        policy_id: '',
        startDate: '',
        endDate: '',
    });

    const { setShow, setMessage } = useLoader();

    // Effect to load data for the filter dropdowns on initial component mount
    useEffect(() => {
        async function loadFilterOptions() {
            try {
                // Fetch sales people and policies in parallel for efficiency
                const [salesRes, policiesRes] = await Promise.all([
                    fetchWithAuth(`${API_URL}/api/sales?page=1&pageSize=200`).then(r => r.json()),
                    fetchWithAuth(`${API_URL}/api/commission-policies?page=1&pageSize=100`).then(r => r.json())
                ]);

                if (salesRes?.sales) setSalesPeople(salesRes.sales);
                if (policiesRes?.policies) setPolicies(policiesRes.policies);

            } catch (err) {
                setError("Unable to load filter options. Please try again later.");
                notifyError(err, 'Unable to load filter options');
            }
        }
        loadFilterOptions();
    }, []); // Empty dependency array means this effect runs only once on mount

    // Main function to fetch the commissions report from the API
    async function loadReport() {
        setIsLoading(true);
        setError('');
        try {
            // Construct query parameters from the current filter state
            const q = new URLSearchParams();
            if (filters.sales_person_id) q.set('sales_person_id', filters.sales_person_id);
            if (filters.policy_id) q.set('policy_id', filters.policy_id);
            if (filters.startDate) q.set('startDate', filters.startDate);
            if (filters.endDate) q.set('endDate', filters.endDate);

            const resp = await fetchWithAuth(`${API_URL}/api/commissions/report?${q.toString()}`);
            const data = await resp.json();

            if (!resp.ok) {
                throw new Error(data?.error?.message || 'Unable to load report');
            }

            setRows(data.commissions || []);
            setTotal(Number(data.total || 0));
            notifySuccess('Report loaded successfully.');

        } catch (e) {
            const msg = e.message || String(e);
            setError(msg);
            notifyError(e, 'Unable to load report');
        } finally {
            setIsLoading(false);
        }
    }

    // Effect to load the report on initial component mount
    useEffect(() => {
        loadReport();
    }, []); // This only runs once, subsequent loads are triggered by the "Apply Filters" button

    // Generic handler to update the filters state
    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prevFilters => ({
            ...prevFilters,
            [name]: value,
        }));
    };

    // Helper function to format currency consistently
    const formatCurrency = (amount) => {
        return Number(amount || 0).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
    };
    
    // Helper function to format dates consistently
    const formatDate = (dateString) => {
        if (!dateString) return '';
        return new Date(dateString).toLocaleString();
    };

    function exportXLSX() {
        if (!rows || rows.length === 0) return;
        try {
            setMessage('Generating report, please wait...');
            setShow(true);

            const headers = [
                { key: 'id', label: 'ID' },
                { key: 'deal_title', label: 'Deal' },
                { key: 'sales_name', label: 'Sales Person' },
                { key: 'policy_name', label: 'Policy' },
                { key: 'amount', label: 'Amount' },
                { key: 'calculated_at', label: 'Calculated At' },
            ];
            const aoa = [headers.map(h => h.label), ...rows.map(r => headers.map(h => r[h.key] ?? ''))];
            const ws = XLSX.utils.aoa_to_sheet(aoa);
            ws['!cols'] = [ { wch: 8 }, { wch: 24 }, { wch: 20 }, { wch: 20 }, { wch: 12 }, { wch: 20 } ];

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Commissions');
            const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
            const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const ts = new Date().toISOString().replace(/[:.]/g, '-');
            a.download = `commissions_report_${ts}.xlsx`;
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            URL.revokeObjectURL(url);
            notifySuccess('Export completed successfully.');
        } catch (e) {
            notifyError(e, 'Export failed');
        } finally {
            setShow(false);
        }
    }

    function exportCSV() {
        if (!rows || rows.length === 0) return;
        try {
            setMessage('Generating report, please wait...');
            setShow(true);
            const headers = ['ID', 'Deal', 'Sales Person', 'Policy', 'Amount', 'Calculated At'];
            const getRow = (r) => [r.id, r.deal_title ?? r.deal_id, r.sales_name ?? r.sales_person_id, r.policy_name ?? r.policy_id, r.amount, r.calculated_at];
            const csv = [headers.join(','), ...rows.map(r => getRow(r).map(v => {
                const s = v == null ? '' : String(v);
                return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
            }).join(','))].join('\n');
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const ts = new Date().toISOString().replace(/[:.]/g, '-');
            a.download = `commissions_report_${ts}.csv`;
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            URL.revokeObjectURL(url);
            notifySuccess('Export completed successfully.');
        } catch (e) {
            notifyError(e, 'Export failed');
        } finally {
            setShow(false);
        }
    }

    return (
        <div className="flex h-screen bg-gray-50">
            <AdminSidebar role={user?.role} />

            <main className="flex-1 overflow-y-auto ml-0 md:ml-64 p-6">
                 <div className="w-full mx-auto space-y-6">
                    
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-3xl font-display font-bold text-primary tracking-wide">Commissions Report</h2>
                            <p className="text-sm text-gray-500 mt-1">View and filter sales commission data.</p>
                        </div>
                    </div>

                    {/* Filter Controls */}
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 print:hidden">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 items-end">
                            <div className="space-y-1">
                                <label htmlFor="sales_person_id" className="block text-sm font-medium text-gray-700">Sales Person</label>
                                <select id="sales_person_id" name="sales_person_id" value={filters.sales_person_id} onChange={handleFilterChange} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm">
                                    <option value="">All Sales People</option>
                                    {salesPeople.map(s => <option key={s.id} value={s.id}>{s.name} {s.email ? `(${s.email})` : ''}</option>)}
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label htmlFor="policy_id" className="block text-sm font-medium text-gray-700">Policy</label>
                                <select id="policy_id" name="policy_id" value={filters.policy_id} onChange={handleFilterChange} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm">
                                    <option value="">All Policies</option>
                                    {policies.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </div>
                            
                            <div className="space-y-1">
                                <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">Start Date</label>
                                <input id="startDate" name="startDate" type="date" value={filters.startDate} onChange={handleFilterChange} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm" />
                            </div>

                            <div className="space-y-1">
                                 <label htmlFor="endDate" className="block text-sm font-medium text-gray-700">End Date</label>
                                <input id="endDate" name="endDate" type="date" value={filters.endDate} onChange={handleFilterChange} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm" />
                            </div>
                            
                            <LoadingButton onClick={loadReport} loading={isLoading} className="inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary shadow-sm w-full">
                                {isLoading ? 'Loading' : 'Apply Filters'}
                            </LoadingButton>
                            
                            <div className="flex gap-2">
                                <LoadingButton onClick={exportXLSX} disabled={!rows || rows.length === 0} className="w-1/2 justify-center py-2 px-2 text-xs bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-md shadow-sm font-medium">XLSX</LoadingButton>
                                <LoadingButton onClick={exportCSV} disabled={!rows || rows.length === 0} className="w-1/2 justify-center py-2 px-2 text-xs bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-md shadow-sm font-medium">CSV</LoadingButton>
                            </div>
                        </div>
                    </div>

                    {/* Display Error Message */}
                    {error && <p className="bg-red-50 text-red-700 p-4 rounded-lg border border-red-100">{error}</p>}

                    {/* Data Table */}
                    <div className="bg-white shadow ring-1 ring-black ring-opacity-5 rounded-lg overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-300">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 sm:pl-6">ID</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Deal</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Sales Person</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Policy</th>
                                        <th scope="col" className="px-3 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Amount</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Calculated At</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 bg-white">
                                    {isLoading && (
                                        Array.from({ length: 5 }).map((_, i) => (
                                            <tr key={i}><td colSpan={6} className="px-3 py-4"><SkeletonRow widths={['sm','lg','lg','lg','sm','lg']} /></td></tr>
                                        ))
                                    )}
                                    {!isLoading && rows.map(r => (
                                        <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">{r.id}</td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900">{r.deal_title || r.deal_id}</td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{r.sales_name || r.sales_person_id}</td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{r.policy_name || r.policy_id}</td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm text-right font-mono font-medium text-gray-900">{formatCurrency(r.amount)}</td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{formatDate(r.calculated_at)}</td>
                                        </tr>
                                    ))}
                                    {rows.length === 0 && !isLoading && (
                                        <tr>
                                            <td colSpan="6" className="px-3 py-12 text-center text-sm text-gray-500">No results found.</td>
                                        </tr>
                                    )}
                                </tbody>
                                <tfoot className="bg-gray-50">
                                    <tr>
                                        <td colSpan="4" className="py-3.5 pl-4 pr-3 text-right text-sm font-bold text-gray-900 sm:pl-6">Total</td>
                                        <td className="px-3 py-3.5 text-right text-sm font-bold font-mono text-gray-900">{formatCurrency(total)}</td>
                                        <td className="px-6 py-4"></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                 </div>
            </main>
        </div>
    );
}
