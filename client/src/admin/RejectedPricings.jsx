import React, { useEffect, useMemo, useState } from 'react';
import BrandHeader from '../lib/BrandHeader.jsx';
import { fetchWithAuth, API_URL } from '../lib/apiClient.js';
import { th, td, ctrl, btn, btnPrimary, btnDanger, btnSuccess, tableWrap, table, pageContainer, pageTitle, metaText, errorText } from '../lib/ui.js';

export default function RejectedPricings() {
  const role = JSON.parse(localStorage.getItem('auth_user') || '{}')?.role;
  const [pricings, setPricings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);

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
        setError(e.message || String(e));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleLogout = async () => {
    try {
      const rt = localStorage.getItem('refresh_token');
      if (rt) {
        await fetch(`${API_URL}/api/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: rt })
        }).catch(() => {});
      }
    } finally {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('auth_user');
      window.location.href = '/login';
    }
  };

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

  async function deletePricing(p) {
    if (!confirm('Delete this rejected pricing request?')) return;
    try {
      const res = await fetchWithAuth(`${API_URL}/api/pricing/unit-model/${p.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || 'Delete failed');
      setPricings(pricings => pricings.filter(x => x.id !== p.id));
      if (editing?.id === p.id) setEditing(null);
    } catch (e) {
      alert(e.message || String(e));
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
      alert('Resubmitted for approval.');
    } catch (e) {
      alert(e.message || String(e));
    }
  }

  return (
    <div>
      <BrandHeader onLogout={handleLogout} />
      <div style={pageContainer}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={pageTitle}>Rejected Standard Pricing Requests</h2>
          <div>
            <a href="/admin/standard-pricing" style={{ ...btn, textDecoration: 'none', display: 'inline-block' }}>
              Back to Standard Pricing
            </a>
          </div>
        </div>

        {role !== 'financial_manager' ? (
          <p style={errorText}>Only Financial Managers can access this page.</p>
        ) : null}

        {editing && (
          <form onSubmit={resubmit} style={{ border: '1px solid #e6eaf0', borderRadius: 10, padding: 12, marginBottom: 16, background: '#fff' }}>
            <h3 style={{ marginTop: 0 }}>Edit and Resubmit</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
              <div>
                <div style={metaText}>Base Unit Price (EGP)</div>
                <input type="number" value={price} onChange={e => setPrice(e.target.value)} style={ctrl} />
              </div>
              <div>
                <div style={metaText}>Garden Price (EGP)</div>
                <input
                  type="number"
                  value={garden_price}
                  onChange={e => setGardenPrice(e.target.value)}
                  style={ctrl}
                  placeholder={editing?.has_garden ? 'e.g. 120,000' : 'N.A (no garden)'}
                  disabled={!editing?.has_garden}
                />
              </div>
              <div>
                <div style={metaText}>Roof Price (EGP)</div>
                <input
                  type="number"
                  value={roof_price}
                  onChange={e => setRoofPrice(e.target.value)}
                  style={ctrl}
                  placeholder={editing?.has_roof ? 'e.g. 180,000' : 'N.A (no roof)'}
                  disabled={!editing?.has_roof}
                />
              </div>
              <div>
                <div style={metaText}>Storage Price (EGP)</div>
                <input type="number" value={storage_price} onChange={e => setStoragePrice(e.target.value)} style={ctrl} />
              </div>
              <div>
                <div style={metaText}>Garage Price (EGP)</div>
                <input type="number" value={garage_price} onChange={e => setGaragePrice(e.target.value)} style={ctrl} />
              </div>
              <div>
                <div style={metaText}>Maintenance Price (EGP)</div>
                <input type="number" value={maintenance_price} onChange={e => setMaintenancePrice(e.target.value)} style={ctrl} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 8 }}>
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

            <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
              <button type="submit" style={btnPrimary}>Resubmit for Approval</button>
              <button type="button" onClick={() => setEditing(null)} style={btn}>Cancel</button>
            </div>
          </form>
        )}

        {error ? <p style={errorText}>{error}</p> : null}

        <div style={tableWrap}>
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>ID</th>
                <th style={th}>Model</th>
                <th style={th}>Code</th>
                <th style={th}>Area</th>
                <th style={th}>Price</th>
                <th style={th}>Garden</th>
                <th style={th}>Roof</th>
                <th style={th}>Storage</th>
                <th style={th}>Garage</th>
                <th style={th}>Maintenance</th>
                <th style={th}>Rejected By</th>
                <th style={th}>Reason</th>
                <th style={th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pricings.map(p => (
                <tr key={p.id}>
                  <td style={td}>{p.id}</td>
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
                  <td style={td}>{p.approved_by_email || ''}</td>
                  <td style={td}>{p.reject_reason || p.reason || ''}</td>
                  <td style={td}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button onClick={() => startEdit(p)} style={btnPrimary}>Edit & Resubmit</button>
                      <button onClick={() => deletePricing(p)} style={btnDanger}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {pricings.length === 0 && !loading && (
                <tr>
                  <td style={td} colSpan={13}><span style={metaText}>No rejected requests.</span></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}