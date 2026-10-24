/**
 * React hook for NEAR wallet state.
 * Uses useSyncExternalStore for safe concurrent rendering.
 */
import { useSyncExternalStore, useEffect, useState } from 'react'
import { walletStore, initWallet, signIn, signOut } from './wallet'

export function useNearWallet() {
  const accountId = useSyncExternalStore(
    (cb) => walletStore.subscribe(cb),
    () => walletStore.getSnapshot(),
    () => null
  )

  const [initializing, setInitializing] = useState(true)

  useEffect(() => {
    initWallet()
      .catch(console.error)
      .finally(() => setInitializing(false))
  }, [])

  return {
    accountId,
    isConnected: accountId !== null,
    isInitializing: initializing,
    signIn,
    signOut,
  }
}
