import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchWithAuth, API_URL } from '../lib/apiClient'
import { notifyError, notifySuccess } from '../lib/notifications'
import AdminSidebar from '../components/AdminSidebar'
import LoadingButton from '../components/LoadingButton'

export default function BulkUnitCreation() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [role, setRole] = useState('')

  useEffect(() => {
    try {
        const u = JSON.parse(localStorage.getItem('auth_user') || '{}')
        setRole(u?.role || 'user')
    } catch {}
  }, [])

  // Unit Type: UR (Uptown Residence) or CH (Custom Home)
  const [unitType, setUnitType] = useState('UR')

  // Common inputs
  const [zone, setZone] = useState('')
  const [block, setBlock] = useState('')

  // UR-specific inputs
  const [building, setBuilding] = useState('')
  const [floorStart, setFloorStart] = useState(1)
  const [floorEnd, setFloorEnd] = useState(1)
  const [unitsPerFloor, setUnitsPerFloor] = useState(2)

  // CH-specific inputs
  const [plotStart, setPlotStart] = useState(1)
  const [plotEnd, setPlotEnd] = useState(1)

  // Preview
  const [previewItems, setPreviewItems] = useState([])

  const pad = (n, width) => String(n).padStart(width, '0')

  const generatePreview = () => {
    if (!zone || !block) {
      notifyError('Please fill in Zone and Block')
      return
    }

    const items = []
    const zonePad = pad(zone, 2)
    const blockPad = pad(block, 2)

    if (unitType === 'CH') {
      // Custom Home: CH-AAA-BB-CC (Plot-Block-Zone)
      const pStart = Number(plotStart) || 1
      const pEnd = Number(plotEnd) || pStart

      for (let plot = pStart; plot <= pEnd; plot++) {
        const plotPad = pad(plot, 3)
        const code = `CH${plotPad}${blockPad}${zonePad}`
        items.push({
          code,
          description: `Custom Home Plot ${plot}, Block ${block}, Zone ${zone}`,
          plot,
          type: 'CH'
        })
      }
    } else {
      // UR mode: UR-BB-CC-DDD-EE-FF (Apt-Floor-Bldg-Block-Zone)
      if (!building) {
        notifyError('Please fill in Building')
        return
      }

      const bldgPad = pad(building, 3)
      const perFloor = Number(unitsPerFloor) || 2
      let aptCounter = 1

      for (let fl = Number(floorStart); fl <= Number(floorEnd); fl++) {
        const floorPad = pad(fl, 2)
        for (let u = 0; u < perFloor; u++) {
          const aptPad = pad(aptCounter, 2)
          const code = `UR${aptPad}${floorPad}${bldgPad}${blockPad}${zonePad}`
          items.push({
            code,
            description: `Apartment ${aptCounter}, Floor ${fl}, Building ${building}`,
            floor: fl,
            unit: aptCounter,
            type: 'UR'
          })
          aptCounter++
        }
      }
    }

    setPreviewItems(items)
  }

  const handleSubmit = async () => {
    if (previewItems.length === 0) return
    if (!confirm(`Create ${previewItems.length} units as DRAFT?`)) return

    try {
      setLoading(true)

      let payload = { unitType, zone, block }

      if (unitType === 'CH') {
        payload.plotStart = Number(plotStart)
        payload.plotEnd = Number(plotEnd)
      } else {
        payload.building = building
        const floorsArr = []
        for (let f = Number(floorStart); f <= Number(floorEnd); f++) floorsArr.push(f)
        payload.floors = floorsArr
        payload.unitsPerFloor = Number(unitsPerFloor) || 2
      }

      const res = await fetchWithAuth(`${API_URL}/api/units/bulk-create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error?.message || 'Creation failed')

      notifySuccess(`Created ${data.created} INVENTORY_DRAFT units. ${data.duplicates > 0 ? `Skipped ${data.duplicates} duplicates.` : ''}`)
      navigate('/admin/inventory-drafts')
    } catch (e) {
      notifyError(e, 'Bulk creation failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <AdminSidebar role={role} />
      
      <main className="flex-1 overflow-y-auto ml-0 md:ml-64 p-6">
        <div className="w-full space-y-6">
          
          <div className="flex items-center justify-between">
            <div>
               <h2 className="text-3xl font-display font-bold text-primary tracking-wide">Bulk Unit Creation</h2>
               <p className="text-sm text-gray-500 mt-1">Generate multiple unit drafts at once based on patterns.</p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
             {/* Note Alert */}
            <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-md p-4 flex items-start">
               <span className="material-symbols-outlined text-yellow-500 mr-2 mt-0.5">info</span>
               <div className="text-sm text-yellow-800">
                  <p className="font-medium">Important Note</p>
                  <p className="mt-1">
                     Units are created as <strong>INVENTORY_DRAFT</strong> without an associated sales model. 
                     You must link them to a model on the 
                     <button onClick={() => navigate('/admin/inventory-drafts')} className="font-medium underline ml-1 hover:text-yellow-900">Inventory Drafts</button> page after creation.
                  </p>
               </div>
            </div>

            {/* Type Selector */}
             <div className="mb-6">
               <label className="block text-sm font-medium text-gray-700 mb-3">Unit Type</label>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div 
                     onClick={() => setUnitType('UR')}
                     className={`cursor-pointer border rounded-lg p-4 flex items-center transition-colors ${unitType === 'UR' ? 'border-primary bg-primary bg-opacity-5 ring-1 ring-primary' : 'border-gray-200 hover:border-primary'}`}
                  >
                     <input type="radio" name="unitType" checked={unitType === 'UR'} onChange={() => setUnitType('UR')} className="h-4 w-4 text-primary border-gray-300 focus:ring-primary" />
                     <span className="ml-3 font-medium text-gray-900">Uptown Residence (UR)</span>
                  </div>
                  <div 
                     onClick={() => setUnitType('CH')}
                     className={`cursor-pointer border rounded-lg p-4 flex items-center transition-colors ${unitType === 'CH' ? 'border-primary bg-primary bg-opacity-5 ring-1 ring-primary' : 'border-gray-200 hover:border-primary'}`}
                  >
                     <input type="radio" name="unitType" checked={unitType === 'CH'} onChange={() => setUnitType('CH')} className="h-4 w-4 text-primary border-gray-300 focus:ring-primary" />
                     <span className="ml-3 font-medium text-gray-900">Custom Home (CH)</span>
                  </div>
               </div>
             </div>

             {/* Form Fields */}
             <div className="space-y-6">
                 {/* Common */}
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                       <label className="block text-sm font-medium text-gray-700 mb-1">Zone (01-99)</label>
                       <input 
                          type="text" maxLength={2} value={zone} onChange={e => setZone(e.target.value)} 
                          placeholder="e.g. 03"
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                       />
                    </div>
                    <div>
                       <label className="block text-sm font-medium text-gray-700 mb-1">Block (01-99)</label>
                       <input 
                          type="text" maxLength={2} value={block} onChange={e => setBlock(e.target.value)} 
                          placeholder="e.g. 10"
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                       />
                    </div>
                 </div>
                 
                 <hr className="border-gray-100" />

                 {/* Custom Home Fields */}
                 {unitType === 'CH' && (
                    <div>
                       <label className="block text-sm font-medium text-gray-700 mb-1">Plot Number Range</label>
                       <div className="flex items-center gap-3">
                          <input 
                             type="number" min="1" max="999" value={plotStart} onChange={e => setPlotStart(e.target.value)}
                             className="block w-24 rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                          />
                          <span className="text-gray-500">to</span>
                          <input 
                             type="number" min="1" max="999" value={plotEnd} onChange={e => setPlotEnd(e.target.value)}
                             className="block w-24 rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                          />
                       </div>
                    </div>
                 )}

                 {/* Uptown Residence Fields */}
                 {unitType === 'UR' && (
                    <>
                       <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Building Number (001-999)</label>
                          <input 
                             type="text" maxLength={3} value={building} onChange={e => setBuilding(e.target.value)}
                             placeholder="e.g. 080"
                             className="block w-full sm:w-1/2 rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                          />
                       </div>
                       
                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                          <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Floors Range</label>
                              <div className="flex items-center gap-3">
                                 <input 
                                    type="number" min="0" max="100" value={floorStart} onChange={e => setFloorStart(e.target.value)}
                                    className="block w-24 rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                 />
                                 <span className="text-gray-500">to</span>
                                 <input 
                                    type="number" min="0" max="100" value={floorEnd} onChange={e => setFloorEnd(e.target.value)}
                                    className="block w-24 rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                 />
                              </div>
                          </div>
                          <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Units Per Floor</label>
                              <input 
                                 type="number" min="1" max="20" value={unitsPerFloor} onChange={e => setUnitsPerFloor(e.target.value)}
                                 className="block w-24 rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                              />
                          </div>
                       </div>
                    </>
                 )}

                 <div className="pt-4">
                    <button 
                       onClick={generatePreview}
                       className="w-full bg-blue-600 border border-transparent rounded-md shadow-sm py-2 px-4 inline-flex justify-center text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                       Generate Preview
                    </button>
                 </div>
             </div>
          </div>

          {/* Preview Section */}
          {previewItems.length > 0 && (
             <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden animate-fade-in-up">
                <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                    <h3 className="text-lg font-medium text-gray-900">Preview ({previewItems.length} units)</h3>
                    <LoadingButton 
                       onClick={handleSubmit}
                       loading={loading}
                       className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md shadow-sm text-sm font-medium"
                    >
                       Confirm & Create
                    </LoadingButton>
                </div>
                <div className="max-h-96 overflow-y-auto">
                   <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50 sticky top-0">
                         <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit Code</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                            {unitType === 'UR' && <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Floor</th>}
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{unitType === 'UR' ? 'Apt No' : 'Plot No'}</th>
                         </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                         {previewItems.map((item, i) => (
                            <tr key={i} className="hover:bg-gray-50">
                               <td className="px-6 py-4 whitespace-nowrap text-sm font-mono font-medium text-gray-900">{item.code}</td>
                               <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.description}</td>
                               {unitType === 'UR' && <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.floor}</td>}
                               <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.unit || item.plot}</td>
                            </tr>
                         ))}
                      </tbody>
                   </table>
                </div>
             </div>
          )}

        </div>
      </main>
    </div>
  )
}
