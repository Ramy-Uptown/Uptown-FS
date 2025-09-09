// Integration tests using supertest without external runner
import request from 'supertest'
import app from './app.js'

function assert(cond, msg) {
  if (!cond) throw new Error(`Assertion failed: ${msg}`)
}

async function testHealth() {
  const res = await request(app).get('/api/health').expect(200)
  assert(res.body.status === 'ok', 'health ok')
  console.log('✓ /api/health')
}

async function testCalculateTargetPV() {
  const payload = {
    mode: 'calculateForTargetPV',
    stdPlan: { totalPrice: 1000000, financialDiscountRate: 12, calculatedPV: 850000 },
    inputs: {
      dpType: 'amount',
      downPaymentValue: 100000,
      planDurationYears: 5,
      installmentFrequency: 'monthly',
      additionalHandoverPayment: 0,
      handoverYear: 2,
      splitFirstYearPayments: false,
      firstYearPayments: [],
      subsequentYears: []
    }
  }
  const res = await request(app).post('/api/calculate').send(payload).expect(200)
  assert(res.body.ok === true, 'ok true')
  assert(Math.abs(res.body.data.calculatedPV - 850000) < 1e-3, 'PV matched')
  console.log('✓ /api/calculate (calculateForTargetPV)')
}

async function testValidation() {
  const bad = {
    mode: 'calculateForTargetPV',
    stdPlan: { totalPrice: -1, financialDiscountRate: 'abc', calculatedPV: -5 }, // invalid
    inputs: {}
  }
  const res = await request(app).post('/api/calculate').send(bad).expect(400)
  assert(res.body?.error?.message, 'has error message')
  console.log('✓ /api/calculate validation')
}

async function run() {
  await testHealth()
  await testCalculateTargetPV()
  await testValidation()
  console.log('All integration tests passed.')
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})