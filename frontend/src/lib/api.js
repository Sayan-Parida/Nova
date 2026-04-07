'use client'

import axios from 'axios'
import { clearAuthSession, getAuthToken } from '@/context/AuthContext'

function getTimezoneOffsetHeaderValue() {
  const offsetMinutes = -new Date().getTimezoneOffset()
  const sign = offsetMinutes >= 0 ? '+' : '-'
  const absoluteMinutes = Math.abs(offsetMinutes)
  const hours = String(Math.floor(absoluteMinutes / 60)).padStart(2, '0')
  const minutes = String(absoluteMinutes % 60).padStart(2, '0')
  return `${sign}${hours}:${minutes}`
}

const api = axios.create({
  baseURL: 'http://localhost:8081',
})

api.interceptors.request.use(
  (config) => {
    const authToken = getAuthToken()
    if (authToken) {
      config.headers = config.headers ?? {}
      config.headers.Authorization = `Bearer ${authToken}`
    }

    config.headers = config.headers ?? {}
    config.headers['X-Timezone-Offset'] = getTimezoneOffsetHeaderValue()

    return config
  },
  (error) => Promise.reject(error),
)

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('nova-network-error'))
      }
      return Promise.reject(error)
    }

    if (error.response.status === 401) {
      clearAuthSession()
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }

    return Promise.reject(error)
  },
)

export default api
