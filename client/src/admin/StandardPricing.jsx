import React, { useState, useEffect, useMemo } from 'react';
import { fetchWithAuth } from '../lib/apiClient.js';
import { th, td, ctrl, btnPrimary, btnSuccess, btnDanger, tableWrap, table, pageContainer, pageTitle, errorText, metaText, btn } from '../lib/ui.js';
import BrandHeader from '../lib/BrandHeader.jsx';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function getPaymentMonths(numberOfInstallments, frequency) {
  const out = [];
  if (!numberOfInstallments) return out;
  let period;
  let first = 1;
  switch (frequency) {
    case 'monthly': period = 1; first = 1; break;
    case 'quarterly': period = 3; first = 3; break;
    case 'bi-annually': period = 6; first = 6; break;
    case 'annually': period = 12; first = 12; break;
    default: period = 1; first = 1;
  }
  out.push(first);
  for (let i = 1; i < numberOfInstallments; i++) {
    out.push(out[i - 1] + period);
  }
  return out;
}

function calculatePV(totalPrice, dpPercent, years, frequency, annualRate) {
  const n = Number(totalPrice) || 0;
  const dpPerc = Number(dpPercent) / 100 || 0;
  const rate = Number(annualRate) / 100 || 0;
  const downPayment = n * dpPerc;
  const loan = n - downPayment;

  let installments = 0;
  if (years > 0) {
    if (frequency === 'monthly') installments = years * 12;
    else if (frequency === 'quarterly') installments = years * 4;
    else if (frequency === 'bi-annually') installments = years * 2;
    else if (frequency === 'annually') installments = years * 1;
  }

  if (installments <= 0) return downPayment;

  const perInstallment = loan / installments;
  const months = getPaymentMonths(installments, frequency);
  const monthlyRate = Math.pow(1 + rate, 1 / 12) - 1;
  let pv = downPayment;
  for (const m of months) {
    pv += perInstallment / Math.pow(1 + monthlyRate, m);
  }
  return pv;
}

