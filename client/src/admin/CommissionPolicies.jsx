import React, { useEffect, useState } from 'react'
import { fetchWithAuth, API_URL } from '../lib/apiClient.js'
import AdminSidebar from '../components/AdminSidebar.jsx'
import LoadingButton from '../components/LoadingButton.jsx'
import SkeletonRow from '../components/SkeletonRow.jsx'
import { notifyError, notifySuccess } from '../lib/notifications.js'

export default function CommissionPolicies() {
  const [list, setList] = useState([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [rowLoading, setRowLoading] = useState({})
  const [saving, setSaving] = useState(false)
  
  const user = JSON.parse(localStorage.getItem('auth_user') || '{}');

  const [form, setForm] = useState({ name: '', description: '', rules: '{ "type": "percentage", "rate": 2.5 }', active: true })
  const [editingId, setEditingId] = useState(0)

  async function load(p = page) {
    try {
      setLoading(true)
      setError('')
      const q = new URLSearchParams()
      q.set('page', String(p))
      q.set('pageSize', String(pageSize))
      const resp = await fetchWithAuth(`${API_URL}/api/commission-policies?${q.toString()}`)
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Failed to load policies')
      setList(data.policies || [])
      setTotal(data.pagination?.total || 0)
    } catch (e) {
      const msg = e.message || String(e)
      setError(msg)
      notifyError(e, 'Failed to load policies')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(1) }, [pageSize])
  useEffect(() => { load(page) }, [page])

  function resetForm() {
    setForm({ name: '', description: '', rules: '{ "type": "percentage", "rate": 2.5 }', active: true })
    setEditingId(0)
  }

  async function save(e) {
    e && e.preventDefault()
    try {
      setSaving(true)
      let rulesObj = {}
      try { rulesObj = JSON.parse(form.rules) } catch { throw new Error('Rules must be valid JSON') }
      const payload = { name: form.name, description: form.description, rules: rulesObj, active: !!form.active }
      let resp
      if (editingId) {
        resp = await fetchWithAuth(`${API_URL}/api/commission-policies/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
      } else {
        resp = await fetchWithAuth(`${API_URL}/api/commission-policies`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
      }
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Save failed')
      notifySuccess(editingId ? 'Commission policy updated successfully.' : 'Commission policy created successfully.')
      resetForm()
      await load()
    } catch (e) {
      notifyError(e, 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  function edit(row) {
    setEditingId(row.id)
    setForm({ name: row.name || '', description: row.description || '', rules: JSON.stringify(row.rules || {}, null, 2), active: !!row.active })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function remove(id) {
    if (!confirm('Delete this policy?')) return
    const key = `delete:${id}`
    try {
      setRowLoading(s => ({ ...s, [key]: true }))
      const resp = await fetchWithAuth(`${API_URL}/api/commission-policies/${id}`, { method: 'DELETE' })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Delete failed')
      notifySuccess('Commission policy deleted successfully.')
      await load()
    } catch (e) {
      notifyError(e, 'Delete failed')
    } finally {
      setRowLoading(s => ({ ...s, [key]: false }))
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="flex h-screen bg-gray-50">
      <AdminSidebar role={user?.role} />
      
      <main className="flex-1 overflow-y-auto ml-0 md:ml-64 lg:ml-0 p-6">
        <div className="w-full mx-auto space-y-6">

          <div className="flex items-center justify-between">
              <div>
                  <h2 className="text-3xl font-display font-bold text-primary tracking-wide">Commission Policies</h2>
                  <p className="text-sm text-gray-500 mt-1">Manage global commission calculation rules.</p>
              </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
             <h3 className="text-lg font-medium text-gray-900 mb-4">{editingId ? 'Edit Policy' : 'Create New Policy'}</h3>
             <form onSubmit={save} className="space-y-4">
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                 <div className="space-y-1">
                   {/* Name */}
                   <input 
                      placeholder="Policy Name" 
                      value={form.name} 
                      onChange={e => setForm(s => ({ ...s, name: e.target.value }))} 
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                      required 
                   />
                 </div>
                 <div className="space-y-1">
                   {/* Description */}
                   <input 
                      placeholder="Description" 
                      value={form.description} 
                      onChange={e => setForm(s => ({ ...s, description: e.target.value }))} 
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                   />
                 </div>
                 <div className="flex items-center h-full">
                    <label className="inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={!!form.active} 
                        onChange={e => setForm(s => ({ ...s, active: e.target.checked }))} 
                        className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                      />
                      <span className="ml-2 text-sm text-gray-700">Active</span>
                    </label>
                 </div>
               </div>
               
               <div className="space-y-1">
                 <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">Rules (JSON)</label>
                 <textarea 
                    value={form.rules} 
                    onChange={e => setForm(s => ({ ...s, rules: e.target.value }))} 
                    rows={6} 
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary text-xs font-mono bg-slate-50"
                 />
               </div>

               <div className="flex gap-3 pt-2">
                 <LoadingButton type="submit" loading={saving} className="inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary shadow-sm">
                   {saving ? 'Saving...' : (editingId ? 'Update Policy' : 'Create Policy')}
                 </LoadingButton>
                 {editingId ? (
                   <LoadingButton type="button" onClick={resetForm} className="inline-flex justify-center items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary shadow-sm">
                     Cancel
                   </LoadingButton>
                 ) : null}
               </div>

             </form>
          </div>

          {error && <div className="p-4 bg-red-50 text-red-700 rounded-md border border-red-100 text-sm">{error}</div>}

          <div className="bg-white shadow ring-1 ring-black ring-opacity-5 rounded-lg overflow-hidden">
             <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-300">
                   <thead className="bg-gray-50">
                     <tr>
                       <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 sm:pl-6">ID</th>
                       <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Name</th>
                       <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Active</th>
                       <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Updated</th>
                       <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6"><span className="sr-only">Actions</span></th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-gray-200 bg-white">
                     {loading && (
                        Array.from({ length: pageSize }).map((_, i) => (
                           <tr key={i}><td colSpan={5} className="px-3 py-4"><SkeletonRow widths={['sm','lg','sm','lg']} /></td></tr>
                        ))
                     )}
                     {!loading && list.map(r => (
                       <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                         <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">{r.id}</td>
                         <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900 font-medium">{r.name}</td>
                         <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                             <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${r.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                               {r.active ? 'Yes' : 'No'}
                             </span>
                         </td>
                         <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{r.updated_at ? new Date(r.updated_at).toLocaleString() : ''}</td>
                         <td className="whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                           <div className="flex gap-2 justify-end">
                             <LoadingButton 
                                onClick={() => edit(r)}
                                className="inline-flex items-center px-2.5 py-1.5 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary shadow-sm"
                             >
                               Edit
                             </LoadingButton>
                             <LoadingButton 
                                onClick={() => remove(r.id)} 
                                loading={rowLoading[`delete:${r.id}`]}
                                className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 shadow-sm"
                             >
                               Delete
                             </LoadingButton>
                           </div>
                         </td>
                       </tr>
                     ))}
                     {list.length === 0 && !loading && (
                        <tr><td colSpan={5} className="px-3 py-12 text-center text-sm text-gray-500">No policies found.</td></tr>
                     )}
                   </tbody>
                </table>
             </div>
          </div>
          
           <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6 rounded-lg shadow-sm">
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Page <span className="font-medium">{page}</span> of <span className="font-medium">{totalPages}</span> — <span className="font-medium">{total}</span> total
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                    <button
                      onClick={() => setPage(1)}
                      disabled={page === 1 || loading}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:bg-gray-100"
                    >
                      First
                    </button>
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1 || loading}
                      className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:bg-gray-100"
                    >
                      Prev
                    </button>
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages || loading}
                      className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:bg-gray-100"
                    >
                       Next
                    </button>
                     <button
                      onClick={() => setPage(totalPages)}
                      disabled={page === totalPages || loading}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:bg-gray-100"
                    >
                      Last
                    </button>
                  </nav>
                </div>
              </div>
            </div>

        </div>
      </main>
    </div>
  )
}
