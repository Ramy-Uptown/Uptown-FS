import React, { useEffect, useState } from 'react';

// To make this a runnable, self-contained example, we'll create mock versions
// of the external dependencies you were importing.

// Mock for: BrandHeader from '../lib/BrandHeader.jsx'
const BrandHeader = ({ onLogout }) => (
    <header className="bg-gray-800 text-white p-4 flex justify-between items-center shadow-md print:hidden">
        <h1 className="text-xl font-bold">CommissionPro</h1>
        <button onClick={onLogout} className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg transition-colors">
            Logout
        </button>
    </header>
);

// Mock for: API_URL and fetchWithAuth from '../lib/apiClient.js'
const API_URL = '/api'; // A placeholder for your API's base URL

// This mock function simulates fetching data from your API.
const fetchWithAuth = async (url) => {
    console.log(`Mock Fetching: ${url}`);
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay

    const urlObj = new URL(url, 'http://localhost'); // Use a dummy base for URL parsing

    // Simulate fetching sales people for the filter dropdown
    if (urlObj.pathname.includes('/api/sales')) {
        return {
            ok: true,
            json: () => Promise.resolve({
                sales: [
                    { id: '1', name: 'Alice', email: 'alice@example.com' },
                    { id: '2', name: 'Bob', email: 'bob@example.com' },
                    { id: '3', name: 'Charlie', email: '' },
                ]
            }),
        };
    }

    // Simulate fetching policies for the filter dropdown
    if (urlObj.pathname.includes('/api/commission-policies')) {
        return {
            ok: true,
            json: () => Promise.resolve({
                policies: [
                    { id: 'p1', name: 'Standard 5% Policy' },
                    { id: 'p2', name: 'Premium 10% Policy' },
                    { id: 'p3', name: 'Enterprise Deal Policy' },
                ]
            }),
        };
    }

    // Simulate fetching the main report data
    if (urlObj.pathname.includes('/api/commissions/report')) {
        const sales_person_id = urlObj.searchParams.get('sales_person_id');
        const mockCommissions = [
            { id: 1, deal_title: 'Big Corp Deal', sales_name: 'Alice', policy_name: 'Premium 10% Policy', amount: 5000.00, calculated_at: new Date('2025-09-10T10:00:00Z').toISOString(), sales_person_id: '1' },
            { id: 2, deal_title: 'SME Package', sales_name: 'Bob', policy_name: 'Standard 5% Policy', amount: 750.50, calculated_at: new Date('2025-09-11T11:30:00Z').toISOString(), sales_person_id: '2' },
            { id: 3, deal_title: 'Startup Sale', sales_name: 'Alice', policy_name: 'Standard 5% Policy', amount: 300.00, calculated_at: new Date('2025-09-12T14:00:00Z').toISOString(), sales_person_id: '1' },
            { id: 4, deal_title: 'Enterprise Solution', sales_name: 'Charlie', policy_name: 'Enterprise Deal Policy', amount: 12000.75, calculated_at: new Date('2025-09-08T09:00:00Z').toISOString(), sales_person_id: '3' },
        ];
        const filteredCommissions = sales_person_id ? mockCommissions.filter(c => c.sales_person_id === sales_person_id) : mockCommissions;
        const total = filteredCommissions.reduce((sum, c) => sum + c.amount, 0);

        return {
            ok: true,
            json: () => Promise.resolve({ commissions: filteredCommissions, total }),
        };
    }
    
    // Default error response for any unhandled endpoint
    return {
        ok: false,
        json: () => Promise.resolve({ error: { message: 'Mock endpoint not found' } }),
    };
};
// End of mocks

/**
 * CommissionsReport Component
 * Displays a filterable report of sales commissions.
 */
