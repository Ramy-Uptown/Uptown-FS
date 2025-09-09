// Lightweight assertions without a test framework
import {
  monthlyRateFromAnnual,
  getPaymentMonths,
  calculatePVAF,
  calculateForTargetPV,
  evaluateCustomPrice,
  Frequencies,
  CalculationModes,
  calculateByMode
} from '../services/calculationService.js'

function assertAlmostEqual(a, b, eps = 1e-6, msg = '') {
  if (Math.abs(a - b) > eps) {
    throw new Error(`Assertion failed: ${a} != ${b} ± ${eps}. ${msg}`)
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(`Assertion failed: ${msg}`)
}

async function run() {
  // monthly rate from 12% annual
  const mr = monthlyRateFromAnnual(12)
  // Effective monthly rate for 12% APR compounded monthly
  const expected = Math.pow(1.12, 1 / 12) - 1
  assertAlmostEqual(mr, expected, 1e-12, 'monthlyRateFromAnnual')

  // payment months
  assert(JSON.stringify(getPaymentMonths(3, Frequencies.Monthly, 0)) === JSON.stringify([1, 2, 3]), 'monthly schedule')
  assert(JSON.stringify(getPaymentMonths(3, Frequencies.Quarterly, 0)) === JSON.stringify([3, 6, 9]), 'quarterly schedule')
  assert(JSON.stringify(getPaymentMonths(2, Frequencies.BiAnnually, 1)) === JSON.stringify([16, 22]), 'bi-annually with startAfterYear')
  assert(JSON.stringify(getPaymentMonths(1, Frequencies.Annually, 2)) === JSON.stringify([27]), 'annually with startAfterYear')

  // PVAF sanity
  const pvafMonthly = calculatePVAF(12, Frequencies.Monthly, mr, 0)
  assert(pvafMonthly > 10 && pvafMonthly < 12, 'PVAF range sanity')

  // Scenario: target PV match with simple structure
  const stdPlan = {
    totalPrice: 1000000,
    financialDiscountRate: 12,
    calculatedPV: 850000
  }
  const inputs = {
    dpType: 'amount',
    downPaymentValue: 100000,
    planDurationYears: 5,
    installmentFrequency: Frequencies.Monthly,
    additionalHandoverPayment: 0,
    handoverYear: 2,
    splitFirstYearPayments: false,
    firstYearPayments: [],
    subsequentYears: []
  }
  const resultTarget = calculateForTargetPV(stdPlan, inputs)
  assert(resultTarget.numEqualInstallments === 60, 'equal installments count')
  // The PV computed in the result should be close to target PV
  assertAlmostEqual(resultTarget.calculatedPV, stdPlan.calculatedPV, 1e-3, 'PV match')

  // Evaluate custom price with sales discount
  const evalRes = evaluateCustomPrice(stdPlan, {
    salesDiscountPercent: 1.5,
    dpType: 'amount',
    downPaymentValue: 100000,
    planDurationYears: 5,
    installmentFrequency: Frequencies.Monthly,
    additionalHandoverPayment: 0,
    handoverYear: 2,
    splitFirstYearPayments: false,
    firstYearPayments: [],
    subsequentYears: []
  })
  // Net total should be lower than stdPlan.totalPrice due to discount
  assert(evalRes.totalNominalPrice < stdPlan.totalPrice, 'Discount applied')

  // Dispatcher sanity
  const dispRes = calculateByMode(CalculationModes.CalculateForTargetPV, stdPlan, inputs)
  assertAlmostEqual(dispRes.calculatedPV, stdPlan.calculatedPV, 1e-3, 'Dispatcher PV match')

  console.log('All calculationService tests passed.')
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})