import { randomUUID } from 'node:crypto'

const baseUrl = process.env.SMOKE_BASE_URL ?? 'http://localhost:8081'
const email = process.env.SMOKE_EMAIL ?? `smoke-${randomUUID()}@nova.app`
const password = process.env.SMOKE_PASSWORD ?? 'StrongPass123'

async function request(path, options = {}) {
  const mergedHeaders = {
    'Content-Type': 'application/json',
    ...(options.headers ?? {}),
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: mergedHeaders,
  })

  const text = await response.text()
  let data = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }

  return { response, data }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function getRefreshCookie(setCookieHeader) {
  if (!setCookieHeader) {
    return null
  }

  const cookie = setCookieHeader
    .split(',')
    .map((part) => part.trim())
    .find((part) => part.startsWith('refresh_token='))

  if (!cookie) {
    return null
  }

  return cookie.split(';')[0]
}

async function run() {
  console.log(`Running smoke test against ${baseUrl}`)

  const health = await request('/api/health')
  assert(health.response.ok, `Health check failed: ${health.response.status}`)
  assert(health.data?.status === 'UP', 'Health response status is not UP')

  const register = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password,
      timezone: 'UTC',
    }),
  })

  assert(register.response.status === 201, `Register failed: ${register.response.status}`)
  const accessToken = register.data?.accessToken
  assert(accessToken, 'Register response did not return accessToken')

  const refreshCookie = getRefreshCookie(register.response.headers.get('set-cookie'))
  assert(refreshCookie, 'Register response did not return refresh cookie')

  const cyclePayload = Buffer.from('smoke-cycle-entry').toString('base64')
  const todayIsoDate = new Date().toISOString().slice(0, 10)
  const saveCycle = await request('/api/cycles', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'X-Timezone-Offset': '+00:00',
    },
    body: JSON.stringify({
      encryptedData: cyclePayload,
      dataType: 'CYCLE',
      logDate: todayIsoDate,
    }),
  })

  assert(
    saveCycle.response.status === 201,
    `Cycle save failed: ${saveCycle.response.status} ${JSON.stringify(saveCycle.data)}`,
  )
  const userId = saveCycle.data?.userId
  assert(userId, 'Cycle response did not include userId')

  const listCycles = await request(`/api/cycles/${userId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  assert(listCycles.response.ok, `Cycle list failed: ${listCycles.response.status}`)
  assert(Array.isArray(listCycles.data), 'Cycle list did not return an array')

  const refresh = await request('/api/auth/refresh', {
    method: 'POST',
    headers: {
      Cookie: refreshCookie,
    },
  })
  assert(refresh.response.ok, `Refresh failed: ${refresh.response.status}`)

  const predictionInput = Buffer.from([1, 2, 3, 4]).toString('base64')
  const prediction = await request('/api/predictions/run', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ inputData: predictionInput }),
  })

  assert(prediction.response.ok, `Prediction failed: ${prediction.response.status} ${JSON.stringify(prediction.data)}`)
  assert(prediction.data?.predictedDate, 'Prediction response missing predictedDate')

  console.log('Smoke test passed.')
}

run().catch((error) => {
  console.error('Smoke test failed.')
  console.error(error.message)
  process.exit(1)
})
