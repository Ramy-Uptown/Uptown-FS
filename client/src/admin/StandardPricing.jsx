import React, { useState, useEffect, useMemo, useRef } from 'react';
import { fetchWithAuth } from '../lib/apiClient.js';
import { notifyError, notifySuccess } from '../lib/notifications.js';
import LoadingButton from '../components/LoadingButton.jsx';
import SkeletonRow from '../components/SkeletonRow.jsx';
import AdminSidebar from '../components/AdminSidebar.jsx';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export default function StandardPricing() {
  const [models, setModels] = useState([]);
  const [pricings, setPricings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stdPlanCfg, setStdPlanCfg] = useState(null);

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
        const reqs = [
          fetchWithAuth(`${API_URL}/api/pricing/unit-model`),
          // Allow both FM and Top-Management to view models (endpoint updated to allow read)
          fetchWithAuth(`${API_URL}/api/inventory/unit-models`),
          // Active global standard plan (for rate/duration/frequency used in PV)
          fetchWithAuth(`${API_URL}/api/standard-plan/latest`)
        ];
        const [pricingRes, modelsRes, stdPlanRes] = await Promise.all(reqs);
        const pricingData = await pricingRes.json();
        if (!pricingRes.ok) throw new Error(pricingData?.error?.message || 'Failed to fetch pricing');

        setPricings(pricingData.pricings || []);

        const modelsData = await modelsRes.json();
        if (!modelsRes.ok) throw new Error(modelsData?.error?.message || 'Failed to fetch models');
        const items = modelsData.items || modelsData.models || [];
        setModels(items);

        const stdPlanData = await stdPlanRes.json();
        if (stdPlanRes.ok) {
          setStdPlanCfg(stdPlanData.standardPlan || null);
        }
      } catch (e) {
        setError(e.message || 'An error occurred');
        notifyError(e, 'Failed to load standard pricing');
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
          storage_price: storagePrice === '' ? 0 : Number(storagePrice),
          std_financial_rate_percent: Number(annualRate),
          plan_duration_years: Number(years),
          installment_frequency: String(frequency),
          standard_down_payment_percent: Number(dpPercent) || 0,
          calculated_pv: Number(pv)
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || 'Failed to save pricing');
      notifySuccess('Pricing request saved');
      // Refresh list
      const listRes = await fetchWithAuth(`${API_URL}/api/pricing/unit-model`);
      const listData = await listRes.json();
      if (listRes.ok) setPricings(listData.pricings || []);
    } catch (e) {
      const msg = e.message || String(e);
      setError(msg);
      notifyError(e, 'Failed to save pricing');
    }
  };

  const [rowLoading, setRowLoading] = useState({});
  // Map of pricingId -> authoritative PV from backend
  const [rowPv, setRowPv] = useState({});
  const handleApproveStatus = async (id, status, reason) => {
    try {
      setRowLoading(s => ({ ...s, [id]: true }));
      const res = await fetchWithAuth(`${API_URL}/api/pricing/unit-model/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, reason: reason || null })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || 'Failed to update status');
      setPricings(p => p.map(x => x.id === id ? data.pricing : x));
      notifySuccess(`Pricing ${status}`);
    } catch (e) {
      const msg = e.message || String(e);
      setError(msg);
      notifyError(e, 'Failed to update status');
    } finally {
      setRowLoading(s => ({ ...s, [id]: false }));
    }
  };

  // Fetch authoritative PV for each pricing row using backend engine
  useEffect(() => {
    let abort = false;

    const normalizeFreq = (f) => {
      const v = String(f || '').toLowerCase().trim();
      if (v === 'biannually') return 'bi-annually';
      return v || 'monthly';
    };

    async function computeAllPVs() {
      try {
        const entries = await Promise.all((pricings || []).map(async (p) => {
          try {
            const totalNominal =
              (Number(p.price || 0)) +
              (Number(p.garden_price || 0)) +
              (Number(p.roof_price || 0)) +
              (Number(p.storage_price || 0)) +
              (Number(p.garage_price || 0));

            // Derive row-specific years/frequency/rate with same precedence as the table
            const rowYears =
              (p.plan_duration_years != null ? Number(p.plan_duration_years) : null)
              ?? (stdPlanCfg?.plan_duration_years != null ? Number(stdPlanCfg.plan_duration_years) : null)
              ?? 5;

            const rowFreq =
              (p.installment_frequency ? normalizeFreq(p.installment_frequency) : null)
              ?? (stdPlanCfg?.installment_frequency ? normalizeFreq(stdPlanCfg.installment_frequency) : null)
              ?? 'monthly';

            const rowRate =
              (p.std_financial_rate_percent != null ? Number(p.std_financial_rate_percent) : null)
              ?? (stdPlanCfg?.std_financial_rate_percent != null ? Number(stdPlanCfg.std_financial_rate_percent) : null)
              ?? 0;

            if (!(totalNominal > 0) || !(Number.isInteger(rowYears) && rowYears > 0)) {
              return [p.id, 0];
            }

            // Always include the Down Payment in PV (use the current form's DP% as policy)
            const dpPct = Number(dpPercent) || 0;

            const body = {
              mode: 'evaluateCustomPrice',
              stdPlan: {
                totalPrice: totalNominal,
                financialDiscountRate: Number(rowRate) || 0,
                calculatedPV: 0
              },
              inputs: {
                salesDiscountPercent: 0,
                dpType: 'percentage',
                downPaymentValue: dpPct, // include DP in PV calculation
                planDurationYears: rowYears,
                installmentFrequency: rowFreq,
                additionalHandoverPayment: 0,
                handoverYear: 1,
                splitFirstYearPayments: false,
                firstYearPayments: [],
                subsequentYears: []
              }
            };

            const resp = await fetchWithAuth(`${API_URL}/api/calculate`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body)
            });
            const data = await resp.json().catch(() => null);
            if (!resp.ok || !data) {
              return [p.id, 0];
            }
            const calcPv = Number(data?.data?.calculatedPV) || 0;
            return [p.id, calcPv];
          } catch {
            return [p.id, 0];
          }
        }));

        if (abort) return;
        const next = {};
        for (const [id, val] of entries) next[id] = val;
        setRowPv(next);
      } catch {
        if (!abort) setRowPv({});
      }
    }

    computeAllPVs();
    return () => { abort = true; };
  }, [pricings, stdPlanCfg, dpPercent]);

  // Pricing history modal state
  const [historyPricingId, setHistoryPricingId] = useState(null);
  const [historyItems, setHistoryItems] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [rejectReasons, setRejectReasons] = useState({});

  const [pv, setPv] = useState(0);
  const [pvError, setPvError] = useState('');
  const pvDebounce = useRef(null);

  useEffect(() => {
    if (pvDebounce.current) clearTimeout(pvDebounce.current);

    pvDebounce.current = setTimeout(async () => {
      try {
        const total =
          (Number(stdPrice || 0)) +
          (selectedModel?.has_garden ? Number(gardenPrice || 0) : 0) +
          (selectedModel?.has_roof ? Number(roofPrice || 0) : 0) +
          (Number(storagePrice || 0)) +
          (Number(garagePrice || 0));

        const yrs = Number(years) || 0;
        const rate = Number(annualRate);
        const freq = String(frequency || 'monthly');

        // Basic guards
        if (!(total > 0) || !(yrs > 0) || !['monthly','quarterly','bi-annually','annually'].includes(freq)) {
          setPv(0);
          setPvError('');
          return;
        }

        // Build request mirroring LivePreview pattern, using authoritative backend engine
        const body = {
          mode: 'evaluateCustomPrice',
          stdPlan: {
            totalPrice: total,
            financialDiscountRate: rate,
            calculatedPV: 0
          },
          inputs: {
            salesDiscountPercent: 0,
            dpType: 'percentage',
            downPaymentValue: Number(dpPercent) || 0,
            planDurationYears: yrs,
            installmentFrequency: freq,
            additionalHandoverPayment: 0,
            handoverYear: 1,
            splitFirstYearPayments: false,
            firstYearPayments: [],
            subsequentYears: []
          }
        };

        const resp = await fetchWithAuth(`${API_URL}/api/calculate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        const data = await resp.json().catch(() => null);

        if (!resp.ok || !data) {
          setPv(0);
          setPvError(data?.error?.message || 'Failed to calculate PV');
          return;
        }

        const calcPv = Number(data?.data?.calculatedPV) || 0;
        setPv(calcPv);
        setPvError('');
      } catch (e) {
        setPv(0);
        setPvError('Failed to calculate PV');
      }
    }, 400);

    return () => {
      if (pvDebounce.current) clearTimeout(pvDebounce.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stdPrice, gardenPrice, roofPrice, storagePrice, garagePrice, dpPercent, years, frequency, annualRate, selectedModel]);

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

  return (
    <div className="flex h-screen bg-gray-50">
      <AdminSidebar role={role} />
      
      <main className="flex-1 overflow-y-auto ml-0 md:ml-64 p-6">
        <div className="max-w-7xl mx-auto space-y-6">
            
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-display font-bold text-primary tracking-wide">List Price Configuration</h2>
                    <p className="text-sm text-gray-500 mt-1">Configure and approve standard pricing per unit model.</p>
                </div>
                 <div className="flex gap-2">
                    {role === 'financial_manager' ? (
                    <>
                        <a href="/admin/unit-models" className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary/90 shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary">
                        Manage Unit Models
                        </a>
                        <a href="/admin/unit-model-changes" className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary">
                        Model Changes
                        </a>
                    </>
                    ) : null}
                    {(role === 'ceo' || role === 'chairman' || role === 'vice_chairman') ? (
                    <a href="/admin/unit-model-changes" className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary/90 shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary">
                        Review Model Changes
                    </a>
                    ) : null}
                </div>
            </div>

            {error && (
                 <div className="rounded-md bg-red-50 p-4">
                    <div className="flex">
                         <div className="flex-shrink-0">
                             <span className="material-symbols-outlined text-red-400">error</span>
                         </div>
                         <div className="ml-3">
                             <h3 className="text-sm font-medium text-red-800">Error</h3>
                             <div className="mt-2 text-sm text-red-700">{error}</div>
                         </div>
                    </div>
                </div>
            )}

            {role === 'financial_manager' && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
                    <form onSubmit={handleUpsertPricing} className="space-y-6">
                        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                            <h3 className="text-lg font-medium leading-6 text-gray-900">Configure Pricing</h3>
                            <a href="/admin/standard-pricing-rejected" className="text-sm text-primary hover:text-primary/80 font-medium">View Rejected Requests</a>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Model Name</label>
                                <select 
                                    value={selectedModelName} 
                                    onChange={e => setSelectedModelName(e.target.value)} 
                                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md"
                                >
                                    <option value="">Select name…</option>
                                    {models.map(m => (
                                        <option key={m.id} value={m.model_name || ''}>
                                        {m.model_name || ''} {m.area ? `— ${m.area} m²` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Model Code</label>
                                <select 
                                    value={selectedModelCode} 
                                    onChange={e => setSelectedModelCode(e.target.value)} 
                                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md"
                                >
                                    <option value="">Select code…</option>
                                    {models.map(m => (
                                        <option key={m.id} value={m.model_code || ''}>
                                        {m.model_code || '(none)'}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {selectedModel && (
                             <div className="bg-gray-50 rounded-md p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 uppercase">Orientation</label>
                                    <div className="mt-1 text-sm font-medium text-gray-900">{String(selectedModel.orientation || '').replace(/_/g,' ')}</div>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 uppercase">Area</label>
                                    <div className="mt-1 text-sm font-medium text-gray-900">{selectedModel.area ?? '-'} m²</div>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 uppercase">Garden</label>
                                    <div className="mt-1 text-sm font-medium text-gray-900">{selectedModel.has_garden ? (selectedModel.garden_area ? `Yes (${selectedModel.garden_area} m²)` : 'Yes') : 'No'}</div>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 uppercase">Roof</label>
                                    <div className="mt-1 text-sm font-medium text-gray-900">{selectedModel.has_roof ? (selectedModel.roof_area ? `Yes (${selectedModel.roof_area} m²)` : 'Yes') : 'No'}</div>
                                </div>
                             </div>
                        )}

                        <div>
                            <h3 className="text-sm font-medium text-gray-900 mb-4 border-b pb-2">Price Components (EGP)</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Base Unit Price</label>
                                    <input type="number" value={stdPrice} onChange={e => setStdPrice(e.target.value)} placeholder="e.g. 3,500,000" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Garden Price</label>
                                    <input 
                                        type="number" 
                                        value={gardenPrice} 
                                        onChange={e => setGardenPrice(e.target.value)} 
                                        disabled={!selectedModel?.has_garden}
                                        placeholder={selectedModel?.has_garden ? "e.g. 120,000" : "N.A (no garden)"}
                                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm disabled:bg-gray-100 disabled:text-gray-500" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Roof Price</label>
                                    <input 
                                        type="number" 
                                        value={roofPrice} 
                                        onChange={e => setRoofPrice(e.target.value)} 
                                        disabled={!selectedModel?.has_roof}
                                        placeholder={selectedModel?.has_roof ? "e.g. 180,000" : "N.A (no roof)"}
                                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm disabled:bg-gray-100 disabled:text-gray-500" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Storage Price</label>
                                    <input type="number" value={storagePrice} onChange={e => setStoragePrice(e.target.value)} placeholder="e.g. 75,000" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Garage Price</label>
                                    <input type="number" value={garagePrice} onChange={e => setGaragePrice(e.target.value)} placeholder="e.g. 200,000" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Maintenance (Excluded from PV)</label>
                                    <input type="number" value={maintenancePrice} onChange={e => setMaintenancePrice(e.target.value)} placeholder="e.g. 150,000" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm" />
                                </div>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-sm font-medium text-gray-900 mb-4 border-b pb-2">Financial Terms (Used for PV Calculation)</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Down Payment (%)</label>
                                    <input type="number" value={dpPercent} onChange={e => setDpPercent(e.target.value)} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Plan Duration (Years)</label>
                                    <input type="number" value={years} onChange={e => setYears(e.target.value)} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Annual Financial Rate (%)</label>
                                    <input type="number" value={annualRate} onChange={e => setAnnualRate(e.target.value)} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm" />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Installment Frequency</label>
                                    <select value={frequency} onChange={e => setFrequency(e.target.value)} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm">
                                        <option value="monthly">monthly</option>
                                        <option value="quarterly">quarterly</option>
                                        <option value="bi-annually">bi-annually</option>
                                        <option value="annually">annually</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Total Price for PV</label>
                                    <input 
                                        readOnly 
                                        value={
                                            (Number(stdPrice || 0)
                                            + (selectedModel?.has_garden ? Number(gardenPrice || 0) : 0)
                                            + (selectedModel?.has_roof ? Number(roofPrice || 0) : 0)
                                            + Number(storagePrice || 0)
                                            + Number(garagePrice || 0)).toLocaleString() + ' EGP'
                                        }
                                        className="mt-1 block w-full border-gray-300 bg-gray-50 text-gray-500 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="bg-primary/5 rounded-lg p-4 border border-primary/20 grid grid-cols-1 sm:grid-cols-3 gap-6">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide">Calculated PV</label>
                                <div className="mt-1 text-xl font-bold text-primary">{Number(pv || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-sm font-normal text-gray-600">EGP</span></div>
                                {pvError && <div className="text-xs text-red-600 mt-1">{pvError}</div>}
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide">Installments Count</label>
                                <div className="mt-1 text-xl font-bold text-gray-900">{installmentsCount || 0}</div>
                            </div>
                             <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide">Price per m²</label>
                                <div className="mt-1 text-xl font-bold text-gray-900">{Number(pricePerSqM || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-sm font-normal text-gray-600">EGP/m²</span></div>
                            </div>
                        </div>

                         <div className="flex items-center justify-end gap-4 pt-4 border-t border-gray-100">
                            <span className="text-sm text-gray-500 italic">Top-Management approval required.</span>
                            <LoadingButton 
                                type="submit" 
                                disabled={!selectedModelId || !stdPrice}
                                className="inline-flex justify-center items-center px-6 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                            >
                                Save & Request Approval
                            </LoadingButton>
                        </div>
                    </form>
                </div>
            )}
            
            {/* Pricing List Table */}
            <div className="bg-white shadow ring-1 ring-black ring-opacity-5 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-300">
                        <thead className="bg-gray-50">
                            <tr>
                                <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 sm:pl-6">Model</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Code</th>
                                <th scope="col" className="px-3 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Area</th>
                                <th scope="col" className="px-3 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Price (EGP)</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Garden</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Roof</th>
                                <th scope="col" className="px-3 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Storage</th>
                                <th scope="col" className="px-3 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Garage</th>
                                <th scope="col" className="px-3 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Maint.</th>
                                <th scope="col" className="px-3 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">DP %</th>
                                <th scope="col" className="px-3 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Calc PV</th>
                                <th scope="col" className="px-3 py-3.5 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                                <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6"><span className="sr-only">Actions</span></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                            {loading && (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i}><td colSpan={13} className="px-3 py-4"><SkeletonRow widths={['lg']} /></td></tr>
                                ))
                            )}
                            {!loading && pricings.map(p => {
                                const rowYears = (p.plan_duration_years != null ? Number(p.plan_duration_years) : null)
                                    ?? (stdPlanCfg?.plan_duration_years != null ? Number(stdPlanCfg.plan_duration_years) : null)
                                    ?? (Number(years) || 5);
                                const normalizeFreq = (f) => {
                                    const v = String(f || '').toLowerCase().trim();
                                    if (v === 'biannually') return 'bi-annually';
                                    return v || 'monthly';
                                };
                                const rowFreq = (p.installment_frequency ? normalizeFreq(p.installment_frequency) : null)
                                    ?? (stdPlanCfg?.installment_frequency ? normalizeFreq(stdPlanCfg.installment_frequency) : null)
                                    ?? normalizeFreq(frequency || 'monthly');
                                const rowRate = (p.std_financial_rate_percent != null ? Number(p.std_financial_rate_percent) : null)
                                    ?? (stdPlanCfg?.std_financial_rate_percent != null ? Number(stdPlanCfg.std_financial_rate_percent) : null)
                                    ?? (Number(annualRate) || 0);
                                const rowPvValue = rowPv[p.id];
                                
                                const statusColor = 
                                    p.status === 'approved' ? 'bg-green-100 text-green-800' :
                                    p.status === 'rejected' ? 'bg-red-100 text-red-800' :
                                    'bg-yellow-100 text-yellow-800';

                                return (
                                    <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">{p.model_name}</td>
                                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{p.model_code || '-'}</td>
                                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 text-right">{Number(p.area || 0).toLocaleString()}</td>
                                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900 font-medium text-right">{Number(p.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                            {(() => {
                                                const hasGarden = p.has_garden ?? (p.garden_area != null ? Number(p.garden_area) > 0 : null);
                                                const val = Number(p.garden_price || 0);
                                                if (hasGarden === false) return <span className="text-gray-400">N.A</span>;
                                                return val ? val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : (hasGarden === false ? 'N.A' : '0.00');
                                            })()}
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                            {(() => {
                                                const hasRoof = p.has_roof ?? (p.roof_area != null ? Number(p.roof_area) > 0 : null);
                                                const val = Number(p.roof_price || 0);
                                                if (hasRoof === false) return <span className="text-gray-400">N.A</span>;
                                                return val ? val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : (hasRoof === false ? 'N.A' : '0.00');
                                            })()}
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 text-right">{Number(p.storage_price || 0).toLocaleString()}</td>
                                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 text-right">{Number(p.garage_price || 0).toLocaleString()}</td>
                                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 text-right">{Number(p.maintenance_price || 0).toLocaleString()}</td>
                                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 text-right">{Number(p.standard_down_payment_percent || 0)}%</td>
                                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900 font-medium text-right">{Number(rowPvValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        <td className="whitespace-nowrap px-3 py-4 text-sm text-center">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor}`}>
                                                {p.status}
                                            </span>
                                        </td>
                                        <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                                            <div className="flex justify-end gap-2 items-center">
                                                <button onClick={() => openPricingHistory(p.id)} className="text-primary hover:text-primary/80">History</button>
                                                
                                                {(role === 'ceo' || role === 'chairman' || role === 'vice_chairman') && p.status === 'pending_approval' ? (
                                                    <div className="flex items-center gap-2 bg-gray-50 p-1 rounded border border-gray-200 ml-2">
                                                        <LoadingButton onClick={() => handleApproveStatus(p.id, 'approved')} loading={rowLoading[p.id]} className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700">Approve</LoadingButton>
                                                        <input 
                                                            placeholder="Reject reason..." 
                                                            value={rejectReasons[p.id] || ''} 
                                                            onChange={e => setRejectReasons(s => ({ ...s, [p.id]: e.target.value }))}
                                                            className="text-xs border-gray-300 rounded w-24 px-1 py-1"
                                                        />
                                                        <LoadingButton onClick={() => handleApproveStatus(p.id, 'rejected', rejectReasons[p.id])} loading={rowLoading[p.id]} className="text-xs bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700">Reject</LoadingButton>
                                                    </div>
                                                ) : null}

                                                {(role === 'financial_manager') && p.status === 'pending_approval' && p.created_by === user.id ? (
                                                    <button 
                                                        className="text-red-600 hover:text-red-900 ml-2"
                                                        onClick={async () => {
                                                            if (!window.confirm('Cancel this pending pricing request?')) return
                                                            try {
                                                                const res = await fetchWithAuth(`${API_URL}/api/pricing/unit-model/${p.id}`, { method: 'DELETE' })
                                                                const data = await res.json()
                                                                if (!res.ok) throw new Error(data?.error?.message || 'Cancel failed')
                                                                notifySuccess('Request cancelled')
                                                                // refresh list
                                                                const listRes = await fetchWithAuth(`${API_URL}/api/pricing/unit-model`)
                                                                const listData = await listRes.json()
                                                                if (listRes.ok) setPricings(listData.pricings || [])
                                                            } catch (e) {
                                                                const msg = e.message || String(e)
                                                                setError(msg)
                                                                notifyError(e, 'Cancel failed')
                                                            }
                                                        }}
                                                    >
                                                        Cancel
                                                    </button>
                                                ) : null}

                                                {/* Hidden columns data visualizer (optional tooltips could go here) */}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {!loading && pricings.length === 0 && (
                                <tr>
                                    <td colSpan={13} className="px-3 py-8 text-center text-sm text-gray-500">No unit model pricing entries found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {(role === 'ceo' || role === 'chairman' || role === 'vice_chairman') && (
                <div className="bg-white shadow ring-1 ring-black ring-opacity-5 rounded-lg overflow-hidden mt-8">
                    <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                        <h3 className="text-lg font-medium text-gray-900">Unit Models (Read-only)</h3>
                    </div>
                     <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-300">
                             <thead className="bg-gray-50">
                                <tr>
                                    <th className="py-3.5 pl-4 pr-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 sm:pl-6">ID</th>
                                    <th className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Name</th>
                                    <th className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Code</th>
                                    <th className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Area</th>
                                    <th className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Orientation</th>
                                    <th className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Garden</th>
                                    <th className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Roof</th>
                                </tr>
                             </thead>
                             <tbody className="divide-y divide-gray-200 bg-white">
                                {models.map(m => (
                                    <tr key={m.id}>
                                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">{m.id}</td>
                                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900">{m.model_name}</td>
                                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{m.model_code || '-'}</td>
                                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{m.area} m²</td>
                                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{String(m.orientation || '').replace(/_/g,' ')}</td>
                                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{m.has_garden ? (m.garden_area ? `Yes (${m.garden_area} m²)` : 'Yes') : 'No'}</td>
                                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{m.has_roof ? (m.roof_area ? `Yes (${m.roof_area} m²)` : 'Yes') : 'No'}</td>
                                    </tr>
                                ))}
                                {models.length === 0 && (
                                    <tr><td colSpan={7} className="px-3 py-8 text-center text-sm text-gray-500">No models found.</td></tr>
                                )}
                             </tbody>
                        </table>
                    </div>
                </div>
            )}
            
        </div>
      </main>

      {/* Pricing History Modal */}
      {historyPricingId != null && (
        <div className="fixed inset-0 z-[2000] overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={closePricingHistory}></div>
                <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
                <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full sm:p-6" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-between items-center mb-5">
                        <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">Pricing History — #{historyPricingId}</h3>
                         <button 
                            onClick={closePricingHistory}
                            type="button" 
                            className="bg-white rounded-md text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                        >
                            <span className="sr-only">Close</span>
                             <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>
                    
                    <div className="mt-2 max-h-[60vh] overflow-y-auto">
                         {historyLoading ? (
                            <div className="space-y-4">
                                <SkeletonRow widths={['lg']} tdStyle={{ padding: 0 }} />
                                <SkeletonRow widths={['md','lg']} tdStyle={{ padding: 0 }} />
                            </div>
                         ) : historyItems.length === 0 ? (
                            <p className="text-sm text-gray-500 italic">No history found for this pricing entry.</p>
                         ) : (
                             <ul className="space-y-4">
                                {historyItems.map((h, idx) => (
                                    <li key={h.id || idx} className="bg-gray-50 rounded-md p-3 text-sm">
                                        <div className="flex justify-between items-start">
                                            <span className="font-bold text-gray-800 uppercase text-xs tracking-wide">{h.action}</span>
                                            <span className="text-gray-400 text-xs">{h.created_at ? new Date(h.created_at).toLocaleString() : ''}</span>
                                        </div>
                                         <div className="mt-1 text-gray-600 text-xs">By: {h.changed_by_email || h.changed_by || 'Unknown'}</div>
                                         {h.details && (
                                            <div className="mt-2 bg-white border border-gray-200 rounded p-2 text-xs font-mono text-gray-700 whitespace-pre-wrap overflow-x-auto">
                                                {typeof h.details === 'string' ? h.details : JSON.stringify(h.details, null, 2)}
                                            </div>
                                         )}
                                    </li>
                                ))}
                             </ul>
                         )}
                    </div>
                    
                    <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-1 sm:gap-3 sm:grid-flow-row-dense">
                        <button 
                            type="button" 
                            className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary sm:col-start-1 sm:text-sm"
                            onClick={closePricingHistory}
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
