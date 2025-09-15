import request from 'supertest'
import app from '../app.js'

function expect(cond, msg) {
  if (!cond) throw new Error(`Expectation failed: ${msg}`)
}

function randEmail() {
  const n = Math.random().toString(36).slice(2, 8)
  return `test_${n}@example.com`
}

async function run() {
  const email = randEmail()
  const password = 'password123'

  // register
  const reg = await request(app)
    .post('/api/auth/register')
    .send({ email, password })
    .expect(200)

  expect(reg.body.ok === true, 'register ok true')
  expect(reg.body?.user?.email === email, 'registered email matches')

  // login success
  const loginOk = await request(app)
    .post('/api/auth/login')
    .send({ email, password })
    .expect(200)

  expect(loginOk.body.ok === true, 'login ok true')
  expect(Boolean(loginOk.body.accessToken), 'accessToken issued')

  // login wrong password
  const loginBad = await request(app)
    .post('/api/auth/login')
    .send({ email, password: 'wrongpassword' })
    .expect(401)

  expect(loginBad.body?.error?.message === 'Invalid credentials', 'invalid creds message')

  console.log('✓ auth tests passed')
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})