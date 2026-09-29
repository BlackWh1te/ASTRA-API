import React, { useState, useEffect } from 'react'
import { useDataApi } from '@data/hooks/useDataApi'
import { ipcApi } from '@shared/utils/ipcApi'
import { Button } from '@renderer/components/primitives/button'
import { Input } from '@renderer/components/primitives/input'

export function AstraKeyGuard({ children }: { children: React.ReactNode }) {
  const { data: config, refetch } = useDataApi('provider.get_config', { id: 'openai' })
  const [apiKey, setApiKey] = useState('')
  const [isValid, setIsValid] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)

  // Allow triggering this from anywhere (e.g. clicking on a "Change API Key" button)
  useEffect(() => {
    const handleForceShow = () => setShowModal(true)
    window.addEventListener('show-astra-key-guard', handleForceShow)
    return () => window.removeEventListener('show-astra-key-guard', handleForceShow)
  }, [])

  useEffect(() => {
    if (config === undefined) return
    const key = config?.apiKey || ''
    setApiKey(key)
    
    if (!key) {
      setShowModal(true)
    } else if (isValid === null) {
      // Validate existing key silently
      checkKey(key, true)
    }
  }, [config])

  const checkKey = async (key: string, silent = false) => {
    if (!silent) setLoading(true)
    setError('')
    try {
      const res = await fetch('https://api.gserver.online/v1/models', {
        headers: { Authorization: `Bearer ${key}` }
      })
      if (res.ok) {
        setIsValid(true)
        setShowModal(false)
        if (!silent && key !== config?.apiKey) {
          await ipcApi.request('provider.update_config', { id: 'openai', config: { ...config, apiKey: key } })
          // Pull models to update the ModelSwitcher for the new key's permissions
          await ipcApi.request('provider.pull_models', { id: 'openai' }).catch(() => {})
          refetch()
        }
      } else {
        setIsValid(false)
        if (!silent) setError('Invalid API Key or out of tokens.')
        if (silent) setShowModal(true)
      }
    } catch (err) {
      if (!silent) setError('Connection error.')
      if (silent) setShowModal(true)
    } finally {
      if (!silent) setLoading(false)
    }
  }

  const handleSave = () => {
    checkKey(apiKey)
  }

  const handleBuy = () => {
    ipcApi.request('window.open_url', 'https://funpay.com/users/16756744/')
  }

  return (
    <>
      {children}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-background w-[400px] p-6 rounded-xl border border-border shadow-2xl relative z-[60]">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-foreground mb-2">ASTRA API Access</h2>
              <p className="text-sm text-secondary">Please enter your ASTRA API key to continue. If you ran out of tokens, you can buy more.</p>
            </div>
            
            <div className="mb-4">
              <Input 
                type="password" 
                placeholder="sk-ag-..." 
                value={apiKey} 
                onChange={(e) => setApiKey(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                className="w-full bg-surface"
              />
              {error && <p className="text-destructive text-xs mt-2">{error}</p>}
            </div>
            
            <div className="flex flex-col gap-3 mt-6">
              <Button onClick={handleSave} disabled={loading || !apiKey} variant="default" className="w-full">
                {loading ? 'Verifying...' : 'Verify & Save'}
              </Button>
              <Button onClick={handleBuy} variant="secondary" className="w-full">
                Buy Tokens
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