export default function CommissionsReport() {
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
                console.error("Failed to load filter options:", err);
                setError("Could not load filter options. Please try again later.");
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
                throw new Error(data?.error?.message || 'Failed to load report');
            }

            setRows(data.commissions || []);
            setTotal(Number(data.total || 0));

        } catch (e) {
            setError(e.message || String(e));
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

    // Handler for user logout
    const handleLogout = async () => {
        try {
            const refreshToken = localStorage.getItem('refresh_token');
            if (refreshToken) {
                // Attempt to invalidate the token on the server, but don't block logout if it fails
                await fetch(`${API_URL}/api/auth/logout`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ refreshToken })
                }).catch((err) => console.error("Logout API call failed:", err));
            }
        } finally {
            // Always clear local storage and redirect the user to the login page
            localStorage.removeItem('auth_token');
            localStorage.removeItem('refresh_token');
            localStorage.removeItem('auth_user');
            window.location.href = '/login';
        }
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


    return (
        <div className="bg-gray-50 min-h-screen font-sans">
            <BrandHeader onLogout={handleLogout} />

            <main className="p-4 sm:p-6 md:p-8">
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-6">Commissions Report</h2>

                {/* Filter Controls */}
                <div className="bg-white p-4 rounded-lg shadow-sm mb-6 print:hidden">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 items-end">
                        <div className="flex flex-col">
                            <label htmlFor="sales_person_id" className="text-sm font-medium text-gray-600 mb-1">Sales Person</label>
                            <select id="sales_person_id" name="sales_person_id" value={filters.sales_person_id} onChange={handleFilterChange} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition">
                                <option value="">All Sales People</option>
                                {salesPeople.map(s => <option key={s.id} value={s.id}>{s.name} {s.email ? `(${s.email})` : ''}</option>)}
                            </select>
                        </div>

                        <div className="flex flex-col">
                            <label htmlFor="policy_id" className="text-sm font-medium text-gray-600 mb-1">Policy</label>
                            <select id="policy_id" name="policy_id" value={filters.policy_id} onChange={handleFilterChange} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition">
                                <option value="">All Policies</option>
                                {policies.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>
                        
                        <div className="flex flex-col">
                            <label htmlFor="startDate" className="text-sm font-medium text-gray-600 mb-1">Start Date</label>
                            <input id="startDate" name="startDate" type="date" value={filters.startDate} onChange={handleFilterChange} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition" />
                        </div>

                        <div className="flex flex-col">
                             <label htmlFor="endDate" className="text-sm font-medium text-gray-600 mb-1">End Date</label>
                            <input id="endDate" name="endDate" type="date" value={filters.endDate} onChange={handleFilterChange} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition" />
                        </div>
                        
                        <button onClick={loadReport} disabled={isLoading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors disabled:bg-blue-300 disabled:cursor-not-allowed flex items-center justify-center">
                            {isLoading && (
                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            )}
                            {isLoading ? 'Loading...' : 'Apply Filters'}
                        </button>
                    </div>
                </div>

                {/* Display Error Message */}
                {error && <p className="bg-red-100 text-red-700 p-3 rounded-lg mb-6 text-center">{error}</p>}

                {/* Data Table */}
                <div className="overflow-x-auto bg-white rounded-lg shadow-sm">
                    <table className="w-full min-w-max text-sm text-left text-gray-700">
                        <thead className="bg-gray-100 text-xs text-gray-700 uppercase">
                            <tr>
                                <th scope="col" className="px-6 py-3">ID</th>
                                <th scope="col" className="px-6 py-3">Deal</th>
                                <th scope="col" className="px-6 py-3">Sales Person</th>
                                <th scope="col" className="px-6 py-3">Policy</th>
                                <th scope="col" className="px-6 py-3 text-right">Amount</th>
                                <th scope="col" className="px-6 py-3">Calculated At</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map(r => (
                                <tr key={r.id} className="bg-white border-b hover:bg-gray-50">
                                    <td className="px-6 py-4 font-medium text-gray-900">{r.id}</td>
                                    <td className="px-6 py-4">{r.deal_title || r.deal_id}</td>
                                    <td className="px-6 py-4">{r.sales_name || r.sales_person_id}</td>
                                    <td className="px-6 py-4">{r.policy_name || r.policy_id}</td>
                                    <td className="px-6 py-4 text-right font-mono">{formatCurrency(r.amount)}</td>
                                    <td className="px-6 py-4">{formatDate(r.calculated_at)}</td>
                                </tr>
                            ))}
                            {/* Show a message when loading or when there are no results */}
                            {isLoading && (
                                <tr>
                                    <td colSpan="6" className="px-6 py-10 text-center text-gray-500">Loading data...</td>
                                </tr>
                            )}
                            {rows.length === 0 && !isLoading && (
                                <tr>
                                    <td colSpan="6" className="px-6 py-10 text-center text-gray-500">No results found.</td>
                                </tr>
                            )}
                        </tbody>
                        <tfoot className="bg-gray-100 font-semibold text-gray-800">
                            <tr>
                                <td colSpan="4" className="px-6 py-4 text-right">Total</td>
                                <td className="px-6 py-4 text-right font-mono">{formatCurrency(total)}</td>
                                <td className="px-6 py-4"></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </main>
        </div>
    );
}
