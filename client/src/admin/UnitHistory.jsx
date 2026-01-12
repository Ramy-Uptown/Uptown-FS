import React, { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { fetchWithAuth, API_URL } from '../lib/apiClient.js'
import AdminSidebar from '../components/AdminSidebar.jsx'
import LoadingButton from '../components/LoadingButton.jsx'

const badgeStyle = (bg, color) => ({
    backgroundColor: bg,
    color: color,
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.125rem 0.625rem',
    borderRadius: '9999px',
    fontSize: '0.75rem',
    fontWeight: 500,
    lineHeight: '1rem',
})

function formatTs(ts) {
  if (!ts) return ''
  try {
    return new Date(ts).toLocaleString()
  } catch {
    return String(ts)
  }
}

function UnitHistoryEvents({ events }) {
  if (!events || events.length === 0) {
    return <p className="text-gray-500 text-sm py-4 italic">No history events recorded for this unit.</p>
  }
  return (
    <div className="space-y-4 mt-4">
      <div className="flow-root">
          <ul role="list" className="-mb-8">
              {events.map((ev, idx) => (
                  <li key={idx}>
                    <div className="relative pb-8">
                        {idx !== events.length - 1 ? (
                          <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true" />
                        ) : null}
                        <div className="relative flex space-x-3">
                          <div>
                             <span className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center ring-8 ring-white">
                                <span className="material-symbols-outlined text-primary text-sm">history</span>
                             </span>
                          </div>
                          <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                            <div>
                              <p className="text-sm text-gray-900 font-medium">{ev.label}</p>
                              {ev.detail && <p className="text-sm text-gray-500 mt-0.5">{ev.detail}</p>}
                               {Array.isArray(ev.badges) && ev.badges.length > 0 && (
                                <div className="flex gap-2 flex-wrap mt-2">
                                    {ev.badges.map((b, i) => (
                                    <span key={i} style={badgeStyle(b.bg || '#f3f4f6', b.color || '#374151')}>
                                        {b.text}
                                    </span>
                                    ))}
                                </div>
                                )}
                            </div>
                            <div className="text-right text-xs whitespace-nowrap text-gray-500">
                              <time dateTime={ev.at}>{formatTs(ev.at)}</time>
                            </div>
                          </div>
                        </div>
                    </div>
                  </li>
              ))}
          </ul>
      </div>
    </div>
  )
}

export default function UnitHistory() {
  const user = JSON.parse(localStorage.getItem('auth_user') || '{}');
  const [unitIdInput, setUnitIdInput] = useState('')
  const [unit, setUnit] = useState(null)
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const location = useLocation()

  async function loadHistory(e, explicitUnitId) {
    e && e.preventDefault()
    setError('')
    setUnit(null)
    setEvents([])

    const idNum = explicitUnitId != null ? Number(explicitUnitId) : Number(unitIdInput)
    if (!Number.isFinite(idNum) || idNum <= 0) {
      setError('Please enter a valid Unit ID (positive number). You can copy it from the Inventory page or use the search below.')
      return
    }

    try {
      setLoading(true)
      const resp = await fetchWithAuth(`${API_URL}/api/inventory/unit-history?unit_id=${idNum}`)
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok) {
        throw new Error(data?.error?.message || 'Failed to load unit history')
      }
      setUnit(data.unit || null)
      setEvents(Array.isArray(data.events) ? data.events : [])
      setUnitIdInput(String(idNum))
    } catch (e2) {
      setError(e2.message || String(e2))
    } finally {
      setLoading(false)
    }
  }

  async function runSearch(e) {
    e && e.preventDefault()
    setError('')
    setSearchResults([])
    const q = String(searchQuery || '').trim()
    if (!q) {
      setError('Enter a unit code, type, or keyword to search.')
      return
    }
    try {
      setSearchLoading(true)
      const params = new URLSearchParams()
      params.set('search', q)
      params.set('page', '1')
      params.set('pageSize', '20')
      const resp = await fetchWithAuth(`${API_URL}/api/inventory/units?${params.toString()}`)
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok) {
        throw new Error(data?.error?.message || 'Failed to search units')
      }
      setSearchResults(Array.isArray(data.units) ? data.units : [])
    } catch (e2) {
      setError(e2.message || String(e2))
    } finally {
      setSearchLoading(false)
    }
  }

  // When opened with /admin/unit-history?unitId=123, auto-load that unit
  useEffect(() => {
    try {
      const params = new URLSearchParams(location.search || '')
      const fromQuery = params.get('unitId') || params.get('unit_id')
      if (fromQuery && Number(fromQuery) > 0) {
        setUnitIdInput(fromQuery)
        loadHistory(null, fromQuery)
      }
    } catch {
      // ignore malformed query strings
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search])

  return (
    <div className="flex h-screen bg-gray-50">
      <AdminSidebar role={user?.role} />
      
      <main className="flex-1 overflow-y-auto ml-0 md:ml-64 p-6">
        <div className="max-w-4xl mx-auto space-y-6">

            <div>
                <h2 className="text-3xl font-display font-bold text-primary tracking-wide">Unit Lifecycle History</h2>
                <p className="text-sm text-gray-500 mt-1">
                   View a chronological history of a unit across Block, Reservation, and Contract stages.
                </p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 space-y-4">
                <form onSubmit={loadHistory} className="flex flex-wrap gap-3 items-end">
                     <div className="flex-1 min-w-[200px]">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Enter Unit ID</label>
                        <input 
                            type="number"
                            min={1}
                            placeholder="e.g., 123"
                            value={unitIdInput}
                            onChange={e => setUnitIdInput(e.target.value)}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                         />
                     </div>
                     <LoadingButton type="submit" loading={loading} className="inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary shadow-sm h-[38px]">
                        Load History
                     </LoadingButton>
                </form>

                <div className="relative">
                    <div className="absolute inset-0 flex items-center" aria-hidden="true">
                       <div className="w-full border-t border-gray-200" />
                    </div>
                    <div className="relative flex justify-center">
                       <span className="bg-white px-2 text-sm text-gray-500">Or Search</span>
                    </div>
                </div>

                <form onSubmit={runSearch} className="flex flex-wrap gap-3 items-end">
                     <div className="flex-1 min-w-[200px]">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Search Unit</label>
                        <input 
                            type="text"
                            placeholder="Unit Code, Type, or Zone..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                         />
                     </div>
                     <LoadingButton type="submit" loading={searchLoading} className="inline-flex justify-center items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary shadow-sm h-[38px]">
                        Search Units
                     </LoadingButton>
                </form>

                {error && <div className="p-4 bg-red-50 text-red-700 rounded-md border border-red-100 text-sm">{error}</div>}

                {searchResults.length > 0 && (
                  <div className="border border-gray-200 rounded-md bg-gray-50 divide-y divide-gray-200 max-h-60 overflow-y-auto">
                    {searchResults.map(u => (
                      <div key={u.id} className="flex justify-between items-center p-3 hover:bg-white transition-colors">
                        <div>
                           <p className="text-sm font-medium text-gray-900">{u.code} <span className="text-gray-500 font-normal">(ID: {u.id})</span></p>
                           <p className="text-xs text-gray-500">{u.unit_status || '-'} • {u.unit_type || ''}</p>
                        </div>
                        <button 
                           type="button" 
                           onClick={() => loadHistory(null, u.id)}
                           className="text-primary hover:text-primary/80 text-sm font-medium"
                        >
                           View History
                        </button>
                      </div>
                    ))}
                  </div>
                )}
            </div>
            
            {unit && (
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                  <div className="flex items-start">
                     <div className="flex-shrink-0">
                         <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="material-symbols-outlined text-primary">apartment</span>
                         </div>
                     </div>
                     <div className="ml-4">
                        <h3 className="text-lg font-medium text-gray-900">{unit.code}</h3>
                        <p className="text-sm text-gray-500">ID: {unit.id} • {unit.unit_type}</p>
                        <div className="mt-2 flex items-center gap-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${unit.available === false ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                                {unit.available === false ? 'UNAVAILABLE' : 'AVAILABLE'}
                            </span>
                            <span className="text-xs text-gray-500 uppercase tracking-wide font-semibold">{unit.unit_status || '-'}</span>
                        </div>
                     </div>
                  </div>
                  
                  <div className="mt-6 border-t border-gray-100 pt-6">
                     <h4 className="text-sm font-medium text-gray-900 mb-4 uppercase tracking-wider">History Timeline</h4>
                     <UnitHistoryEvents events={events} />
                  </div>
              </div>
            )}

        </div>
      </main>
    </div>
  )
}