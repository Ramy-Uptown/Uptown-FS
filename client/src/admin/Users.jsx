import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchWithAuth, API_URL } from '../lib/apiClient';
import AdminSidebar from '../components/AdminSidebar.jsx';
import LoadingButton from '../components/LoadingButton.jsx';
import SkeletonRow from '../components/SkeletonRow.jsx';
import { notifyError, notifySuccess } from '../lib/notifications.js';

// Full list of supported roles (keep in sync with backend)
const ROLE_OPTIONS = [
  'user',
  'admin',
  'superadmin',
  'manager',
  'sales_manager',
  'property_consultant',
  'financial_manager',
  'financial_admin',
  'crm_admin',
  'contract_manager',
  'contract_person',
  'chairman',
  'vice_chairman',
  'ceo'
];

export default function Users() {
    const navigate = useNavigate();
    // --- State Management ---
    const [users, setUsers] = useState([]);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [busyId, setBusyId] = useState(null); // Tracks which user row is busy
    const [creating, setCreating] = useState(false);
    
    // Form and filter states
    const [createForm, setCreateForm] = useState({ email: '', password: '', role: 'user', fullName: '' });
    const [editingId, setEditingId] = useState(null);
    const [editEmail, setEditEmail] = useState('');
    const [filters, setFilters] = useState({ status: 'active', role: 'all', search: '', onlyNoManager: false });
    const [assignMap, setAssignMap] = useState({}); // { [userId]: managerId }

    const [me, setMe] = useState(null);

    // Position history modal state
    const [historyForId, setHistoryForId] = useState(null);
    const [historyItems, setHistoryItems] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    // --- Data Loading ---
    async function loadData() {
        setIsLoading(true);
        setError('');
        try {
            const [usersResp, salesResp, contractsResp, financeResp, meResp] = await Promise.all([
                fetchWithAuth(`${API_URL}/api/auth/users`),
                fetchWithAuth(`${API_URL}/api/workflow/sales-teams/memberships?active=true`).catch(() => null),
                fetchWithAuth(`${API_URL}/api/workflow/contracts-teams/memberships?active=true`).catch(() => null),
                fetchWithAuth(`${API_URL}/api/workflow/finance-teams/memberships?active=true`).catch(() => null),
                fetchWithAuth(`${API_URL}/api/auth/me`)
            ]);

            if (!usersResp.ok) throw new Error('Failed to load users');
            const usersData = await usersResp.json();
            setUsers(usersData.users || []);

            const assign = { sales: {}, contracts: {}, finance: {} };
            if (salesResp && salesResp.ok) {
                const memData = await salesResp.json();
                (memData.memberships || []).forEach(m => {
                    assign.sales[m.member_user_id] = String(m.manager_user_id);
                });
            }
            if (contractsResp && contractsResp.ok) {
                const memData = await contractsResp.json();
                (memData.memberships || []).forEach(m => {
                    assign.contracts[m.member_user_id] = String(m.manager_user_id);
                });
            }
            if (financeResp && financeResp.ok) {
                const memData = await financeResp.json();
                (memData.memberships || []).forEach(m => {
                    assign.finance[m.member_user_id] = String(m.manager_user_id);
                });
            }
            setAssignMap(assign);

            if (!meResp.ok) throw new Error('Failed to load current user profile');
            const meData = await meResp.json();
            setMe(meData.user);

        } catch (e) {
            setError(e.message || 'An unknown error occurred.');
            notifyError(e, 'Failed to load users');
        } finally {
            setIsLoading(false);
        }
    }

    useEffect(() => {
        loadData();
    }, []);

    // --- Event Handlers & Actions ---

    const handleUserAction = async (userId, action, successMsg) => {
        setBusyId(userId);
        setError('');
        try {
            await action();
            if (successMsg) notifySuccess(successMsg);
            await loadData(); // Reload data on success
        } catch (err) {
            const msg = err.message || 'Action failed.';
            setError(msg);
            notifyError(err, msg);
        } finally {
            setBusyId(null);
        }
    };
    
    const createUser = (e) => {
        e.preventDefault();
        setCreating(true);
        handleUserAction(null, async () => {
            const payload = {
                email: createForm.email,
                password: createForm.password,
                role: createForm.role,
                meta: createForm.fullName ? { full_name: createForm.fullName } : {}
            };
            const resp = await fetchWithAuth(`${API_URL}/api/auth/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!resp.ok) {
                const errorData = await resp.json().catch(() => ({ error: { message: 'An unknown error occurred' } }));
                throw new Error(errorData.error?.message || 'Failed to create user');
            }
            setCreateForm({ email: '', password: '', role: 'user', fullName: '' }); // Reset form
        }, 'User created successfully.').finally(() => setCreating(false));
    };

    const saveEmail = (userId) => {
        handleUserAction(userId, async () => {
            const resp = await fetchWithAuth(`${API_URL}/api/auth/users/${userId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: editEmail }),
            });
            if (!resp.ok) {
                const errorData = await resp.json().catch(() => ({ error: { message: 'An unknown error occurred' } }));
                throw new Error(errorData.error?.message || 'Failed to update user');
            }
            setEditingId(null);
            setEditEmail('');
        }, 'Email updated successfully.');
    };

    // Position history modal actions
    const openHistory = async (userId) => {
        setHistoryForId(userId);
        setHistoryLoading(true);
        setHistoryItems([]);
        try {
            const resp = await fetchWithAuth(`${API_URL}/api/auth/users/${userId}/audit`);
            const data = await resp.json();
            if (!resp.ok) throw new Error(data?.error?.message || 'Failed to load history');
            const items = (data.audit || []).filter(a => a.action === 'set_role');

            // Compute humanized from -> to by looking at previous entries
            const parsedAsc = [...items]
              .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0))
              .map((it, idx, arr) => {
                let toRole = ''
                try { toRole = (it.details && typeof it.details === 'object') ? it.details.new_role : JSON.parse(it.details || '{}').new_role } catch {}
                const prev = idx > 0 ? arr[idx - 1] : null
                let fromRole = ''
                if (prev) {
                  try { fromRole = (prev.details && typeof prev.details === 'object') ? prev.details.new_role : JSON.parse(prev.details || '{}').new_role } catch {}
                }
                return { ...it, _fromRole: fromRole || 'unknown', _toRole: toRole || 'unknown' }
              })

            // Show newest first
            setHistoryItems(parsedAsc.reverse());
        } catch (e) {
            const msg = e.message || 'Failed to load history';
            setError(msg);
            notifyError(e, msg);
        } finally {
            setHistoryLoading(false);
        }
    };
    const closeHistory = () => {
        setHistoryForId(null);
        setHistoryItems([]);
        setHistoryLoading(false);
    };
    
    const changeRole = (userId, role) => {
        handleUserAction(userId, async () => {
            const resp = await fetchWithAuth(`${API_URL}/api/auth/users/${userId}/role`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role }),
            });
            if (!resp.ok) {
                const errorData = await resp.json().catch(() => ({ error: { message: 'An unknown error occurred' } }));
                throw new Error(errorData.error?.message || 'Failed to change role');
            }
        }, 'Role updated successfully.');
    };

    const toggleActive = (user) => {
        handleUserAction(user.id, async () => {
            const resp = await fetchWithAuth(`${API_URL}/api/auth/users/${user.id}/active`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ active: !user.active }),
            });
            if (!resp.ok) {
                const errorData = await resp.json().catch(() => ({ error: { message: 'An unknown error occurred' } }));
                throw new Error(errorData.error?.message || 'Failed to toggle active status');
            }
}, user.active ? 'User deactivated successfully.' : 'User activated successfully.');    };

    const handleLogout = () => {
        // In a real app, this would clear tokens and redirect
        // But since we use AdminSidebar handling logout, this is just for mobile redundancy if needed
        window.location.href = '/login';
    };

    // --- Filtering and Derived State ---
    const filteredUsers = users.filter(u => {
        if (filters.status !== 'all') {
            if (filters.status === 'active' && !u.active) return false;
            if (filters.status === 'inactive' && u.active) return false;
        }
        if (filters.role !== 'all' && u.role !== filters.role) return false;
        const q = filters.search.trim().toLowerCase();
        if (q && !(u.email || '').toLowerCase().includes(q) && !(u.notes || '').toLowerCase().includes(q)) {
            return false;
        }
        if (filters.onlyNoManager) {
            const hasManager = assignMap[u.id] != null && assignMap[u.id] !== '';
            if (hasManager) return false;
        }
        return true;
    });
    
    const userById = Object.fromEntries(users.map(u => [u.id, u]));
    const isSuperAdmin = me?.role === 'superadmin';

    function getManagerIdForUser(u) {
      if (!u) return null;
      const r = String(u.role || '');
      if (r === 'property_consultant') return assignMap?.sales?.[u.id] || null;
      if (r === 'contract_person') return assignMap?.contracts?.[u.id] || null;
      if (r === 'financial_admin') return assignMap?.finance?.[u.id] || null;
      return null;
    }

    return (
        <div className="flex h-screen w-full bg-background-light font-sans overflow-hidden">
            <AdminSidebar />
            
            <main className="flex-1 flex flex-col h-full overflow-hidden bg-background-light relative">
                <div className="lg:hidden bg-[#1F2124] text-white p-4 flex justify-between items-center shadow-md">
                   <span className="font-light tracking-widest uppercase">Uptown</span>
                   <button className="text-white" onClick={handleLogout}><span className="material-symbols-outlined">logout</span></button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
                    <div className="max-w-7xl mx-auto">
                        <header className="mb-8">
                            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">User Management</h1>
                            <p className="mt-1 text-sm text-gray-500">Manage access control and user roles.</p>
                        </header>

                        {/* Create User Form */}
                        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm mb-8">
                            <h2 className="text-lg font-semibold text-gray-800 mb-4">Create New User</h2>
                            <form onSubmit={createUser} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                                <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2" htmlFor="email">Email</label>
                                        <input 
                                            id="email" 
                                            type="email" 
                                            placeholder="new.user@example.com" 
                                            value={createForm.email} 
                                            onChange={e => setCreateForm(s => ({ ...s, email: e.target.value }))} 
                                            className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" 
                                            required 
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2" htmlFor="password">Password</label>
                                        <input 
                                            id="password" 
                                            type="password" 
                                            placeholder="Min 6 characters" 
                                            value={createForm.password} 
                                            onChange={e => setCreateForm(s => ({ ...s, password: e.target.value }))} 
                                            className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" 
                                            required 
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2" htmlFor="fullName">Full Name</label>
                                        <input 
                                            id="fullName" 
                                            type="text" 
                                            placeholder="Employee full name" 
                                            value={createForm.fullName} 
                                            onChange={e => setCreateForm(s => ({ ...s, fullName: e.target.value }))} 
                                            className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" 
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2" htmlFor="role">Role</label>
                                    <select 
                                        id="role" 
                                        value={createForm.role} 
                                        onChange={e => setCreateForm(s => ({ ...s, role: e.target.value }))} 
                                        disabled={!isSuperAdmin}
                                        className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                    >
                                        {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
                                    </select>
                                </div>
                                <LoadingButton 
                                    type="submit" 
                                    loading={creating} 
                                    className="w-full py-2 px-4 rounded-lg bg-primary hover:bg-primary-hover text-white font-semibold shadow-sm transition-all"
                                >
                                    {creating ? 'Creating…' : 'Create User'}
                                </LoadingButton>
                            </form>
                        </div>

                        {/* Filters */}
                        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-6 grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400 text-[20px]">search</span>
                                <input 
                                    type="text" 
                                    placeholder="Search users..." 
                                    value={filters.search} 
                                    onChange={e => setFilters(s => ({ ...s, search: e.target.value }))} 
                                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" 
                                />
                            </div>
                            <select 
                                value={filters.role} 
                                onChange={e => setFilters(s => ({ ...s, role: e.target.value }))} 
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                            >
                                <option value="all">All Roles</option>
                                {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
                            </select>
                            <select 
                                value={filters.status} 
                                onChange={e => setFilters(s => ({ ...s, status: e.target.value }))} 
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                            >
                                <option value="active">Active Users</option>
                                <option value="inactive">Inactive Users</option>
                                <option value="all">All Statuses</option>
                            </select>
                            <label className="inline-flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                              <input 
                                type="checkbox" 
                                checked={filters.onlyNoManager} 
                                onChange={e => setFilters(s => ({ ...s, onlyNoManager: e.target.checked }))} 
                                className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                              />
                              Only without manager
                            </label>
                        </div>

                        {error && <div className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-xl mb-6 text-sm">{error}</div>}

                        {/* Users Table */}
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wider font-semibold">
                                        <tr>
                                            <th className="px-6 py-4">User</th>
                                            <th className="px-6 py-4">Role</th>
                                            <th className="px-6 py-4">Manager</th>
                                            <th className="px-6 py-4">Status</th>
                                            <th className="px-6 py-4">Updated</th>
                                            <th className="px-6 py-4 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {isLoading || !me ? (
                                            Array.from({ length: 5 }).map((_, i) => (
                                                <SkeletonRow key={i} widths={['lg','sm','sm','sm','sm','lg']} />
                                            ))
                                        ) : filteredUsers.length === 0 ? (
                                            <tr><td colSpan="6" className="text-center p-8 text-gray-500">No users match criteria.</td></tr>
                                        ) : (
                                            filteredUsers.map(u => {
                                                const isEditing = editingId === u.id;
                                                const isBusy = busyId === u.id;
                                                const isSelf = me.id === u.id;
                                                const mid = getManagerIdForUser(u);

                                                return (
                                                    <tr key={u.id} className={`hover:bg-gray-50/50 transition-colors ${isBusy ? 'opacity-50' : ''}`}>
                                                        <td className="px-6 py-4">
                                                            {isEditing ? (
                                                                <div className="flex gap-2">
                                                                    <input value={editEmail} onChange={e => setEditEmail(e.target.value)} className="w-full px-2 py-1 text-sm border rounded" />
                                                                    <LoadingButton onClick={() => saveEmail(u.id)} className="text-xs bg-primary text-white px-2 py-1 rounded">Save</LoadingButton>
                                                                    <LoadingButton onClick={() => setEditingId(null)} className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded">Cancel</LoadingButton>
                                                                </div>
                                                            ) : (
                                                                <div>
                                                                    <div className="font-medium text-gray-900">{u.email}</div>
                                                                    {u.meta?.full_name && <div className="text-xs text-gray-500">{u.meta.full_name}</div>}
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            {isSuperAdmin ? (
                                                              <select 
                                                                value={u.role} 
                                                                onChange={(e) => changeRole(u.id, e.target.value)} 
                                                                disabled={isBusy || isSelf} 
                                                                className="text-xs border-none bg-transparent hover:bg-gray-100 rounded px-2 py-1 cursor-pointer focus:ring-0 text-gray-700 font-medium"
                                                              >
                                                                  {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
                                                              </select>
                                                            ) : (
                                                              <span className="text-gray-700 text-xs font-medium px-2 py-1 bg-gray-100 rounded-md">{String(u.role || '').replace(/_/g, ' ')}</span>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4 text-xs text-gray-500">
                                                            {mid ? (
                                                                <span className="flex items-center gap-1">
                                                                    <span className="material-symbols-outlined text-[14px]">supervisor_account</span>
                                                                    {userById[mid]?.email || mid}
                                                                </span>
                                                            ) : <span className="text-gray-300">-</span>}
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${u.active ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-gray-100 text-gray-600 border border-gray-200'}`}>
                                                                {u.active ? 'Active' : 'Inactive'}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-xs text-gray-500">
                                                            {new Date(u.updated_at).toLocaleDateString()}
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <div className="flex justify-end items-center gap-2">
                                                                <button 
                                                                    onClick={() => openHistory(u.id)} 
                                                                    disabled={isBusy}
                                                                    className="p-1 text-gray-400 hover:text-primary transition-colors"
                                                                    title="View History"
                                                                >
                                                                    <span className="material-symbols-outlined text-[18px]">history</span>
                                                                </button>
                                                                <button 
                                                                    onClick={() => { setEditingId(u.id); setEditEmail(u.email); }}
                                                                    disabled={isBusy}
                                                                    className="p-1 text-gray-400 hover:text-primary transition-colors"
                                                                    title="Edit Email"
                                                                >
                                                                    <span className="material-symbols-outlined text-[18px]">edit</span>
                                                                </button>
                                                                <button 
                                                                    onClick={() => toggleActive(u)} 
                                                                    disabled={isBusy || isSelf} 
                                                                    className={`p-1 transition-colors ${u.active ? 'text-gray-400 hover:text-red-500' : 'text-gray-400 hover:text-green-500'}`}
                                                                    title={u.active ? 'Deactivate' : 'Activate'}
                                                                >
                                                                    <span className="material-symbols-outlined text-[18px]">{u.active ? 'block' : 'check_circle'}</span>
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Position History Modal */}
                        {historyForId !== null && (
                          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                                <h3 className="text-lg font-bold text-gray-900">Position History</h3>
                                <button onClick={closeHistory} className="text-gray-400 hover:text-gray-600">
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                              </div>
                              <div className="p-0 max-h-[60vh] overflow-y-auto">
                                {historyLoading ? (
                                  <div className="p-8 text-center text-gray-500">Loading history...</div>
                                ) : historyItems.length === 0 ? (
                                  <div className="p-8 text-center text-gray-500 flex flex-col items-center">
                                      <span className="material-symbols-outlined text-[32px] mb-2 opacity-50">history_toggle_off</span>
                                      No role changes found for this user.
                                  </div>
                                ) : (
                                  <div className="divide-y divide-gray-50">
                                    {historyItems.map(item => (
                                      <div key={item.id} className="p-4 hover:bg-gray-50 transition-colors">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-xs font-medium text-gray-500">
                                                {item.created_at ? new Date(item.created_at).toLocaleString() : ''}
                                            </span>
                                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                                                by {userById[item.changed_by]?.email || `id ${item.changed_by}`}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm">
                                            <span className="text-gray-500 font-medium line-through decoration-red-300">
                                                {String(item._fromRole || '').replace(/_/g,' ') || 'unknown'}
                                            </span>
                                            <span className="material-symbols-outlined text-[14px] text-gray-400">arrow_forward</span>
                                            <span className="text-primary font-bold">
                                                {String(item._toRole || '').replace(/_/g,' ')}
                                            </span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end">
                                <button 
                                    onClick={closeHistory} 
                                    className="px-4 py-2 bg-white border border-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
                                >
                                    Close
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
