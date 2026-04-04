'use client'

import axios from 'axios'
import { clearAuthSession, getAuthToken } from '@/context/AuthContext'

const api = axios.create({
  baseURL: 'http://localhost:8081',
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
