'use client'

import { useEffect } from 'react'
import { toast } from 'sonner'

export function NetworkErrorListener() {
  useEffect(() => {
    const onNetworkError = () => {
      toast.error('Cannot reach server')
    }

    window.addEventListener('nova-network-error', onNetworkError)
    return () => {
      window.removeEventListener('nova-network-error', onNetworkError)
    }
  }, [])

  return null
}