export default function StandardPricing() {
  const [models, setModels] = useState([]);
  const [pricings, setPricings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const user = JSON.parse(localStorage.getItem('auth_user') || '{}');
  const role = user?.role;

  // Form state
  const [selectedModelId, setSelectedModelId] = useState('');
  const [selectedModelName, setSelectedModelName] = useState('');
  const [selectedModelCode, setSelectedModelCode] = useState('');
  const [stdPrice, setStdPrice] = useState('');
  const [dpPercent, setDpPercent] = useState(20);
  const [years, setYears] = useState(5);
  const [frequency, setFrequency] = useState('monthly');
  const [annualRate, setAnnualRate] = useState(12);
  const [maintenancePrice, setMaintenancePrice] = useState('');
  const [garagePrice, setGaragePrice] = useState('');
  const [gardenPrice, setGardenPrice] = useState('');
  const [roofPrice, setRoofPrice] = useState('');
  const [storagePrice, setStoragePrice] = useState('');

  const selectedModel = useMemo(() => {
    const id = Number(selectedModelId);
    return models.find(m => m.id === id) || null;
  }, [selectedModelId, models]);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const reqs = [fetchWithAuth(`${API_URL}/api/pricing/unit-model`)];
        // Allow both FM and Top-Management to view models (endpoint updated to allow read)
        reqs.push(fetchWithAuth(`${API_URL}/api/inventory/unit-models`));
        const [pricingRes, modelsRes] = await Promise.all(reqs);
        const pricingData = await pricingRes.json();
        if (!pricingRes.ok) throw new Error(pricingData?.error?.message || 'Failed to fetch pricing');

        setPricings(pricingData.pricings || []);

        const modelsData = await modelsRes.json();
        if (!modelsRes.ok) throw new Error(modelsData?.error?.message || 'Failed to fetch models');
        const items = modelsData.items || modelsData.models || [];
        setModels(items);
      } catch (e) {
        setError(e.message || 'An error occurred');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [role]);

  // Keep selects in sync
  useEffect(() => {
    if (!selectedModelId) return;
    const m = models.find(x => x.id === Number(selectedModelId));
    if (!m) return;
    setSelectedModelName(m.model_name || '');
    setSelectedModelCode(m.model_code || '');
  }, [selectedModelId, models]);

  useEffect(() => {
    if (!selectedModelName) return;
    const m = models.find(x => (x.model_name || '').toLowerCase() === selectedModelName.toLowerCase());
    if (m) {
      setSelectedModelId(String(m.id));
      setSelectedModelCode(m.model_code || '');
    }
  }, [selectedModelName, models]);

  useEffect(() => {
    if (!selectedModelCode) return;
    const m = models.find(x => (x.model_code || '').toLowerCase() === selectedModelCode.toLowerCase());
    if (m) {
      setSelectedModelId(String(m.id));
      setSelectedModelName(m.model_name || '');
    }
  }, [selectedModelCode, models]);

  // When selected model has no garden/roof, clear corresponding prices and keep inputs disabled
  useEffect(() => {
    const hasGarden = !!selectedModel?.has_garden;
    const hasRoof = !!selectedModel?.has_roof;
    if (!hasGarden && gardenPrice) setGardenPrice('');
    if (!hasRoof && roofPrice) setRoofPrice('');
  }, [selectedModel, gardenPrice, roofPrice]);

  const handleUpsertPricing = async (e) => {
    e.preventDefault();
    try {
      if (!selectedModelId) throw new Error('Select a Unit Model first');
      if (!stdPrice) throw new Error('Enter standard price');

      // Enforce garden/roof constraints: if the model has no garden/roof, price must be N.A/empty (treated as 0)
      const hasGarden = !!selectedModel?.has_garden;
      const hasRoof = !!selectedModel?.has_roof;
      if (!hasGarden && Number(gardenPrice || 0) > 0) {
        throw new Error('This unit model has no garden. Garden price must be N.A or empty.');
      }
      if (!hasRoof && Number(roofPrice || 0) > 0) {
        throw new Error('This unit model has no roof. Roof price must be N.A or empty.');
      }

      const res = await fetchWithAuth(`${API_URL}/api/pricing/unit-model`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model_id: Number(selectedModelId),
          price: Number(stdPrice),
          maintenance_price: maintenancePrice === '' ? 0 : Number(maintenancePrice),
          garage_price: garagePrice === '' ? 0 : Number(garagePrice),
          garden_price: gardenPrice === '' ? 0 : Number(gardenPrice),
          roof_price: roofPrice === '' ? 0 : Number(roofPrice),
          storage_price: storagePrice === '' ? 0 : Number(storagePrice)
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || 'Failed to save pricing');
      // Refresh list
      const listRes = await fetchWithAuth(`${API_URL}/api/pricing/unit-model`);
      const listData = await listRes.json();
      if (listRes.ok) setPricings(listData.pricings || []);
    } catch (e) {
      setError(e.message || String(e));
    }
  };

  const handleApproveStatus = async (id, status, reason) => {
    try {
      const res = await fetchWithAuth(`${API_URL}/api/pricing/unit-model/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, reason: reason || null })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || 'Failed to update status');
      setPricings(p => p.map(x => x.id === id ? data.pricing : x));
    } catch (e) {
      setError(e.message || String(e));
    }
  };

  // Pricing history modal state
  const [historyPricingId, setHistoryPricingId] = useState(null);
  const [historyItems, setHistoryItems] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [rejectReasons, setRejectReasons] = useState({});

  const pv = useMemo(() => {
    const total = Number(stdPrice) || 0;
    return calculatePV(total, dpPercent, Number(years), frequency, annualRate);
  }, [stdPrice, dpPercent, years, frequency, annualRate]);

  const installmentsCount = useMemo(() => {
    const y = Number(years) || 0;
    switch (frequency) {
      case 'monthly': return y * 12;
      case 'quarterly': return y * 4;
      case 'bi-annually': return y * 2;
      case 'annually': return y * 1;
      default: return 0;
    }
  }, [years, frequency]);

  const pricePerSqM = useMemo(() => {
    const total = Number(stdPrice) || 0;
    const area = Number(selectedModel?.area) || 0;
    if (!total || !area) return 0;
    return total / area;
  }, [stdPrice, selectedModel]);

  async function openPricingHistory(id) {
    setHistoryPricingId(id);
    setHistoryLoading(true);
    setHistoryItems([]);
    try {
      const resp = await fetchWithAuth(`${API_URL}/api/pricing/unit-model/${id}/audit`);
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error?.message || 'Failed to load history');
      setHistoryItems(data.audit || []);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setHistoryLoading(false);
    }
  }
  function closePricingHistory() {
    setHistoryPricingId(null);
    setHistoryItems([]);
    setHistoryLoading(false);
  }

  const handleLogout = async () => {
    try {
      const rt = localStorage.getItem('refresh_token')
      if (rt) {
        await fetch(`${API_URL}/api/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: rt })
        }).catch(() => {})
      }
    } finally {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('refresh_token')
      localStorage.removeItem('auth_user')
      window.location.href = '/login'
    }
  }

  if (loading) {
    return (
      <div>
        <BrandHeader onLogout={handleLogout} />
        <div style={pageContainer}>Loading...</div>
      </div>
    );
  }

  return (
    <div>
      <BrandHeader onLogout={handleLogout} />
      <div style={pageContainer}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={pageTitle}>Standard Pricing (by Unit Model)</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            {role === 'financial_manager' ? (
              <>
                <a href="/admin/unit-models" style={{ ...btnPrimary, textDecoration: 'none', display: 'inline-block' }}>
                  Manage Unit Models
                </a>
                <a href="/admin/unit-model-changes" style={{ ...btn, textDecoration: 'none', display: 'inline-block' }}>
                  Model Changes
                </a>
              </>
            ) : null}
            {(role === 'ceo' || role === 'chairman' || role === 'vice_chairman') ? (
              <a href="/admin/unit-model-changes" style={{ ...btnPrimary, textDecoration: 'none', display: 'inline-block' }}>
                Review Model Changes
              </a>
            ) : null}
          </div>
        </div>

        {error ? <p style={errorText}>{error}</p> : null}

        {role === 'financial_manager' && (
              <form onSubmit={handleUpsertPricing} style={{ border: '1px solid #e6eaf0', borderRadius: 12, padding: 16, marginTop: 12, marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h3 style={{ marginTop: 0 }}>Select Unit Model</h3>
                  <a href="/admin/standard-pricing-rejected" style={{ ...btn, textDecoration: 'none', display: 'inline-block' }}>Rejected Requests</a>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, alignItems: 'center' }}>
                  <div>
                    <div style={metaText}>Model Name</div>
                    <select value={selectedModelName} onChange={e => setSelectedModelName(e.target.value)} style={ctrl}>
                      <option value="">Select name…</option>
                      {models.map(m => (
                        <option key={m.id} value={m.model_name || ''}>
                          {m.model_name || ''} {m.area ? `— ${m.area} m²` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div style={metaText}>Model Code</div>
                    <select value={selectedModelCode} onChange={e => setSelectedModelCode(e.target.value)} style={ctrl}>
                      <option value="">Select code…</option>
                      {models.map(m => (
                        <option key={m.id} value={m.model_code || ''}>
                          {m.model_code || '(none)'}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

            {selectedModel ? (
              <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                <div>
                  <div style={metaText}>Orientation</div>
                  <input value={String(selectedModel.orientation || '').replace(/_/g,' ')} readOnly style={ctrl} />
                </div>
                <div>
                  <div style={metaText}>Area (m²)</div>
                  <input value={selectedModel.area ?? ''} readOnly style={ctrl} />
                </div>
                <div>
                  <div style={metaText}>Garden</div>
                  <input value={selectedModel.has_garden ? (selectedModel.garden_area ? `Yes (${selectedModel.garden_area} m²)` : 'Yes') : 'No'} readOnly style={ctrl} />
                </div>
                <div>
                  <div style={metaText}>Roof</div>
                  <input value={selectedModel.has_roof ? (selectedModel.roof_area ? `Yes (${selectedModel.roof_area} m²)` : 'Yes') : 'No'} readOnly style={ctrl} />
                </div>
              </div>
            ) : null}

            <h3 style={{ marginTop: 16 }}>Standard Price & Terms</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
              <div>
                <div style={metaText}>Base Unit Price (EGP)</div>
                <input type="number" value={stdPrice} onChange={e => setStdPrice(e.target.value)} style={ctrl} placeholder="e.g. 3,500,000" />
              </div>
              <div>
                <div style={metaText}>Garden Price (EGP)</div>
                <input
                  type="number"
                  value={gardenPrice}
                  onChange={e => setGardenPrice(e.target.value)}
                  style={ctrl}
                  placeholder={selectedModel?.has_garden ? "e.g. 120,000" : "N.A (no garden)"}
                  disabled={!selectedModel?.has_garden}
                />
                {!selectedModel?.has_garden ? <div style={metaText}>This model has no garden. Price must be N.A.</div> : null}
              </div>
              <div>
                <div style={metaText}>Roof Price (EGP)</div>
                <input
                  type="number"
                  value={roofPrice}
                  onChange={e => setRoofPrice(e.target.value)}
                  style={ctrl}
                  placeholder={selectedModel?.has_roof ? "e.g. 180,000" : "N.A (no roof)"}
                  disabled={!selectedModel?.has_roof}
                />
                {!selectedModel?.has_roof ? <div style={metaText}>This model has no roof. Price must be N.A.</div> : null}
              </div>
              <div>
                <div style={metaText}>Storage Price (EGP)</div>
                <input type="number" value={storagePrice} onChange={e => setStoragePrice(e.target.value)} style={ctrl} placeholder="e.g. 75,000" />
              </div>
              <div>
                <div style={metaText}>Garage Price (EGP)</div>
                <input type="number" value={garagePrice} onChange={e => setGaragePrice(e.target.value)} style={ctrl} placeholder="e.g. 200,000" />
              </div>
              <div>
                <div style={metaText}>Maintenance Price (EGP) — excluded from PV</div>
                <input type="number" value={maintenancePrice} onChange={e => setMaintenancePrice(e.target.value)} style={ctrl} placeholder="e.g. 150,000" />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 8 }}>
              <div>
                <div style={metaText}>Down Payment (%)</div>
                <input type="number" value={dpPercent} onChange={e => setDpPercent(e.target.value)} style={ctrl} />
              </div>
              <div>
                <div style={metaText}>Plan Duration (years)</div>
                <input type="number" value={years} onChange={e => setYears(e.target.value)} style={ctrl} />
              </div>
              <div>
                <div style={metaText}>Annual Financial Rate (%)</div>
                <input type="number" value={annualRate} onChange={e => setAnnualRate(e.target.value)} style={ctrl} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginTop: 8 }}>
              <div>
                <div style={metaText}>Installment Frequency</div>
                <select value={frequency} onChange={e => setFrequency(e.target.value)} style={ctrl}>
                  <option value="monthly">monthly</option>
                  <option value="quarterly">quarterly</option>
                  <option value="bi-annually">bi-annually</option>
                  <option value="annually">annually</option>
                </select>
              </div>
              <div>
                <div style={metaText}>Total Price used for PV (auto)</div>
                <input
                  readOnly
                  style={ctrl}
                  value={
                    Number(stdPrice || 0)
                    + (selectedModel?.has_garden ? Number(gardenPrice || 0) : 0)
                    + (selectedModel?.has_roof ? Number(roofPrice || 0) : 0)
                    + Number(storagePrice || 0)
                    + Number(garagePrice || 0)
                  }
                />
              </div>
            </div>

            <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              <div>
                <div style={metaText}>Calculated PV</div>
                <div style={{ fontWeight: 600 }}>{Number(pv || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EGP</div>
              </div>
              <div>
                <div style={metaText}>Calculated Installments</div>
                <div style={{ fontWeight: 600 }}>{installmentsCount || 0}</div>
              </div>
              <div>
                <div style={metaText}>Price per m²</div>
                <div style={{ fontWeight: 600 }}>
                  {Number(pricePerSqM || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EGP/m²
                </div>
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <button type="submit" style={btnPrimary} disabled={!selectedModelId || !stdPrice}>Save/Request Approval</button>
              <span style={{ ...metaText, marginLeft: 8 }}>Top-Management approval required.</span>
            </div>
          </form>
        )}

        <div style={tableWrap}>
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>Model</th>
                <th style={th}>Code</th>
                <th style={th}>Area</th>
                <th style={th}>Price (EGP)</th>
                <th style={th}>Garden</th>
                <th style={th}>Roof</th>
                <th style={th}>Storage</th>
                <th style={th}>Garage</th>
                <th style={th}>Maintenance</th>
                <th style={th}>Status</th>
                <th style={th}>Created By</th>
                <th style={th}>Approved By</th>
                <th style={th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pricings.map(p => (
                <tr key={p.id}>
                  <td style={td}>{p.model_name}</td>
                  <td style={td}>{p.model_code || ''}</td>
                  <td style={td}>{Number(p.area || 0).toLocaleString()}</td>
                  <td style={td}>{Number(p.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td style={td}>{
                    (() => {
                      const hasGarden = p.has_garden ?? (p.garden_area != null ? Number(p.garden_area) > 0 : null);
                      const val = Number(p.garden_price || 0);
                      if (hasGarden === false) return 'N.A';
                      return val ? val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : (hasGarden === false ? 'N.A' : '0.00');
                    })()
                  }</td>
                  <td style={td}>{
                    (() => {
                      const hasRoof = p.has_roof ?? (p.roof_area != null ? Number(p.roof_area) > 0 : null);
                      const val = Number(p.roof_price || 0);
                      if (hasRoof === false) return 'N.A';
                      return val ? val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : (hasRoof === false ? 'N.A' : '0.00');
                    })()
                  }</td>
                  <td style={td}>{Number(p.storage_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td style={td}>{Number(p.garage_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td style={td}>{Number(p.maintenance_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td style={td}>{p.status}</td>
                  <td style={td}>{p.created_by_email || ''}</td>
                  <td style={td}>{p.approved_by_email || ''}</td>
                  <td style={td}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <button onClick={() => openPricingHistory(p.id)} style={btn}>History</button>
                      {(role === 'ceo' || role === 'chairman' || role === 'vice_chairman') && p.status === 'pending_approval' ? (
                        <>
                          <button onClick={() => handleApproveStatus(p.id, 'approved')} style={btnSuccess}>Approve</button>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <input
                              placeholder="Reason (for rejection)"
                              value={rejectReasons[p.id] || ''}
                              onChange={e => setRejectReasons(s => ({ ...s, [p.id]: e.target.value }))}
                              style={ctrl}
                            />
                            <button onClick={() => handleApproveStatus(p.id, 'rejected', rejectReasons[p.id])} style={btnDanger}>Reject</button>
                          </div>
                        </>
                      ) : (
                        <span style={metaText}>—</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {pricings.length === 0 && (
                <tr>
                  <td style={td} colSpan={8}>No unit model pricing entries.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {(role === 'ceo' || role === 'chairman' || role === 'vice_chairman') && (
          <div style={{ marginTop: 16, border: '1px solid #e6eaf0', borderRadius: 12, padding: 12 }}>
            <h3 style={{ marginTop: 0 }}>Unit Models (Read-only)</h3>
            <div style={tableWrap}>
              <table style={table}>
                <thead>
                  <tr>
                    <th style={th}>ID</th>
                    <th style={th}>Name</th>
                    <th style={th}>Code</th>
                    <th style={th}>Area</th>
                    <th style={th}>Orientation</th>
                    <th style={th}>Garden</th>
                    <th style={th}>Roof</th>
                    <th style={th}>Created</th>
                    <th style={th}>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {models.map(m => (
                    <tr key={m.id}>
                      <td style={td}>{m.id}</td>
                      <td style={td}>{m.model_name}</td>
                      <td style={td}>{m.model_code || ''}</td>
                      <td style={td}>{m.area}</td>
                      <td style={td}>{String(m.orientation || '').replace(/_/g,' ')}</td>
                      <td style={td}>{m.has_garden ? (m.garden_area ? `Yes (${m.garden_area} m²)` : 'Yes') : 'No'}</td>
                      <td style={td}>{m.has_roof ? (m.roof_area ? `Yes (${m.roof_area} m²)` : 'Yes') : 'No'}</td>
                      <td style={td}>{m.created_at ? new Date(m.created_at).toLocaleString() : ''}</td>
                      <td style={td}>{m.updated_at ? new Date(m.updated_at).toLocaleString() : ''}</td>
                    </tr>
                  ))}
                  {models.length === 0 && (
                    <tr>
                      <td style={td} colSpan={9}><span style={metaText}>No models.</span></td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pricing history modal */}
        {historyPricingId != null && (
          <div className="fixed inset-0" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
            <div style={{ background: '#fff', borderRadius: 10, width: '100%', maxWidth: 800 }}>
              <div style={{ padding: '10px 14px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Pricing History — #{historyPricingId}</h3>
                <button onClick={closePricingHistory} style={btn}>Close</button>
              </div>
              <div style={{ padding: 12, maxHeight: '65vh', overflowY: 'auto' }}>
                {historyLoading ? (
                  <div style={metaText}>Loading…</div>
                ) : historyItems.length === 0 ? (
                  <div style={metaText}>No history found.</div>
                ) : (
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {historyItems.map(h => (
                      <li key={h.id} style={{ borderBottom: '1px solid #f2f5fa', padding: '8px 0' }}>
                        <div><strong>{h.action}</strong> — {h.created_at ? new Date(h.created_at).toLocaleString() : ''}</div>
                        <div style={metaText}>By: {h.changed_by_email || h.changed_by || ''}</div>
                        <div style={{ fontFamily: 'monospace', fontSize: 12, whiteSpace: 'pre-wrap' }}>
                          {h.details ? (typeof h.details === 'string' ? h.details : JSON.stringify(h.details, null, 2)) : ''}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div style={{ padding: '10px 14px', borderTop: '1px solid #e5e7eb', textAlign: 'right' }}>
                <button onClick={closePricingHistory} style={btn}>Close</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
