import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ipcApi, useIpcOn } from '@renderer/ipc'
import { toast } from '@renderer/services/toast'
import { astraCloudErrorCodes } from '@shared/ipc/errors/astraCloud'
import { IpcError } from '@shared/ipc/errors/IpcError'
import type { AstraCloudStatus } from '@shared/ipc/schemas/astraCloud'

type AstraCloudStatusLoadState = 'error' | 'loading' | 'ready'

type AstraCloudSessionAction = 'cancel' | 'login' | 'revoke'

export function useAstraAccountSession(enabled = true) {
  const { t } = useTranslation()
  const [status, setStatus] = useState<AstraCloudStatus | null>(null)
  const [loadState, setLoadState] = useState<AstraCloudStatusLoadState>('loading')
  const [pendingAction, setPendingAction] = useState<AstraCloudSessionAction | null>(null)
  const requestRef = useRef(0)

  const applyStatus = useCallback((nextStatus: AstraCloudStatus) => {
    setStatus(nextStatus)
    setLoadState('ready')
  }, [])

  useIpcOn('astra_cloud.status_changed', (nextStatus) => {
    if (!enabled) return
    requestRef.current += 1
    applyStatus(nextStatus)
  })

  const reload = useCallback(async () => {
    const requestId = ++requestRef.current
    setLoadState('loading')
    try {
      const nextStatus = await ipcApi.request('astra_cloud.status.get')
      if (requestId === requestRef.current) applyStatus(nextStatus)
    } catch {
      if (requestId === requestRef.current) setLoadState('error')
    }
  }, [applyStatus])

  useEffect(() => {
    if (!enabled) return
    void reload()
    return () => {
      requestRef.current += 1
    }
  }, [enabled, reload])

  const runAction = useCallback(
    async (action: AstraCloudSessionAction) => {
      const requestId = ++requestRef.current
      setPendingAction(action)
      try {
        const nextStatus = await ipcApi.request(
          action === 'login'
            ? 'astra_cloud.login.start'
            : action === 'cancel'
              ? 'astra_cloud.login.cancel'
              : 'astra_cloud.session.revoke'
        )
        if (requestId === requestRef.current) applyStatus(nextStatus)
      } catch (error) {
        if (requestId !== requestRef.current) return
        let message = t(
          action === 'revoke'
            ? 'settings.provider.astra_cloud.logout_failed'
            : 'settings.provider.astra_cloud.sign_in_failed'
        )
        if (action === 'login' && error instanceof IpcError) {
          if (error.code === astraCloudErrorCodes.UPGRADE_REQUIRED) {
            message = t('settings.provider.astra_cloud.upgrade_required')
          } else if (error.code === astraCloudErrorCodes.LOGIN_SERVICE_UNAVAILABLE) {
            message = t('error.http.503')
          }
        }
        toast.error(message)
      } finally {
        setPendingAction((current) => (current === action ? null : current))
      }
    },
    [applyStatus, t]
  )

  const login = useCallback(() => runAction('login'), [runAction])
  const cancelLogin = useCallback(() => runAction('cancel'), [runAction])
  const revokeSession = useCallback(() => runAction('revoke'), [runAction])

  return {
    status,
    loadState,
    reload,
    login,
    cancelLogin,
    revokeSession,
    isStartingLogin: pendingAction === 'login',
    isCancellingLogin: pendingAction === 'cancel',
    isRevokingSession: pendingAction === 'revoke',
    isAuthorizing: status?.phase === 'authorizing' || pendingAction === 'login'
  }
}
