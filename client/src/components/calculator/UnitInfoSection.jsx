import React from 'react'
import UnitPicker from './UnitPicker.jsx'

export default function UnitInfoSection({
  role,
  styles,
  mode,
  inputs,
  unitInfo, setUnitInfo,
  setStdPlan,
  setInputs,
  setCurrency,
  setFeeSchedule,
  setUnitPricingBreakdown
}) {

  const unitBlocked = Boolean(unitInfo?.blocked_until) || (Number(unitInfo?.unit_id) > 0 && (unitInfo?.available === false))
  const lockUnitEdits = role === 'property_consultant' && unitBlocked

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Unit & Project Information</h2>
      <div className={styles.grid2}>
        <div>
          <label className={styles.label}>Unit Type</label>
          <UnitPicker
            styles={styles}
            mode={mode}
            inputs={inputs}
            unitInfo={unitInfo}
            setUnitInfo={setUnitInfo}
            setStdPlan={setStdPlan}
            setInputs={setInputs}
            setCurrency={setCurrency}
            setFeeSchedule={setFeeSchedule}
            setUnitPricingBreakdown={setUnitPricingBreakdown}
          />
          <small className={styles.metaText}>
            Choose a type to view available inventory. Selecting a unit will set price and details automatically.
          </small>
        </div>
        <div>
          <label className={styles.label}>Unit Type (<span className={styles.arInline}>[[نوع الوحدة]]</span>)</label>
          <input
            dir="auto"
            className={styles.input}
            value={unitInfo.unit_type}
            onChange={e => setUnitInfo(s => ({ ...s, unit_type: e.target.value }))}
            disabled={lockUnitEdits}
            title={lockUnitEdits ? 'Locked after unit block approval (consultant cannot change unit data)' : undefined}
            placeholder='مثال: "شقة سكنية بالروف"'
          />
        </div>
        <div>
          <label className={styles.label}>Unit Code (<span className={styles.arInline}>[[كود الوحدة]]</span>)</label>
          <input
            dir="auto"
            className={styles.input}
            value={unitInfo.unit_code}
            onChange={e => setUnitInfo(s => ({ ...s, unit_code: e.target.value }))}
            disabled={lockUnitEdits}
            title={lockUnitEdits ? 'Locked after unit block approval (consultant cannot change unit data)' : undefined}
          />
        </div>
        <div>
          <label className={styles.label}>Unit Number (<span className={styles.arInline}>[[وحدة رقم]]</span>)</label>
          <input
            className={styles.input}
            value={unitInfo.unit_number}
            onChange={e => setUnitInfo(s => ({ ...s, unit_number: e.target.value }))}
            disabled={lockUnitEdits}
            title={lockUnitEdits ? 'Locked after unit block approval (consultant cannot change unit data)' : undefined}
          />
        </div>
        <div>
          <label className={styles.label}>Floor (<span className={styles.arInline}>[[الدور]]</span>)</label>
          <input
            className={styles.input}
            value={unitInfo.floor}
            onChange={e => setUnitInfo(s => ({ ...s, floor: e.target.value }))}
            disabled={lockUnitEdits}
            title={lockUnitEdits ? 'Locked after unit block approval (consultant cannot change unit data)' : undefined}
          />
        </div>
        <div>
          <label className={styles.label}>Building Number (<span className={styles.arInline}>[[مبنى رقم]]</span>)</label>
          <input
            className={styles.input}
            value={unitInfo.building_number}
            onChange={e => setUnitInfo(s => ({ ...s, building_number: e.target.value }))}
            disabled={lockUnitEdits}
            title={lockUnitEdits ? 'Locked after unit block approval (consultant cannot change unit data)' : undefined}
          />
        </div>
        <div>
          <label className={styles.label}>Block / Sector (<span className={styles.arInline}>[[قطاع]]</span>)</label>
          <input
            dir="auto"
            className={styles.input}
            value={unitInfo.block_sector}
            onChange={e => setUnitInfo(s => ({ ...s, block_sector: e.target.value }))}
            disabled={lockUnitEdits}
            title={lockUnitEdits ? 'Locked after unit block approval (consultant cannot change unit data)' : undefined}
          />
        </div>
        <div>
          <label className={styles.label}>Zone / Neighborhood (<span className={styles.arInline}>[[مجاورة]]</span>)</label>
          <input
            dir="auto"
            className={styles.input}
            value={unitInfo.zone}
            onChange={e => setUnitInfo(s => ({ ...s, zone: e.target.value }))}
            disabled={lockUnitEdits}
            title={lockUnitEdits ? 'Locked after unit block approval (consultant cannot change unit data)' : undefined}
          />
        </div>
        <div>
          <label className={styles.label}>Garden Details (<span className={styles.arInline}>[[مساحة الحديقة]]</span>)</label>
          <input
            dir="auto"
            className={styles.input}
            value={unitInfo.garden_details}
            onChange={e => setUnitInfo(s => ({ ...s, garden_details: e.target.value }))}
            disabled={lockUnitEdits}
            title={lockUnitEdits ? 'Locked after unit block approval (consultant cannot change unit data)' : undefined}
            placeholder='مثال: "و حديقة بمساحة ٥٠ م٢"'
          />
        </div>
      </div>
    </section>
  )
}