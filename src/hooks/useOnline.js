import { useSyncExternalStore } from 'react'

const subscribe = (onChange) => {
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  return () => {
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}

const getSnapshot = () => navigator.onLine

// Vrai tant que le navigateur se croit connecté (navigator.onLine et événements online/offline).
export const useOnline = () => useSyncExternalStore(subscribe, getSnapshot, () => true)
