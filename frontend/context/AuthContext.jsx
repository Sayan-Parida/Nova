'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'

let authSession = {
  token: null,
  userId: null,
  password: null,
}

const authListeners = new Set()

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

function notifyAuthListeners() {
  authListeners.forEach((listener) => listener(authSession))
}

function subscribe(listener) {
  authListeners.add(listener)
  return () => {
    authListeners.delete(listener)
  }
}

export function setAuthSession(token, password) {
  const payload = parseJwtPayload(token)

  authSession = {
    token,
    userId: payload?.uid ?? null,
    password: password ?? null,
  }

  notifyAuthListeners()
}

export function clearAuthSession() {
  authSession = {
    token: null,
    userId: null,
    password: null,
  }

  notifyAuthListeners()
}

export function getAuthToken() {
  return authSession.token
}

export function getAuthUserId() {
  return authSession.userId
}

export function getAuthPassword() {
  return authSession.password
}

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(authSession)

  useEffect(() => subscribe(setSession), [])

  const value = useMemo(
    () => ({
      token: session.token,
      userId: session.userId,
      password: session.password,
      setAuthSession,
      clearAuthSession,
    }),
    [session.password, session.token, session.userId],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }

  return context
}