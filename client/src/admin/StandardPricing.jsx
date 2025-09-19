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

  const selectedModel = useMemo(() => {
    const id = Number(selectedModelId);
    return models.find(m => m.id === id) || null;
  }, [selectedModelId, models]);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const reqs = [fetchWithAuth(`${API_URL}/api/pricing/unit-model`)];
        // Only FM can list models (our endpoint is restricted); CEOs will still see pricing list
        if (role === 'financial_manager') {
          reqs.push(fetchWithAuth(`${API_URL}/api/inventory/unit-models`));
        }
        const resps = await Promise.all(reqs);
        const pricingRes = resps[0];
        const pricingData = await pricingRes.json();
        if (!pricingRes.ok) throw new Error(pricingData?.error?.message || 'Failed to fetch pricing');

        setPricings(pricingData.pricings || []);

        if (role === 'financial_manager') {
          const modelsRes = resps[1];
          const modelsData = await modelsRes.json();
          if (!modelsRes.ok) throw new Error(modelsData?.error?.message || 'Failed to fetch models');
          const items = modelsData.items || modelsData.models || [];
          setModels(items);
        }
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

  const handleUpsertPricing = async (e) => {
    e.preventDefault();
    try {
      if (!selectedModelId) throw new Error('Select a Unit Model first');
      if (!stdPrice) throw new Error('Enter standard price');
      const res = await fetchWithAuth(`${API_URL}/api/pricing/unit-model`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model_id: Number(selectedModelId), price: Number(stdPrice) })
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

  const handleApproveStatus = async (id, status) => {
    try {
      const res = await fetchWithAuth(`${API_URL}/api/pricing/unit-model/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || 'Failed to update status');
      setPricings(p => p.map(x => x.id === id ? data.pricing : x));
    } catch (e) {
      setError(e.message || String(e));
    }
  };

  const pv = useMemo(() => {
    const total = Number(stdPrice) || 0;
    return calculatePV(total, dpPercent, Number(years), frequency, annualRate);
  }, [stdPrice, dpPercent, years, frequency, annualRate]);

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
            <h3 style={{ marginTop: 0 }}>Select Unit Model</h3>
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
              <div>
                <div style={metaText}>Standard Price (EGP)</div>
                <input type="number" value={stdPrice} onChange={e => setStdPrice(e.target.value)} style={ctrl} placeholder="e.g. 3,500,000" />
              </div>
              <div>
                <div style={metaText}>Down Payment (%)</div>
                <input type="number" value={dpPercent} onChange={e => setDpPercent(e.target.value)} style={ctrl} />
              </div>
              <div>
                <div style={metaText}>Plan Duration (years)</div>
                <input type="number" value={years} onChange={e => setYears(e.target.value)} style={ctrl} />
              </div>
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
                <div style={metaText}>Annual Financial Rate (%)</div>
                <input type="number" value={annualRate} onChange={e => setAnnualRate(e.target.value)} style={ctrl} />
              </div>
            </div>

            <div style={{ marginTop: 10 }}>
              <div style={metaText}>Calculated PV</div>
              <div style={{ fontWeight: 600 }}>{Number(pv || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EGP</div>
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
                  <td style={td}>{p.status}</td>
                  <td style={td}>{p.created_by_email || ''}</td>
                  <td style={td}>{p.approved_by_email || ''}</td>
                  <td style={td}>
                    {(role === 'ceo' || role === 'chairman' || role === 'vice_chairman') && p.status === 'pending_approval' ? (
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button onClick={() => handleApproveStatus(p.id, 'approved')} style={btnSuccess}>Approve</button>
                        <button onClick={() => handleApproveStatus(p.id, 'rejected')} style={btnDanger}>Reject</button>
                      </div>
                    ) : (
                      <span style={metaText}>—</span>
                    )}
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

      </div>
    </div>
  );
}
