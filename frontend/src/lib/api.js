'use client'

import axios from 'axios'

let authToken = null
let authUserId = null
let authPassword = null

function parseJwtPayload(token) {
  try {
    const payload = token.split('.')[1]
    const padded = payload.replace(/-/g, '+').replace(/_/g, '/')
    const decoded = atob(padded)
    return JSON.parse(decoded)
  } catch {
    return null
  }
}

export function setAuthSession(token, password) {
  authToken = token
  authPassword = password

  const payload = parseJwtPayload(token)
  authUserId = payload?.uid ?? null
}

export function clearAuthSession() {
  authToken = null
  authUserId = null
  authPassword = null
}

export function getAuthToken() {
  return authToken
}

export function getAuthUserId() {
  return authUserId
}

export function getAuthPassword() {
  return authPassword
}

const api = axios.create({
  baseURL: 'http://localhost:8080',
})

api.interceptors.request.use(
  (config) => {
    if (authToken) {
      config.headers.Authorization = `Bearer ${authToken}`
    }
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
