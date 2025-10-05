// Lightweight assertions without a test framework
import {
  monthlyRateFromAnnual,
  getPaymentMonths,
  calculatePVAF,
  calculateForTargetPV,
  evaluateCustomPrice,
  customYearlyThenEqualTargetPV,
  customYearlyThenEqualUseStdPrice,
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
  assert(JSON.stringify(getPaymentMonths(2, Frequencies.BiAnnually, 0)) === JSON.stringify([6, 12]), 'bi-annually schedule')
  assert(JSON.stringify(getPaymentMonths(2, Frequencies.BiAnnually, 1)) === JSON.stringify([18, 24]), 'bi-annually with startAfterYear')
  assert(JSON.stringify(getPaymentMonths(1, Frequencies.Annually, 0)) === JSON.stringify([12]), 'annually schedule')
  assert(JSON.stringify(getPaymentMonths(1, Frequencies.Annually, 2)) === JSON.stringify([36]), 'annually with startAfterYear')

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

  // Custom structure: use std price with a custom year and split Y1
  const customUseStd = customYearlyThenEqualUseStdPrice(stdPlan, {
    dpType: 'amount',
    downPaymentValue: 0,
    planDurationYears: 5,
    installmentFrequency: Frequencies.Quarterly,
    additionalHandoverPayment: 0,
    handoverYear: 2,
    splitFirstYearPayments: true,
    firstYearPayments: [
      { amount: 50000, month: 1, type: 'dp' },
      { amount: 25000, month: 6, type: 'regular' }
    ],
    subsequentYears: [
      { totalNominal: 120000, frequency: Frequencies.Quarterly } // Year 2
    ]
  })
  assert(customUseStd.totalNominalPrice === stdPlan.totalPrice, 'Use std price total equality')

  // Custom structure: target PV with custom year
  const customTarget = customYearlyThenEqualTargetPV(stdPlan, {
    dpType: 'amount',
    downPaymentValue: 0,
    planDurationYears: 5,
    installmentFrequency: Frequencies.Quarterly,
    additionalHandoverPayment: 0,
    handoverYear: 2,
    splitFirstYearPayments: false,
    firstYearPayments: [],
    subsequentYears: [
      { totalNominal: 120000, frequency: Frequencies.Quarterly } // Year 1
    ]
  })
  assertAlmostEqual(customTarget.calculatedPV, stdPlan.calculatedPV, 1e-3, 'Custom Target PV match')

  // Dispatcher sanity
  const dispRes = calculateByMode(CalculationModes.CalculateForTargetPV, stdPlan, inputs)
  assertAlmostEqual(dispRes.calculatedPV, stdPlan.calculatedPV, 1e-3, 'Dispatcher PV match')

  // Custom structure: subsequent year without frequency should default to main frequency
  const customSubsequentDefaults = customYearlyThenEqualUseStdPrice(stdPlan, {
    dpType: 'amount',
    downPaymentValue: 100000,
    planDurationYears: 5,
    installmentFrequency: Frequencies.Monthly, // Main frequency
    additionalHandoverPayment: 0,
    handoverYear: 0,
    splitFirstYearPayments: false,
    firstYearPayments: [],
    subsequentYears: [
      { totalNominal: 120000 } // Year 1, frequency omitted
    ]
  });

  // Manually calculate the PV to verify the logic.
  // The bug would cause this to be calculated Annually (1 payment). The fix is Monthly (12 payments).
  const monthlyRateForDefaultTest = monthlyRateFromAnnual(stdPlan.financialDiscountRate);
  const year1Months = getPaymentMonths(12, Frequencies.Monthly, 0);
  let year1PV = 0;
  for (const m of year1Months) {
    year1PV += (120000 / 12) / Math.pow(1 + monthlyRateForDefaultTest, m);
  }

  // The rest of the payments are equal installments for the remaining 4 years (48 months)
  const remainingNominal = stdPlan.totalPrice - 100000 - 120000;
  const equalInstallment = remainingNominal / 48;
  const equalMonths = getPaymentMonths(48, Frequencies.Monthly, 1);
  let equalInstallmentsPV = 0;
  for (const m of equalMonths) {
    equalInstallmentsPV += equalInstallment / Math.pow(1 + monthlyRateForDefaultTest, m);
  }

  const expectedPV = 100000 + year1PV + equalInstallmentsPV;
  assertAlmostEqual(customSubsequentDefaults.calculatedPV, expectedPV, 1e-3, 'Subsequent year frequency defaults to main frequency');

  console.log('All calculationService tests passed.')
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})